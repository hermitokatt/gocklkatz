#!/usr/bin/env node
/**
 * Audit every published numeric claim the mechanical scanners can see, plus the four
 * landing-page card claims, and record provenance in `docs/CLAIM_AUDIT.md`.
 *
 * Discovery is from the tracked tree (`git ls-files`) and from `src/lib/demos.ts`. It does not
 * read node_modules or any build output. `--check` therefore works on a fresh clone.
 * `--write` will run each application's `npm run test` when that command is runnable, to record
 * the observed counts; a missing install is reported rather than treated as a pass.
 *
 * Usage:
 *   node tools/audit-published-claims.mjs            list every claim with kind and provenance
 *   node tools/audit-published-claims.mjs --write    regenerate docs/CLAIM_AUDIT.md
 *   node tools/audit-published-claims.mjs --check    fail when a discovered claim is unrecorded
 *
 * Node built-ins only.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const AUDIT_PATH = join(REPO_ROOT, "docs", "CLAIM_AUDIT.md");
const AUDIT_REL = "docs/CLAIM_AUDIT.md";
const DEMOS_REL = "src/lib/demos.ts";

const KINDS = ["measurement", "citation", "parameter"];

const BINARY_EXT = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "ico",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "eot",
  "wasm",
  "zip",
  "gz",
  "pdf",
]);

/**
 * Prose counts the ticket names: NN tests, NN route(s), NN URL(s), NN application(s),
 * NN project(s). The `(s)` form is what `docs/DEPLOY.md` actually publishes.
 */
const PROSE_RE =
  /\b(\d+)\s+(tests?|route(?:\(s\)|s)?|URL(?:\(s\)|s)?|application(?:\(s\)|s)?|project(?:\(s\)|s)?)(?!\w)/g;

/**
 * @param {string} rel
 * @returns {boolean}
 */
function skipFile(rel) {
  const base = rel.split("/").pop() ?? rel;
  if (base === "package-lock.json") {
    return true;
  }
  if (rel === AUDIT_REL || rel === "docs/LINK_AUDIT.md") {
    return true;
  }
  const ext = (base.split(".").pop() ?? "").toLowerCase();
  return BINARY_EXT.has(ext);
}

/**
 * @returns {string[]}
 */
function trackedFiles() {
  const result = spawnSync("git", ["ls-files", "-z"], {
    cwd: REPO_ROOT,
    encoding: "buffer",
  });
  if (result.status !== 0) {
    const err = (result.stderr ?? Buffer.alloc(0)).toString("utf8").trim();
    throw new Error(`git ls-files failed: ${err || `exit ${result.status}`}`);
  }
  return result.stdout
    .toString("utf8")
    .split("\0")
    .filter((rel) => rel !== "" && !skipFile(rel));
}

/**
 * @param {string} rel
 * @returns {string | null}
 */
function readTracked(rel) {
  const abs = join(REPO_ROOT, rel);
  if (!existsSync(abs)) {
    return null;
  }
  const buf = readFileSync(abs);
  if (buf.includes(0)) {
    return null;
  }
  return buf.toString("utf8");
}

/**
 * @typedef {{
 *   id: string,
 *   claim: string,
 *   where: string,
 *   kind: string,
 *   provenance: string,
 *   observed: string,
 *   date: string,
 *   verdict: string,
 * }} ClaimRow
 */

/**
 * @param {string} text
 * @returns {{ slug: string, name: string, url: string, status: string, text: string, source: string, command: string }[]}
 */
function parseDemos(text) {
  /** @type {{ slug: string, name: string, url: string, status: string, text: string, source: string, command: string }[]} */
  const demos = [];
  const re =
    /slug:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?url:\s*"([^"]+)"[\s\S]*?status:\s*"([^"]+)"[\s\S]*?claim:\s*\{[\s\S]*?text:\s*"([^"]+)"[\s\S]*?source:\s*"([^"]+)"[\s\S]*?command:\s*"([^"]+)"/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    demos.push({
      slug: match[1] ?? "",
      name: match[2] ?? "",
      url: match[3] ?? "",
      status: match[4] ?? "",
      text: match[5] ?? "",
      source: match[6] ?? "",
      command: match[7] ?? "",
    });
  }
  return demos;
}

/**
 * @param {string} unit
 * @param {string} file
 * @param {string} snippet
 * @returns {{ kind: string, provenance: string, verdict: string }}
 */
function classifyProse(unit, file, snippet) {
  const lower = unit.toLowerCase();
  const around = snippet.toLowerCase();

  if (file === "docs/DEPLOY.md" && /bytes|illustrative/.test(around)) {
    return {
      kind: "measurement",
      provenance:
        "quoted output of `bash tools/verify-live.sh` / `bash tools/verify-deployments.sh`; labelled illustrative in that document because byte counts drift",
      verdict: "illustrative — not re-measured into a moving target",
    };
  }

  if (lower.startsWith("test")) {
    if (file.startsWith("apps/") && file.includes("/")) {
      const app = file.split("/")[1];
      return {
        kind: "measurement",
        provenance: `cd apps/${app} && npm run test`,
        verdict: "recorded",
      };
    }
    if (file === "docs/DEPLOY.md" || file.startsWith("docs/") || file.startsWith("tools/")) {
      return {
        kind: "measurement",
        provenance: "self-test or gate documentation; see the command named on the same line",
        verdict: "recorded",
      };
    }
    return {
      kind: "measurement",
      provenance: `published in \`${file}\`; reproducing command is the nearest named test command`,
      verdict: "recorded",
    };
  }

  if (lower.startsWith("route") || lower.startsWith("url")) {
    const cmd = lower.startsWith("url")
      ? "bash tools/verify-live.sh"
      : "bash tools/verify-deployments.sh";
    return {
      kind: "measurement",
      provenance: cmd,
      verdict: "recorded",
    };
  }

  if (lower.startsWith("application") || lower.startsWith("project")) {
    return {
      kind: "parameter",
      provenance: "`repo.config` (one `app` block per application / Vercel project)",
      verdict: "declared",
    };
  }

  return {
    kind: "parameter",
    provenance: `\`${file}\``,
    verdict: "declared",
  };
}

/**
 * Mechanical discovery used by `--check`: card claims from `src/lib/demos.ts` plus prose
 * counts in tracked markdown. Does not spawn npm and does not read node_modules.
 *
 * @returns {ClaimRow[]}
 */
function discoverClaims() {
  /** @type {ClaimRow[]} */
  const rows = [];
  const demosText = readTracked(DEMOS_REL);
  if (demosText === null) {
    throw new Error(`${DEMOS_REL} is not readable`);
  }
  for (const demo of parseDemos(demosText)) {
    const countMatch = /^(\d+) tests?\b/.exec(demo.text);
    rows.push({
      id: `card:${demo.slug}`,
      claim: demo.text,
      where: `${DEMOS_REL} (card "${demo.slug}", also the served landing page)`,
      kind: "measurement",
      provenance: `cd apps/${demo.slug} && ${demo.command}  (source ${demo.source})`,
      observed: countMatch ? `${countMatch[1]} tests (as published)` : "(no leading count)",
      date: "",
      verdict: "recorded",
    });
  }

  /** @type {Map<string, ClaimRow>} */
  const prose = new Map();
  for (const rel of trackedFiles()) {
    if (!rel.endsWith(".md")) {
      continue;
    }
    const text = readTracked(rel);
    if (text === null) {
      continue;
    }
    for (const match of text.matchAll(PROSE_RE)) {
      const matched = match[0] ?? "";
      const unit = match[2] ?? "";
      const index = match.index ?? 0;
      const snippet = text.slice(Math.max(0, index - 80), index + matched.length + 80);
      const key = `${rel}|${matched}`;
      if (prose.has(key)) {
        continue;
      }
      const classified = classifyProse(unit, rel, snippet);
      prose.set(key, {
        id: `prose:${rel}:${matched}`,
        claim: matched,
        where: rel,
        kind: classified.kind,
        provenance: classified.provenance,
        observed: matched,
        date: "",
        verdict: classified.verdict,
      });
    }
  }
  rows.push(...prose.values());
  return rows;
}

/**
 * @returns {{ dir: string, name: string }[]}
 */
function discoverTestApps() {
  /** @type {{ dir: string, name: string }[]} */
  const apps = [];
  for (const rel of trackedFiles()) {
    if (rel !== "package.json" && !/^apps\/[^/]+\/package\.json$/.test(rel)) {
      continue;
    }
    const text = readTracked(rel);
    if (text === null) {
      continue;
    }
    let manifest;
    try {
      manifest = JSON.parse(text);
    } catch {
      continue;
    }
    if (!manifest || typeof manifest !== "object" || !manifest.scripts || !manifest.scripts.test) {
      continue;
    }
    const dir = rel === "package.json" ? "." : rel.slice(0, -"/package.json".length);
    apps.push({ dir, name: typeof manifest.name === "string" ? manifest.name : dir });
  }
  return apps.sort((a, b) => a.dir.localeCompare(b.dir));
}

/**
 * @param {string} output
 * @returns {string | null}
 */
function parseVitestCount(output) {
  const match = /Tests\s+(\d+)\s+passed/.exec(output);
  return match && match[1] ? match[1] : null;
}

/**
 * @param {string} dir
 * @returns {{ ok: boolean, count: string | null, output: string }}
 */
function runNpmTest(dir) {
  const abs = join(REPO_ROOT, dir);
  const vitestBin = join(abs, "node_modules", "vitest", "vitest.mjs");
  const hasInstall = existsSync(join(abs, "node_modules"));
  if (!hasInstall && !existsSync(vitestBin)) {
    return {
      ok: false,
      count: null,
      output: `(not run: ${dir === "." ? "." : dir}/node_modules is absent — --check does not require it)`,
    };
  }
  const result = spawnSync("npm", ["run", "test"], {
    cwd: abs,
    encoding: "utf8",
    env: { ...process.env },
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const count = parseVitestCount(output);
  return {
    ok: result.status === 0 && count !== null,
    count,
    output,
  };
}

/**
 * @param {string} markdown
 * @returns {Set<string>}
 */
function parseClaimIds(markdown) {
  const ids = new Set();
  const start = markdown.indexOf("<!-- BEGIN CLAIM_AUDIT_ROWS");
  const end = markdown.indexOf("END CLAIM_AUDIT_ROWS -->");
  if (start === -1 || end === -1 || end <= start) {
    return ids;
  }
  const block = markdown.slice(start, end);
  for (const line of block.split("\n")) {
    if (!line.startsWith("row\t")) {
      continue;
    }
    const id = line.split("\t")[1] ?? "";
    if (id !== "") {
      ids.add(id);
    }
  }
  return ids;
}

/**
 * @param {string} markdown
 * @param {string} name
 * @returns {string}
 */
function readPreserve(markdown, name) {
  const re = new RegExp(
    `<!-- BEGIN PRESERVE:${name} -->([\\s\\S]*?)<!-- END PRESERVE:${name} -->`,
  );
  const match = re.exec(markdown);
  return match ? (match[1] ?? "").trim() : "";
}

/**
 * @param {string} name
 * @param {string} body
 * @returns {string}
 */
function wrapPreserve(name, body) {
  const inner = body.trim() === "" ? "" : `\n${body.trim()}\n`;
  return `<!-- BEGIN PRESERVE:${name} -->${inner}<!-- END PRESERVE:${name} -->`;
}

/**
 * @param {string} value
 * @returns {string}
 */
function cell(value) {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/**
 * @param {ClaimRow[]} rows
 * @param {string} date
 * @param {string} command
 * @param {Record<string, string>} preserved
 * @returns {string}
 */
function renderDocument(rows, date, command, preserved) {
  const counts = Object.fromEntries(KINDS.map((k) => [k, 0]));
  for (const row of rows) {
    if (counts[row.kind] !== undefined) {
      counts[row.kind] += 1;
    }
  }

  const machine = ["<!-- BEGIN CLAIM_AUDIT_ROWS"];
  for (const row of rows) {
    machine.push(`row\t${row.id}\t${row.kind}\t${row.claim}`);
  }
  machine.push("END CLAIM_AUDIT_ROWS -->");

  /** @type {string[]} */
  const lines = [];
  lines.push("# Published-claim audit");
  lines.push("");
  lines.push(
    "Every claim this scanner can discover from the tracked tree, with its kind and provenance. Discovery is mechanical: the four landing-page card claims in `src/lib/demos.ts`, prose counts in tracked markdown matching `NN tests` / `NN route(s)` / `NN URL(s)` / `NN application(s)` / `NN project(s)`, and (on `--write`) each application's `npm run test` count. `--check` re-runs the first two and fails if a discovered claim is absent from this file.",
  );
  lines.push("");
  lines.push(`- **Date of audit:** ${date} (UTC date)`);
  lines.push(`- **Command:** \`${command}\``);
  lines.push(
    "- **Kinds:** `measurement` (a number about this repository), `citation` (a number about the outside world), `parameter` (an input, not a result).",
  );
  lines.push("");
  lines.push("## Counts");
  lines.push("");
  lines.push("| Kind | Count |");
  lines.push("| --- | ---: |");
  lines.push(`| \`measurement\` | ${counts.measurement} |`);
  lines.push(`| \`citation\` | ${counts.citation} |`);
  lines.push(`| \`parameter\` | ${counts.parameter} |`);
  lines.push(`| **total** | **${rows.length}** |`);
  lines.push("");
  lines.push(
    "These are the rows the scanner discovers **mechanically**. Numbers it cannot reach by rule — declared `parameter`s and figures cited from outside sources — are listed by hand in the inventory further down, so a zero above does not mean there are none.",
  );
  lines.push("");
  lines.push("## Table");
  lines.push("");
  lines.push("| Claim | Where | Kind | Provenance | Observed | Date | Verdict |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const row of rows) {
    lines.push(
      `| ${cell(row.claim)} | ${cell(row.where)} | \`${row.kind}\` | ${cell(row.provenance)} | ${cell(row.observed)} | ${row.date} | ${cell(row.verdict)} |`,
    );
  }
  lines.push("");
  lines.push("## A-2 — card claims, observed `npm run test`");
  lines.push("");
  lines.push(wrapPreserve("a2", preserved.a2 ?? ""));
  lines.push("");
  lines.push("## Findings — removed or flagged");
  lines.push("");
  lines.push(wrapPreserve("findings", preserved.findings ?? ""));
  lines.push("");
  lines.push("## Further inventory (not all mechanically discovered)");
  lines.push("");
  lines.push(wrapPreserve("inventory", preserved.inventory ?? ""));
  lines.push("");
  lines.push("## Re-running");
  lines.push("");
  lines.push(
    "A later reader re-runs `node tools/audit-published-claims.mjs --check`. That command re-discovers card claims and markdown prose counts from the tracked tree and fails if any of them is missing from this document. It does not spawn `npm`, does not read `node_modules`, and does not compare the date column.",
  );
  lines.push("");
  lines.push(machine.join("\n"));
  lines.push("");
  return lines.join("\n");
}

/**
 * @param {string[]} argv
 * @returns {Promise<number>}
 */
async function main(argv) {
  const write = argv.includes("--write");
  const check = argv.includes("--check");
  if (write && check) {
    console.error("audit-published-claims: use one of --write or --check, not both");
    return 2;
  }

  const discovered = discoverClaims();
  if (discovered.length === 0) {
    console.error("audit-published-claims: discovered no claims; the scanner would be a no-op");
    return 1;
  }

  if (check) {
    if (!existsSync(AUDIT_PATH)) {
      console.error(`audit-published-claims: ${AUDIT_REL} is missing`);
      return 1;
    }
    const markdown = readFileSync(AUDIT_PATH, "utf8");
    const recorded = parseClaimIds(markdown);
    if (recorded.size === 0) {
      console.error(
        `audit-published-claims: ${AUDIT_REL} has no machine-readable rows; regenerate with --write`,
      );
      return 1;
    }
    /** @type {string[]} */
    const failures = [];
    for (const row of discovered) {
      if (!recorded.has(row.id)) {
        failures.push(`unrecorded: ${row.id} — "${row.claim}" in ${row.where}`);
      }
    }
    if (failures.length > 0) {
      for (const line of failures) {
        console.error(`audit-published-claims: FAIL ${line}`);
      }
      console.error(`audit-published-claims: ${failures.length} failure(s)`);
      return 1;
    }
    console.log(
      `audit-published-claims: ${AUDIT_REL} records every discovered claim (${discovered.length})`,
    );
    return 0;
  }

  const date = new Date().toISOString().slice(0, 10);
  /** @type {ClaimRow[]} */
  const rows = discovered.map((row) => ({ ...row, date }));

  /** @type {string[]} */
  const testEvidence = [];
  if (write || argv.length === 0) {
    const apps = discoverTestApps();
    for (const app of apps) {
      const result = runNpmTest(app.dir);
      // "Where" means where the claim is PUBLISHED, and for a suite row it is not published in the
      // manifest at all — the manifest only declares the command, and the landing page's 67 appears
      // nowhere as prose. Naming the manifest alone sent a reader to a file the number is not in, so
      // the cell says what the file actually is.
      const manifest = app.dir === "." ? "package.json" : `${app.dir}/package.json`;
      const where = `${manifest} — the count is not written in this file; it is measured by its \`test\` script`;
      const observed = result.count === null ? "not observed" : `${result.count} tests passed`;
      const id = `suite:${app.dir === "." ? "landing" : app.dir}`;
      rows.push({
        id,
        claim: result.count === null ? `${app.name} test suite` : `${result.count} tests`,
        where,
        kind: "measurement",
        provenance: `${app.dir === "." ? "" : `cd ${app.dir} && `}npm run test`,
        observed,
        date,
        verdict: result.ok ? "reproduced" : "not reproduced this run",
      });
      const header = `### ${app.name} (\`${app.dir === "." ? "." : app.dir}\`)`;
      const snippet = result.output
        .split("\n")
        .filter((line) => /Tests\s+\d+\s+passed|Test Files|FAIL|failed/.test(line))
        .join("\n");
      testEvidence.push(
        `${header}\n\n\`\`\`\n${snippet || result.output.trim().slice(-800)}\n\`\`\`\n`,
      );
      const label = result.ok ? "ok   " : "FAIL ";
      console.log(`  ${label} ${app.dir === "." ? "." : app.dir}: ${observed}`);
    }
  }

  rows.sort((a, b) => a.id.localeCompare(b.id) || a.claim.localeCompare(b.claim));

  for (const row of rows) {
    if (!row.id.startsWith("card:")) {
      continue;
    }
    const slug = row.id.slice("card:".length);
    const suite = rows.find((candidate) => candidate.id === `suite:apps/${slug}`);
    if (!suite || suite.verdict !== "reproduced") {
      continue;
    }
    const published = /^(\d+)/.exec(row.claim);
    const observed = /^(\d+)/.exec(suite.observed);
    if (published && observed && published[1] === observed[1]) {
      row.verdict = "reproduced";
      row.observed = suite.observed;
    } else {
      row.verdict = "mismatch — published count does not match npm run test";
      row.observed = suite.observed;
    }
  }

  if (!write) {
    console.log(`audit-published-claims: ${rows.length} claim(s)`);
    console.log("");
    console.log("| id | kind | claim | where |");
    console.log("| --- | --- | --- | --- |");
    for (const row of rows) {
      console.log(`| ${row.id} | ${row.kind} | ${row.claim} | ${row.where} |`);
    }
    return 0;
  }

  let preserved = { a2: "", findings: "", inventory: "" };
  if (existsSync(AUDIT_PATH)) {
    const previous = readFileSync(AUDIT_PATH, "utf8");
    preserved = {
      a2: readPreserve(previous, "a2"),
      findings: readPreserve(previous, "findings"),
      inventory: readPreserve(previous, "inventory"),
    };
  }
  if (preserved.a2 === "" && testEvidence.length > 0) {
    preserved.a2 = testEvidence.join("\n");
  }
  if (preserved.findings === "") {
    preserved.findings =
      "_Fill after the audit: every claim that could not be reproduced, and every published number removed for want of provenance._";
  }
  if (preserved.inventory === "") {
    preserved.inventory =
      "_Fill after the audit: ports, allowlist ranges, citations, seed length, and any published number the mechanical scanner does not name._";
  }

  writeFileSync(
    AUDIT_PATH,
    renderDocument(rows, date, "node tools/audit-published-claims.mjs --write", preserved),
    "utf8",
  );
  console.log(`wrote ${AUDIT_REL} (${rows.length} row(s))`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
