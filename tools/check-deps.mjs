#!/usr/bin/env node
/**
 * Dependency allowlist guard.
 *
 * Discovers package.json manifests, checks declared dependencies against
 * docs/DEPENDENCY_ALLOWLIST.md (plus per-app additive lists), and fails on:
 *   - unlisted packages
 *   - test-only packages in runtime dependencies
 *
 * Usage:
 *   node tools/check-deps.mjs              check all manifests
 *   node tools/check-deps.mjs --file PATH  check one manifest (fixture/testing)
 *   node tools/check-deps.mjs --list       print allowlist usage map
 *
 * No third-party dependencies — Node built-ins only.
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const ROOT_ALLOWLIST = join(REPO_ROOT, "docs", "DEPENDENCY_ALLOWLIST.md");

const SCOPE_RUNTIME = "runtime";
const SCOPE_DEV = "dev";
const SCOPE_TEST_ONLY = "test-only";

/** @typedef {{ package: string, range: string, scope: string }} AllowEntry */

/**
 * @param {string} filePath
 * @returns {string}
 */
function readText(filePath) {
  return readFileSync(filePath, "utf8");
}

/**
 * Parse the packages table from an allowlist markdown file.
 * @param {string} filePath
 * @param {{ required?: boolean, label?: string }} [options] when `required`, an absent or empty
 *   packages table is an error rather than an empty map.
 * @returns {{ entries: Map<string, AllowEntry>, errors: string[] }}
 */
function parseAllowlist(filePath, options = {}) {
  const { required = false, label = filePath } = options;
  const entries = new Map();

  if (!existsSync(filePath)) {
    if (required) {
      return { entries, errors: [`${label}: allowlist file is missing`] };
    }
    return { entries, errors: [] };
  }

  const text = readText(filePath);
  const lines = text.split("\n");
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("| Package")) {
      inTable = true;
      continue;
    }
    if (!inTable) {
      continue;
    }
    if (!trimmed.startsWith("| `")) {
      if (trimmed.startsWith("|") && trimmed.includes("---")) {
        continue;
      }
      if (entries.size > 0) {
        break;
      }
      continue;
    }

    const cells = trimmed
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cells.length < 3) {
      continue;
    }

    const pkg = cells[0].replace(/^`|`$/g, "");
    const range = cells[1].replace(/^`|`$/g, "");
    const scope = cells[2].replace(/^`|`$/g, "");
    entries.set(pkg, { package: pkg, range, scope });
  }

  const errors = [];
  // A present-but-empty table is the dangerous case: policy can be silently absent while every
  // check that iterates declared dependencies still passes.
  if (required && entries.size === 0) {
    errors.push(`${label}: no packages parsed — the packages table is missing or malformed`);
  }

  return { entries, errors };
}

/**
 * Merge app allowlist into root. App entries must not contradict root scope.
 * @param {Map<string, AllowEntry>} root
 * @param {Map<string, AllowEntry>} app
 * @param {string} appLabel
 * @returns {{ merged: Map<string, AllowEntry>, errors: string[] }}
 */
function mergeAllowlists(root, app, appLabel) {
  const merged = new Map(root);
  const errors = [];

  for (const [pkg, entry] of app) {
    const existing = root.get(pkg);
    if (existing && existing.scope !== entry.scope) {
      errors.push(
        `${appLabel}: allowlist contradicts root for "${pkg}" (root: ${existing.scope}, app: ${entry.scope})`,
      );
      continue;
    }
    merged.set(pkg, entry);
  }

  return { merged, errors };
}

/**
 * Resolve the allowlist for a manifest path.
 * @param {string} manifestPath
 * @returns {{ allowlist: Map<string, AllowEntry>, errors: string[] }}
 */
function allowlistForManifest(manifestPath) {
  const { entries: root, errors: rootErrors } = parseAllowlist(ROOT_ALLOWLIST, {
    required: true,
    label: "root allowlist",
  });
  const absManifest = resolve(manifestPath);
  const rel = relative(REPO_ROOT, absManifest);
  const errors = [...rootErrors];

  const parts = rel.split(sep);
  if (parts[0] === "apps" && parts.length >= 2) {
    const appAllowlist = join(REPO_ROOT, "apps", parts[1], "docs", "DEPENDENCY_ALLOWLIST.md");
    const { entries: appEntries } = parseAllowlist(appAllowlist);
    const merged = mergeAllowlists(root, appEntries, `apps/${parts[1]}`);
    return { allowlist: merged.merged, errors: [...errors, ...merged.errors] };
  }

  return { allowlist: root, errors };
}

/**
 * Combined allowlist across the repository (root + every app additive list).
 * @returns {{ allowlist: Map<string, AllowEntry>, errors: string[] }}
 */
function combinedAllowlist() {
  const { entries: root, errors } = parseAllowlist(ROOT_ALLOWLIST, {
    required: true,
    label: "root allowlist",
  });
  const merged = new Map(root);

  const appsDir = join(REPO_ROOT, "apps");
  if (existsSync(appsDir)) {
    for (const name of readdirSync(appsDir)) {
      const appDir = join(appsDir, name);
      if (!statSync(appDir).isDirectory()) {
        continue;
      }
      const appAllowlist = join(appDir, "docs", "DEPENDENCY_ALLOWLIST.md");
      const { entries: appEntries } = parseAllowlist(appAllowlist);
      const result = mergeAllowlists(merged, appEntries, `apps/${name}`);
      errors.push(...result.errors);
      for (const [pkg, entry] of result.merged) {
        merged.set(pkg, entry);
      }
    }
  }

  return { allowlist: merged, errors };
}

/**
 * Discover package.json paths to scan.
 * @returns {string[]}
 */
function discoverManifests() {
  const manifests = [];
  const rootManifest = join(REPO_ROOT, "package.json");
  if (existsSync(rootManifest)) {
    manifests.push(rootManifest);
  }

  const appsDir = join(REPO_ROOT, "apps");
  if (existsSync(appsDir)) {
    for (const name of readdirSync(appsDir)) {
      const manifest = join(appsDir, name, "package.json");
      if (existsSync(manifest)) {
        manifests.push(manifest);
      }
    }
  }

  return manifests.sort();
}

/**
 * @param {string} manifestPath
 * @returns {{ dependencies: Record<string, string>, devDependencies: Record<string, string> }}
 */
function readManifest(manifestPath) {
  const data = JSON.parse(readText(manifestPath));
  return {
    dependencies: data.dependencies ?? {},
    devDependencies: data.devDependencies ?? {},
  };
}

/**
 * @param {string} manifestPath
 * @param {Map<string, AllowEntry>} allowlist
 * @returns {string[]}
 */
function checkManifest(manifestPath, allowlist) {
  const errors = [];
  const rel = relative(REPO_ROOT, resolve(manifestPath)) || "package.json";
  const { dependencies, devDependencies } = readManifest(manifestPath);

  const declared = new Map();
  for (const [pkg, range] of Object.entries(dependencies)) {
    declared.set(pkg, { block: "dependencies", range });
  }
  for (const [pkg, range] of Object.entries(devDependencies)) {
    declared.set(pkg, { block: "devDependencies", range });
  }

  for (const [pkg, info] of declared) {
    const entry = allowlist.get(pkg);
    if (!entry) {
      errors.push(`${rel}: unlisted package "${pkg}" in ${info.block}`);
      continue;
    }

    if (entry.scope === SCOPE_TEST_ONLY && info.block === "dependencies") {
      errors.push(
        `${rel}: test-only package "${pkg}" must not appear in dependencies (use devDependencies)`,
      );
    } else if (entry.scope === SCOPE_DEV && info.block === "dependencies") {
      errors.push(
        `${rel}: dev-only package "${pkg}" must not appear in dependencies (use devDependencies)`,
      );
    } else if (entry.scope === SCOPE_RUNTIME && info.block === "devDependencies") {
      // Runtime packages may also appear in devDependencies (e.g. types tooling); not an error.
    }
  }

  return errors;
}

/**
 * @param {Map<string, AllowEntry>} allowlist
 * @param {string[]} manifests
 */
function printList(allowlist, manifests) {
  const usage = new Map();
  for (const pkg of allowlist.keys()) {
    usage.set(pkg, []);
  }

  for (const manifestPath of manifests) {
    const rel = relative(REPO_ROOT, resolve(manifestPath)) || "package.json";
    const { dependencies, devDependencies } = readManifest(manifestPath);
    for (const pkg of Object.keys(dependencies)) {
      if (usage.has(pkg)) {
        usage.get(pkg).push(`${rel} (dependencies)`);
      }
    }
    for (const pkg of Object.keys(devDependencies)) {
      if (usage.has(pkg)) {
        usage.get(pkg).push(`${rel} (devDependencies)`);
      }
    }
  }

  const packages = [...allowlist.keys()].sort();
  for (const pkg of packages) {
    const entry = allowlist.get(pkg);
    const sites = usage.get(pkg) ?? [];
    const where = sites.length > 0 ? sites.join(", ") : "(unused)";
    console.log(`${pkg}\t${entry.scope}\t${entry.range}\t${where}`);
  }
}

/**
 * @param {string[]} manifests
 */
function printSummary(manifests) {
  if (manifests.length === 0) {
    console.log("dependency check: no package.json manifests found");
    return;
  }

  for (const manifestPath of manifests) {
    const rel = relative(REPO_ROOT, resolve(manifestPath)) || "package.json";
    const { dependencies, devDependencies } = readManifest(manifestPath);
    const depCount = Object.keys(dependencies).length;
    const devCount = Object.keys(devDependencies).length;
    console.log(`${rel}: ${depCount} runtime, ${devCount} dev — ok`);
  }
}

/**
 * @param {string[]} argv
 * @returns {{ mode: "all" | "file" | "list", filePath?: string }}
 */
function parseArgs(argv) {
  const args = argv.slice(2);
  let mode = "all";
  let filePath;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--list") {
      mode = "list";
    } else if (arg === "--file") {
      mode = "file";
      filePath = args[i + 1];
      if (!filePath) {
        console.error("check-deps: --file requires a path");
        process.exit(2);
      }
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node tools/check-deps.mjs
  node tools/check-deps.mjs --file <path>
  node tools/check-deps.mjs --list`);
      process.exit(0);
    } else {
      console.error(`check-deps: unknown argument "${arg}"`);
      process.exit(2);
    }
  }

  return { mode, filePath };
}

function main() {
  const { mode, filePath } = parseArgs(process.argv);
  const errors = [];

  if (!existsSync(ROOT_ALLOWLIST)) {
    console.error("check-deps: missing docs/DEPENDENCY_ALLOWLIST.md");
    process.exit(1);
  }

  if (mode === "file") {
    const absFile = resolve(REPO_ROOT, filePath);
    if (!existsSync(absFile)) {
      console.error(`check-deps: manifest not found: ${relative(REPO_ROOT, absFile)}`);
      process.exit(1);
    }

    const { allowlist, errors: mergeErrors } = allowlistForManifest(absFile);
    errors.push(...mergeErrors);
    errors.push(...checkManifest(absFile, allowlist));

    if (errors.length > 0) {
      for (const err of errors) {
        console.error(`check-deps: ${err}`);
      }
      process.exit(1);
    }

    const rel = relative(REPO_ROOT, absFile) || filePath;
    const { dependencies, devDependencies } = readManifest(absFile);
    console.log(
      `${rel}: ${Object.keys(dependencies).length} runtime, ${Object.keys(devDependencies).length} dev — ok`,
    );
    process.exit(0);
  }

  const { allowlist, errors: mergeErrors } = combinedAllowlist();
  errors.push(...mergeErrors);

  const manifests = discoverManifests();

  if (mode === "list") {
    // Inspection must not hide a contradiction: print the map, then report what is wrong and
    // exit non-zero. Exiting early here would let `--list` look healthy while the normal check
    // failed on the same tree.
    printList(allowlist, manifests);
    const listErrors = [...new Set(mergeErrors)];
    if (listErrors.length > 0) {
      for (const err of listErrors) {
        console.error(`check-deps: ${err}`);
      }
      process.exit(1);
    }
    process.exit(0);
  }

  for (const manifestPath of manifests) {
    const { allowlist: manifestAllowlist, errors: manifestMergeErrors } =
      allowlistForManifest(manifestPath);
    errors.push(...manifestMergeErrors);
    errors.push(...checkManifest(manifestPath, manifestAllowlist));
  }

  // The same root-allowlist error is produced once per manifest; report it once.
  const uniqueErrors = [...new Set(errors)];
  if (uniqueErrors.length > 0) {
    for (const err of uniqueErrors) {
      console.error(`check-deps: ${err}`);
    }
    process.exit(1);
  }

  printSummary(manifests);
  process.exit(0);
}

main();
