#!/usr/bin/env node
/**
 * Proves the dependency allowlist guard both passes on the real tree and fails when it should.
 *
 * Every failure case below is a must-fail fixture: a guard that has never been seen to fail is
 * not a guard (AGENTS.md section 6). The empty-allowlist and test-only cases were both found by
 * an independent review probe, not by the implementer.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const GUARD = join(REPO_ROOT, "tools", "check-deps.mjs");
const ROOT_ALLOWLIST = join(REPO_ROOT, "docs", "DEPENDENCY_ALLOWLIST.md");
const FIXTURE_DIR = join(REPO_ROOT, "var", "dep-check-test");

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

function runNode(args) {
  return spawnSync(process.execPath, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
}

/** Write a manifest into the fixture directory. */
function writeFixtureManifest(name, body) {
  const dir = join(FIXTURE_DIR, name);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "package.json");
  writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`);
  return file;
}

console.log("dependency allowlist guard self-test");

// --- 1. real repository passes ------------------------------------------------
const real = runNode([GUARD]);
const realOut = `${real.stdout}${real.stderr}`;
console.log("\ncase: real repository");
console.log(realOut.trimEnd());
assert("real repository exits 0", real.status === 0);
// Not merely "something was printed": the run must either report per-manifest results or state
// plainly that there was nothing to check. A silent pass is the failure mode this guards against.
assert(
  "real repository reports either a summary or an explicit empty result",
  /dependency check: no package\.json manifests found/.test(realOut) || /— ok/.test(realOut),
);
assert(
  "real repository does not report a policy error",
  !/no packages parsed|missing/.test(realOut),
);

// --- 2. unlisted package fixture fails and names the package ------------------
rmSync(FIXTURE_DIR, { recursive: true, force: true });
const unlisted = writeFixtureManifest("unlisted", {
  name: "fixture-unlisted",
  private: true,
  dependencies: { "not-on-the-allowlist": "^1.0.0" },
});
const fixture = runNode([GUARD, "--file", unlisted]);
const fixtureOut = `${fixture.stdout}${fixture.stderr}`;
console.log("\ncase: unlisted package fixture");
console.log(fixtureOut.trimEnd());
assert("fixture exits non-zero", fixture.status !== 0);
assert(
  'fixture names the package "not-on-the-allowlist"',
  fixtureOut.includes("not-on-the-allowlist"),
);

// --- 3. a test-only package in runtime dependencies fails ---------------------
const testOnly = writeFixtureManifest("test-only", {
  name: "fixture-test-only",
  private: true,
  dependencies: { playwright: "^1.0.0" },
});
const testOnlyRun = runNode([GUARD, "--file", testOnly]);
const testOnlyOut = `${testOnlyRun.stdout}${testOnlyRun.stderr}`;
console.log("\ncase: test-only package in runtime dependencies");
console.log(testOnlyOut.trimEnd());
assert("test-only in dependencies exits non-zero", testOnlyRun.status !== 0);
assert(
  "test-only failure names the package",
  testOnlyOut.includes("playwright"),
);

// --- 4. a present-but-empty allowlist must fail, with zero manifests ---------
// The dangerous case: policy silently absent while every check that iterates declared
// dependencies still passes. Found by an independent review probe.
const originalAllowlist = readFileSync(ROOT_ALLOWLIST, "utf8");
let emptyOut = "";
let emptyStatus = null;
try {
  writeFileSync(
    ROOT_ALLOWLIST,
    "# Dependency allowlist\n\n## Packages\n\n| Package | Declared range | Scope |\n| --- | --- | --- |\n",
  );
  const emptyRun = runNode([GUARD]);
  emptyOut = `${emptyRun.stdout}${emptyRun.stderr}`;
  emptyStatus = emptyRun.status;
} finally {
  writeFileSync(ROOT_ALLOWLIST, originalAllowlist);
}
console.log("\ncase: empty packages table");
console.log(emptyOut.trimEnd());
assert("empty allowlist exits non-zero", emptyStatus !== 0);
assert(
  "empty allowlist is reported as unparsed policy",
  /no packages parsed/.test(emptyOut),
);
assert(
  "allowlist restored after the empty-table case",
  readFileSync(ROOT_ALLOWLIST, "utf8") === originalAllowlist,
);

rmSync(FIXTURE_DIR, { recursive: true, force: true });

console.log(`\ndependency allowlist self-test: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
