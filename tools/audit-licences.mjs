#!/usr/bin/env node
/**
 * Direct-dependency licence audit.
 *
 * Discovers package.json manifests the same way tools/check-deps.mjs does, reads each direct
 * dependency's licence, and fails on anything outside the allowlist (including UNKNOWN — a package
 * that is in neither the lockfile nor an installed module is not a pass).
 *
 * The licence is read from the manifest's committed `package-lock.json` first, and from
 * `node_modules` only as a fallback. The lockfile is the primary source on purpose: the gate runs
 * this before any application has installed anything, so a check that required `node_modules`
 * failed on every fresh CI checkout while passing on an installed working tree. See
 * `resolveDependency` for the measurement.
 *
 * Usage:
 *   node tools/audit-licences.mjs
 *   node tools/audit-licences.mjs --list
 *   node tools/audit-licences.mjs --file PATH --modules DIR
 *
 * No third-party dependencies — Node built-ins only.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

/** The committed resolution record this check audits first. See `resolveDependency`. */
const lockFileName = "package-lock.json";

/**
 * SPDX identifiers this repository will redistribute. A decision, not a default.
 * Comparison is case-insensitive; the spellings below are the ones we accept.
 */
const ALLOWED = [
  "MIT",
  "MIT-0",
  "ISC",
  "0BSD",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "Apache-2.0",
  "Unlicense",
  "CC0-1.0",
  "BlueOak-1.0.0",
  "Python-2.0",
  "Zlib",
  "OFL-1.1",
  "CC-BY-4.0",
  "MPL-2.0",
  "WTFPL",
];

const ALLOWED_LOOKUP = new Map(ALLOWED.map((id) => [id.toLowerCase(), id]));

/**
 * @param {string} filePath
 * @returns {string}
 */
function readText(filePath) {
  return readFileSync(filePath, "utf8");
}

/**
 * Repository-relative when the path is inside the tree; never an absolute local path.
 * @param {string} absPath
 * @returns {string}
 */
function displayPath(absPath) {
  const rel = relative(REPO_ROOT, absPath);
  if (rel && !rel.startsWith(`..${sep}`) && !rel.startsWith("..")) {
    return rel || ".";
  }
  return absPath.split(sep).join("/");
}

/**
 * Discover package.json paths to scan (root + each apps/<name>/package.json).
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
 * The committed lockfile next to a manifest, as `package name -> { version, raw licence }`.
 *
 * Only top-level entries are read: `node_modules/<name>` is a direct or hoisted package, while
 * `node_modules/<a>/node_modules/<b>` is a nested copy and is not a direct dependency. Returns null
 * when there is no readable lockfile, which is what makes the fixtures fall through to `--modules`.
 *
 * @param {string} manifestPath
 * @returns {Map<string, { version: string, raw: string }> | null}
 */
function readLockfileLicences(manifestPath) {
  const lockPath = join(dirname(manifestPath), lockFileName);
  if (!existsSync(lockPath)) {
    return null;
  }
  let data;
  try {
    data = JSON.parse(readText(lockPath));
  } catch {
    return null;
  }
  const packages = data && typeof data === "object" ? data.packages : null;
  if (!packages || typeof packages !== "object") {
    return null;
  }

  /** @type {Map<string, { version: string, raw: string }>} */
  const licences = new Map();
  for (const [key, entry] of Object.entries(packages)) {
    if (!key.startsWith("node_modules/")) {
      continue;
    }
    const name = key.slice("node_modules/".length);
    if (name.includes("node_modules/") || !entry || typeof entry !== "object") {
      continue;
    }
    const version =
      typeof entry.version === "string" && entry.version.trim() ? entry.version.trim() : "UNKNOWN";
    licences.set(name, { version, raw: licenceFromPackageJson(entry) });
  }
  return licences;
}

/**
 * Direct dependency names in declaration order: runtime first, then dev.
 * @param {{ dependencies: Record<string, string>, devDependencies: Record<string, string> }} manifest
 * @returns {string[]}
 */
function directNames(manifest) {
  const names = [];
  const seen = new Set();
  for (const pkg of Object.keys(manifest.dependencies)) {
    if (!seen.has(pkg)) {
      seen.add(pkg);
      names.push(pkg);
    }
  }
  for (const pkg of Object.keys(manifest.devDependencies)) {
    if (!seen.has(pkg)) {
      seen.add(pkg);
      names.push(pkg);
    }
  }
  return names;
}

/**
 * Read a licence identifier from an installed package manifest.
 * `license` (string, then object `.type`), then `licenses[].type`, then UNKNOWN.
 * @param {unknown} data
 * @returns {string}
 */
function licenceFromPackageJson(data) {
  if (!data || typeof data !== "object") {
    return "UNKNOWN";
  }
  const pkg = /** @type {Record<string, unknown>} */ (data);
  const license = pkg.license;
  if (typeof license === "string" && license.trim()) {
    return license.trim();
  }
  if (license && typeof license === "object") {
    const typed = /** @type {{ type?: unknown }} */ (license).type;
    if (typeof typed === "string" && typed.trim()) {
      return typed.trim();
    }
  }
  const licenses = pkg.licenses;
  if (Array.isArray(licenses) && licenses.length > 0) {
    const types = [];
    for (const entry of licenses) {
      if (entry && typeof entry === "object") {
        const typed = /** @type {{ type?: unknown }} */ (entry).type;
        if (typeof typed === "string" && typed.trim()) {
          types.push(typed.trim());
        }
      }
    }
    if (types.length === 1) {
      return types[0];
    }
    if (types.length > 1) {
      return types.join(" OR ");
    }
  }
  return "UNKNOWN";
}

/**
 * Canonical allowlist spelling when the identifier matches; otherwise the raw string.
 * @param {string} raw
 * @returns {string}
 */
function canonicalLicence(raw) {
  if (raw === "UNKNOWN") {
    return "UNKNOWN";
  }
  return ALLOWED_LOOKUP.get(raw.toLowerCase()) ?? raw;
}

/**
 * @param {string} licence
 * @returns {boolean}
 */
function isAllowed(licence) {
  return licence !== "UNKNOWN" && ALLOWED_LOOKUP.has(licence.toLowerCase());
}

/**
 * @typedef {{
 *   package: string,
 *   version: string,
 *   licence: string,
 *   conclusion: "compatible" | "incompatible" | "unknown",
 *   problem: string | null,
 * }} LicenceRow
 */

/**
 * Resolve one direct dependency against a modules directory.
 * @param {string} pkgName
 * @param {string} modulesDir
 * @returns {LicenceRow}
 */
/**
 * The licence of one direct dependency, from whichever source knows it.
 *
 * @param {string} pkgName
 * @param {string} version
 * @param {string} licence already canonicalised
 * @param {string} unknownReason what to say when the identifier could not be read
 * @returns {LicenceRow}
 */
function rowFor(pkgName, version, licence, unknownReason) {
  if (licence === "UNKNOWN") {
    return {
      package: pkgName,
      version,
      licence,
      conclusion: "unknown",
      problem: `licence is UNKNOWN (${unknownReason})`,
    };
  }
  if (!isAllowed(licence)) {
    return {
      package: pkgName,
      version,
      licence,
      conclusion: "incompatible",
      problem: `licence "${licence}" is not on the allowlist`,
    };
  }
  return { package: pkgName, version, licence, conclusion: "compatible", problem: null };
}

/**
 * Resolve one direct dependency, preferring the lockfile over the installed module.
 *
 * **The lockfile is the primary source, and that is not an implementation detail.** `tools/gate.sh`
 * runs this before any application has installed anything, because the apps install inside their
 * own `scripts/ci.sh` further down the gate. A check that read `node_modules` first therefore passed
 * locally, where the tree is already installed, and failed on **every** CI run, where a fresh
 * checkout has no `node_modules` at all: every package resolved to UNKNOWN.
 *
 * The lockfile is also the more honest artefact to audit. It is committed, so it is reviewable in
 * the pull request that adds a dependency, and it is what `npm ci` installs — so the licence this
 * check reads is the licence that ships.
 *
 * `--modules` still works and is what the fixtures use; a package absent from the lockfile falls
 * back to the installed module, and absent from both is UNKNOWN rather than a pass.
 *
 * @param {string} pkgName
 * @param {string} modulesDir
 * @param {Map<string, { version: string, raw: string }> | null} lockPackages
 * @returns {LicenceRow}
 */
function resolveDependency(pkgName, modulesDir, lockPackages) {
  const locked = lockPackages === null ? undefined : lockPackages.get(pkgName);
  if (locked !== undefined) {
    return rowFor(
      pkgName,
      locked.version,
      canonicalLicence(locked.raw),
      `${lockFileName} records no license field for this package`,
    );
  }

  const moduleJson = join(modulesDir, pkgName, "package.json");
  if (!existsSync(moduleJson)) {
    return {
      package: pkgName,
      version: "UNKNOWN",
      licence: "UNKNOWN",
      conclusion: "unknown",
      problem: `licence is UNKNOWN (not in ${lockFileName}, and no module at ${displayPath(join(modulesDir, pkgName))})`,
    };
  }

  let data;
  try {
    data = JSON.parse(readText(moduleJson));
  } catch {
    return {
      package: pkgName,
      version: "UNKNOWN",
      licence: "UNKNOWN",
      conclusion: "unknown",
      problem: "licence is UNKNOWN (installed package.json is not valid JSON)",
    };
  }

  const version =
    data && typeof data === "object" && typeof data.version === "string" && data.version.trim()
      ? data.version.trim()
      : "UNKNOWN";
  return rowFor(pkgName, version, canonicalLicence(licenceFromPackageJson(data)), "no license field");
}


/**
 * @param {string} manifestPath
 * @param {string} modulesDir
 * @returns {{ rows: LicenceRow[], errors: string[] }}
 */
function checkManifest(manifestPath, modulesDir) {
  const rel = displayPath(resolve(manifestPath));
  const { rows, errors } = { rows: /** @type {LicenceRow[]} */ ([]), errors: /** @type {string[]} */ ([]) };
  const names = directNames(readManifest(manifestPath));
  const lockPackages = readLockfileLicences(manifestPath);
  for (const pkgName of names) {
    const row = resolveDependency(pkgName, modulesDir, lockPackages);
    rows.push(row);
    if (row.problem) {
      errors.push(`${rel}: package "${pkgName}" ${row.problem}`);
    }
  }
  return { rows, errors };
}

/**
 * @param {LicenceRow[]} rows
 */
function printTable(rows) {
  /** @type {Map<string, { versions: Set<string>, licence: string, conclusion: string }>} */
  const byPackage = new Map();
  for (const row of rows) {
    const existing = byPackage.get(row.package);
    if (!existing) {
      byPackage.set(row.package, {
        versions: new Set([row.version]),
        licence: row.licence,
        conclusion: row.conclusion,
      });
      continue;
    }
    existing.versions.add(row.version);
    if (existing.licence !== row.licence) {
      existing.licence = `${existing.licence}; ${row.licence}`;
    }
    if (existing.conclusion !== "compatible") {
      // keep the worse conclusion
    } else if (row.conclusion !== "compatible") {
      existing.conclusion = row.conclusion;
    }
  }

  const names = [...byPackage.keys()].sort();
  console.log("| Package | Version | Licence | Conclusion |");
  console.log("| --- | --- | --- | --- |");
  for (const name of names) {
    const entry = byPackage.get(name);
    const versions = [...entry.versions].sort().join(", ");
    console.log(`| \`${name}\` | ${versions} | ${entry.licence} | ${entry.conclusion} |`);
  }
}

/**
 * @param {string[]} argv
 * @returns {{ mode: "all" | "file" | "list", filePath?: string, modulesDir?: string }}
 */
function parseArgs(argv) {
  const args = argv.slice(2);
  let mode = "all";
  let filePath;
  let modulesDir;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--list") {
      mode = "list";
    } else if (arg === "--file") {
      filePath = args[i + 1];
      if (!filePath) {
        console.error("audit-licences: --file requires a path");
        process.exit(2);
      }
      i += 1;
    } else if (arg === "--modules") {
      modulesDir = args[i + 1];
      if (!modulesDir) {
        console.error("audit-licences: --modules requires a path");
        process.exit(2);
      }
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node tools/audit-licences.mjs
  node tools/audit-licences.mjs --list
  node tools/audit-licences.mjs --file <path> --modules <dir>`);
      process.exit(0);
    } else {
      console.error(`audit-licences: unknown argument "${arg}"`);
      process.exit(2);
    }
  }

  if (filePath || modulesDir) {
    if (!filePath || !modulesDir) {
      console.error("audit-licences: --file and --modules must be used together");
      process.exit(2);
    }
    if (mode !== "list") {
      mode = "file";
    }
  }

  return { mode, filePath, modulesDir };
}

function main() {
  const { mode, filePath, modulesDir } = parseArgs(process.argv);
  const errors = [];
  /** @type {LicenceRow[]} */
  const allRows = [];

  if (mode === "file" || (mode === "list" && filePath)) {
    const absFile = resolve(REPO_ROOT, filePath);
    const absModules = resolve(REPO_ROOT, modulesDir);
    if (!existsSync(absFile)) {
      console.error(`audit-licences: manifest not found: ${displayPath(absFile)}`);
      process.exit(1);
    }

    const result = checkManifest(absFile, absModules);
    allRows.push(...result.rows);
    errors.push(...result.errors);

    if (mode === "list") {
      printTable(allRows);
    }

    if (errors.length > 0) {
      for (const err of errors) {
        console.error(`audit-licences: ${err}`);
      }
      process.exit(1);
    }

    if (mode !== "list") {
      const rel = displayPath(absFile);
      const { dependencies, devDependencies } = readManifest(absFile);
      console.log(
        `${rel}: ${Object.keys(dependencies).length} runtime, ${Object.keys(devDependencies).length} dev — licences ok`,
      );
    }
    process.exit(0);
  }

  const manifests = discoverManifests();
  for (const manifestPath of manifests) {
    const modules = join(dirname(manifestPath), "node_modules");
    const result = checkManifest(manifestPath, modules);
    allRows.push(...result.rows);
    errors.push(...result.errors);
  }

  if (mode === "list") {
    printTable(allRows);
    if (errors.length > 0) {
      for (const err of errors) {
        console.error(`audit-licences: ${err}`);
      }
      process.exit(1);
    }
    process.exit(0);
  }

  if (errors.length > 0) {
    for (const err of errors) {
      console.error(`audit-licences: ${err}`);
    }
    process.exit(1);
  }

  if (manifests.length === 0) {
    console.log("licence audit: no package.json manifests found");
    process.exit(0);
  }

  for (const manifestPath of manifests) {
    const rel = displayPath(manifestPath);
    const { dependencies, devDependencies } = readManifest(manifestPath);
    console.log(
      `${rel}: ${Object.keys(dependencies).length} runtime, ${Object.keys(devDependencies).length} dev — licences ok`,
    );
  }
  process.exit(0);
}

main();
