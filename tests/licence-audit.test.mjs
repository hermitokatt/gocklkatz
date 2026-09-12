#!/usr/bin/env node
/**
 * Proves the licence audit both passes on the real tree and fails when it should.
 *
 * Every failure case below is a must-fail fixture: a guard that has never been seen to fail is
 * not a guard (AGENTS.md section 6). GPL-3.0-only, AGPL-3.0, and a missing license field are
 * the cases this suite exists to keep red.
 *
 * Runnable as `node tests/licence-audit.test.mjs` (gate self-test; Node built-ins only) or
 * `npx vitest run tests/licence-audit.test.mjs` (the ticket's evidence command).
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const TOOL = join(REPO_ROOT, "tools", "audit-licences.mjs");
const FIXTURE_DIR = join(REPO_ROOT, "var", "licence-audit-test");

function runNode(args) {
  return spawnSync(process.execPath, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
}

/**
 * @param {string} name
 * @param {{ manifest: object, modules: Record<string, object>, lockPackages?: Record<string, object> }} spec
 * @returns {{ file: string, modules: string }}
 */
function writeFixture(name, spec) {
  const dir = join(FIXTURE_DIR, name);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "package.json");
  writeFileSync(file, `${JSON.stringify(spec.manifest, null, 2)}\n`);
  const modules = join(dir, "node_modules");
  for (const [pkg, body] of Object.entries(spec.modules)) {
    const pkgDir = join(modules, pkg);
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(join(pkgDir, "package.json"), `${JSON.stringify(body, null, 2)}\n`);
  }
  if (spec.lockPackages !== undefined) {
    writeFileSync(
      join(dir, "package-lock.json"),
      `${JSON.stringify({ name: "fixture", lockfileVersion: 3, packages: spec.lockPackages }, null, 2)}\n`,
    );
  }
  return { file, modules };
}

function runAudit(file, modules) {
  return runNode([TOOL, "--file", file, "--modules", modules]);
}

function combined(result) {
  return `${result.stdout}${result.stderr}`;
}

const CASES = [
  {
    id: "real-repository",
    label: "real repository",
    run: () => {
      const result = runNode([TOOL]);
      return {
        result,
        checks: [
          { label: "real repository exits 0", ok: result.status === 0 },
          {
            label: "real repository reports per-manifest results",
            ok:
              /licence audit: no package\.json manifests found/.test(combined(result)) ||
              /— licences ok/.test(combined(result)),
          },
          {
            label: "real repository does not report UNKNOWN or an unallowlisted licence",
            ok: !/UNKNOWN|not on the allowlist/.test(combined(result)),
          },
        ],
      };
    },
  },
  {
    id: "mit-passes",
    label: "MIT fixture",
    run: () => {
      const { file, modules } = writeFixture("mit", {
        manifest: { name: "fixture-mit", private: true, dependencies: { "good-mit": "1.0.0" } },
        modules: { "good-mit": { name: "good-mit", version: "1.0.0", license: "MIT" } },
      });
      const result = runAudit(file, modules);
      return {
        result,
        checks: [
          { label: "MIT fixture exits 0", ok: result.status === 0 },
          { label: "MIT fixture reports licences ok", ok: /licences ok/.test(combined(result)) },
        ],
      };
    },
  },
  {
    id: "gpl-3.0-only",
    label: "GPL-3.0-only fixture",
    run: () => {
      const { file, modules } = writeFixture("gpl", {
        manifest: {
          name: "fixture-gpl",
          private: true,
          dependencies: { "copyleft-gpl": "1.0.0" },
        },
        modules: {
          "copyleft-gpl": { name: "copyleft-gpl", version: "1.0.0", license: "GPL-3.0-only" },
        },
      });
      const result = runAudit(file, modules);
      const out = combined(result);
      return {
        result,
        checks: [
          { label: "GPL-3.0-only fixture exits non-zero", ok: result.status !== 0 },
          { label: "GPL-3.0-only failure names the package", ok: out.includes("copyleft-gpl") },
          { label: "GPL-3.0-only failure names the licence", ok: out.includes("GPL-3.0-only") },
        ],
      };
    },
  },
  {
    id: "agpl-3.0",
    label: "AGPL-3.0 fixture",
    run: () => {
      const { file, modules } = writeFixture("agpl", {
        manifest: {
          name: "fixture-agpl",
          private: true,
          dependencies: { "copyleft-agpl": "1.0.0" },
        },
        modules: {
          "copyleft-agpl": { name: "copyleft-agpl", version: "1.0.0", license: "AGPL-3.0" },
        },
      });
      const result = runAudit(file, modules);
      const out = combined(result);
      return {
        result,
        checks: [
          { label: "AGPL-3.0 fixture exits non-zero", ok: result.status !== 0 },
          { label: "AGPL-3.0 failure names the package", ok: out.includes("copyleft-agpl") },
          { label: "AGPL-3.0 failure names the licence", ok: out.includes("AGPL-3.0") },
        ],
      };
    },
  },
  {
    id: "no-license-field",
    label: "missing license field",
    run: () => {
      const { file, modules } = writeFixture("nolicense", {
        manifest: {
          name: "fixture-nolicense",
          private: true,
          dependencies: { silent: "1.0.0" },
        },
        modules: { silent: { name: "silent", version: "1.0.0" } },
      });
      const result = runAudit(file, modules);
      const out = combined(result);
      return {
        result,
        checks: [
          { label: "missing license field exits non-zero", ok: result.status !== 0 },
          { label: "missing license field names the package", ok: out.includes("silent") },
          { label: "missing license field is reported as UNKNOWN", ok: out.includes("UNKNOWN") },
        ],
      };
    },
  },
  // The lockfile is the primary source, and these two cases are why it has to be.
  //
  // `tools/gate.sh` runs this audit **before** any application has installed anything, so on a
  // fresh CI checkout there is no `node_modules` to read. A version of this tool that required one
  // passed locally and failed on every CI run — every package resolving to UNKNOWN. These cases
  // assert the lockfile path on its own, with an empty modules directory, so that regression cannot
  // come back unnoticed.
  {
    id: "lockfile-gpl",
    label: "lockfile records GPL-3.0-only with no node_modules",
    run: () => {
      const { file, modules } = writeFixture("lockfile-gpl", {
        manifest: { name: "fixture-lock-gpl", private: true, dependencies: { copyleft: "1.0.0" } },
        modules: {},
        lockPackages: {
          "": { name: "fixture-lock-gpl" },
          "node_modules/copyleft": { version: "1.0.0", license: "GPL-3.0-only" },
        },
      });
      const result = runAudit(file, modules);
      const out = combined(result);
      return {
        result,
        checks: [
          { label: "lockfile GPL exits non-zero", ok: result.status !== 0 },
          { label: "lockfile GPL names the package", ok: out.includes("copyleft") },
          { label: "lockfile GPL names the licence", ok: out.includes("GPL-3.0-only") },
          { label: "lockfile GPL does not report a missing module", ok: !/no module at/.test(out) },
        ],
      };
    },
  },
  {
    id: "lockfile-mit-no-modules",
    label: "lockfile records MIT with no node_modules installed",
    run: () => {
      // The positive half of the case above: a clean tree with nothing installed must still pass,
      // because that is what the gate sees on a fresh CI checkout. If this ever needs node_modules,
      // the gate fails on every run.
      const { file, modules } = writeFixture("lockfile-mit", {
        manifest: { name: "fixture-lock-mit", private: true, dependencies: { permissive: "1.0.0" } },
        modules: {},
        lockPackages: {
          "": { name: "fixture-lock-mit" },
          "node_modules/permissive": { version: "1.0.0", license: "MIT" },
        },
      });
      const result = runAudit(file, modules);
      const out = combined(result);
      return {
        result,
        checks: [
          { label: "lockfile-only pass exits 0", ok: result.status === 0 },
          { label: "lockfile-only pass reports licences ok", ok: /licences ok/.test(out) },
          { label: "lockfile-only pass reads no module", ok: !/UNKNOWN/.test(out) },
        ],
      };
    },
  },
];

function runAsNode() {
  let pass = 0;
  let fail = 0;

  /**
   * @param {string} label
   * @param {boolean} ok
   */
  function assert(label, ok) {
    if (ok) {
      console.log(`  ok   ${label}`);
      pass += 1;
    } else {
      console.log(`  FAIL ${label}`);
      fail += 1;
    }
  }

  console.log("licence audit self-test");
  rmSync(FIXTURE_DIR, { recursive: true, force: true });

  for (const testCase of CASES) {
    const { result, checks } = testCase.run();
    console.log(`\ncase: ${testCase.label}`);
    console.log(combined(result).trimEnd());
    for (const check of checks) {
      assert(check.label, check.ok);
    }
  }

  rmSync(FIXTURE_DIR, { recursive: true, force: true });
  console.log(`\nlicence audit self-test: ${pass} passed, ${fail} failed`);
  return fail === 0 ? 0 : 1;
}

const isDirect =
  process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirect) {
  process.exit(runAsNode());
}

const { beforeAll, afterAll, describe, it, expect } = await import("vitest");

describe("licence audit", () => {
  beforeAll(() => {
    rmSync(FIXTURE_DIR, { recursive: true, force: true });
  });
  afterAll(() => {
    rmSync(FIXTURE_DIR, { recursive: true, force: true });
  });

  for (const testCase of CASES) {
    it(testCase.label, () => {
      const { result, checks } = testCase.run();
      console.log(`\ncase: ${testCase.label}`);
      console.log(combined(result).trimEnd());
      for (const check of checks) {
        expect(check.ok, check.label).toBe(true);
      }
    });
  }
});
