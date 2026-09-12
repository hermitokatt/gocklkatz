import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getDataset } from "@/lib/dataset";
import {
  filterListings,
  getProfile,
  rankListings,
  runPipeline,
  scoreListing,
} from "@/lib/pipeline";

const APP_ROOT = join(__dirname, "..");

describe("ranking pipeline", () => {
  it("is deterministic for the committed dataset and profile", () => {
    const dataset = getDataset();
    const profile = getProfile();
    const a = runPipeline(dataset, profile);
    const b = runPipeline(dataset, profile);

    expect(JSON.stringify(a.digest)).toBe(JSON.stringify(b.digest));
    expect(JSON.stringify(a.rejected)).toBe(JSON.stringify(b.rejected));
    expect(a.stages.map((s) => `${s.id}:${s.count}`)).toEqual(
      b.stages.map((s) => `${s.id}:${s.count}`),
    );
  });

  it("filter rejects carry an explicit reason, and survivors remain for ranking", () => {
    const dataset = getDataset();
    const profile = getProfile();
    const { eligible, rejected } = filterListings(dataset.records, profile);

    expect(rejected.length).toBeGreaterThan(0);
    for (const item of rejected) {
      expect(item.reason.length).toBeGreaterThan(10);
      expect(item.reasonCode).toMatch(/^(posted_before_eligibility|focus_excluded|role_excluded)$/);
    }

    expect(eligible.length).toBe(dataset.records.length - rejected.length);
    expect(eligible.length).toBeGreaterThanOrEqual(8);
  });

  it("rank orders by descending score with named weighted components", () => {
    const dataset = getDataset();
    const profile = getProfile();
    const { eligible } = filterListings(dataset.records, profile);
    const ranked = rankListings(eligible, profile);

    expect(ranked.length).toBe(eligible.length);
    for (let i = 1; i < ranked.length; i++) {
      const prev = ranked[i - 1]!;
      const cur = ranked[i]!;
      expect(prev.score.total).toBeGreaterThanOrEqual(cur.score.total);
      if (prev.score.total === cur.score.total) {
        expect(prev.record.id.localeCompare(cur.record.id)).toBeLessThan(0);
      }
    }

    const top = ranked[0]!;
    const sum =
      top.score.weighted.role_match +
      top.score.weighted.focus_match +
      top.score.weighted.location_match +
      top.score.weighted.recency;
    expect(sum).toBeCloseTo(top.score.total, 6);

    expect(ranked[0]!.score.total).toBeGreaterThan(ranked[ranked.length - 1]!.score.total);
  });

  it("digest keeps digestSize rows and stage counts match the funnel", () => {
    const dataset = getDataset();
    const profile = getProfile();
    const result = runPipeline(dataset, profile);

    expect(result.stages.map((s) => s.id)).toEqual(["collect", "filter", "rank", "digest"]);
    expect(result.stages[0]!.count).toBe(dataset.records.length);
    expect(result.stages[1]!.count).toBe(dataset.records.length - result.rejected.length);
    expect(result.stages[2]!.count).toBe(result.ranked.length);
    expect(result.stages[3]!.count).toBe(result.digest.length);
    expect(result.digest).toHaveLength(Math.min(profile.digestSize, result.ranked.length));
    expect(result.digest.length).toBeGreaterThanOrEqual(8);
    expect(result.digest[0]!.rank).toBe(1);
  });

  it("scoreListing components respond to the profile preferences", () => {
    const dataset = getDataset();
    const profile = getProfile();
    const match = dataset.records.find((r) => r.title.startsWith("Platform engineer · ranking"));
    const miss = dataset.records.find((r) => r.title.includes("ingestion budgets"));
    expect(match).toBeDefined();
    expect(miss).toBeDefined();

    const high = scoreListing(match!, profile);
    const low = scoreListing(miss!, profile);
    expect(high.components.role_match).toBe(1);
    expect(high.components.focus_match).toBe(1);
    expect(high.total).toBeGreaterThan(low.total);
  });
});

describe("pipeline purity", () => {
  function pipelineSources(): string[] {
    const dir = join(APP_ROOT, "lib", "pipeline");
    return readdirSync(dir)
      .filter((name) => /\.(ts|tsx)$/.test(name))
      .map((name) => readFileSync(join(dir, name), "utf8"));
  }

  it("does not consult the clock or the environment", () => {
    const forbidden: Array<[string, RegExp]> = [
      ["Date.now", /\bDate\.now\b/],
      ["new Date()", /\bnew\s+Date\s*\(\s*\)/],
      ["performance.now", /\bperformance\.now\b/],
      ["process.env", /\bprocess\.env\b/],
      ["Math.random", /\bMath\.random\b/],
    ];

    for (const source of pipelineSources()) {
      for (const [label, pattern] of forbidden) {
        expect(source, `${label} must not appear in the pipeline`).not.toMatch(pattern);
      }
    }
  });
});
