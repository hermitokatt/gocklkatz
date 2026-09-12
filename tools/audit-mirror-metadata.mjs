#!/usr/bin/env node
/**
 * Audit the public mirror's repository metadata against the record in docs/DEPLOY.md.
 *
 * GitHub's description, homepage and topics are settings on the public copy, not files inside this
 * repository, so nothing here can enforce them. `docs/DEPLOY.md` records them so a recreated mirror
 * can be configured from the same commit that configures everything else — but a record with
 * nothing comparing it to the remote goes stale silently: someone edits the description on GitHub,
 * or adds a topic, and the repository keeps asserting the old values.
 *
 * This is the other half. It reads both sides and compares them, and it is deliberately strict about
 * the difference between "agrees" and "could not check": a missing `gh`, missing credentials,
 * missing network, or a record it cannot parse is exit 2, never exit 0. That is the rule
 * `tools/guard.sh` follows when it refuses to call a tree clean that it did not scan.
 *
 * Usage:
 *   node tools/audit-mirror-metadata.mjs
 *
 * Exit codes:
 *   0  the live copy matches the record
 *   1  it does not; each differing field is named, with both values
 *   2  the check could not run, and nothing was compared
 *
 * Environment:
 *   GH_BIN  the `gh` executable to use (default: gh). Exists so the "cannot check" path can be
 *           exercised on purpose rather than only discovered in production.
 *
 * Node built-ins only. Needs `gh` on PATH, authenticated for the repository. **Not part of
 * tools/gate.sh**: a CI runner has none of `gh`, credentials or network. Like
 * `tools/verify-live.sh` and `tools/verify-deployments.sh`, it is a check to run when asked.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const DEPLOY_DOC = join(REPO_ROOT, "docs", "DEPLOY.md");
const BEGIN = "<!-- BEGIN MIRROR_METADATA -->";
const END = "<!-- END MIRROR_METADATA -->";
const GH = process.env.GH_BIN ?? "gh";

/** @typedef {{ repository: string, description: string, homepage: string, topics: string[] }} Record_ */

/**
 * The machine-readable block in docs/DEPLOY.md.
 *
 * A block rather than prose on purpose. A check that parses prose is a check that breaks when
 * someone rewraps a line, and a check that *silently* finds nothing is not a check at all — so a
 * missing block, a missing field or a malformed line is a failure with a reason, not a skip.
 *
 * @returns {{ record: Record_ | null, problem: string | null }}
 */
function readRecord() {
  let doc;
  try {
    doc = readFileSync(DEPLOY_DOC, "utf8");
  } catch (error) {
    return { record: null, problem: `cannot read docs/DEPLOY.md (${error.message})` };
  }

  const start = doc.indexOf(BEGIN);
  const end = doc.indexOf(END);
  if (start === -1 || end === -1 || end < start) {
    return {
      record: null,
      problem:
        `docs/DEPLOY.md has no ${BEGIN} … ${END} block, so there is no record to compare against. ` +
        "Restore it rather than removing this check from the gate's documentation.",
    };
  }

  /** @type {Map<string, string>} */
  const fields = new Map();
  for (const raw of doc.slice(start + BEGIN.length, end).split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    const at = line.indexOf(":");
    if (at === -1) {
      return { record: null, problem: `malformed line in the record, expected "field: value": ${line}` };
    }
    fields.set(line.slice(0, at).trim().toLowerCase(), line.slice(at + 1).trim());
  }

  for (const key of ["repository", "description", "homepage", "topics"]) {
    if (!fields.has(key)) {
      return { record: null, problem: `the record is missing the "${key}" field` };
    }
  }

  const topics = (fields.get("topics") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t !== "");

  return {
    record: {
      repository: fields.get("repository") ?? "",
      description: fields.get("description") ?? "",
      homepage: fields.get("homepage") ?? "",
      topics,
    },
    problem: null,
  };
}

/**
 * The live values, as the host reports them.
 *
 * @param {string} repository
 * @returns {{ live: Record_ | null, problem: string | null }}
 */
function readLive(repository) {
  const result = spawnSync(
    GH,
    ["repo", "view", repository, "--json", "description,homepageUrl,repositoryTopics"],
    { encoding: "utf8" },
  );

  if (result.error && result.error.code === "ENOENT") {
    return {
      live: null,
      problem: `\`${GH}\` is not on PATH, so the live copy was not read. Install it and authenticate, or set GH_BIN.`,
    };
  }
  if (result.status !== 0) {
    const why = (result.stderr ?? "").trim() || `exit ${result.status}`;
    return { live: null, problem: `\`${GH} repo view ${repository}\` failed: ${why}` };
  }

  let data;
  try {
    data = JSON.parse(result.stdout ?? "");
  } catch {
    return { live: null, problem: `\`${GH}\` returned output that is not JSON` };
  }

  return {
    live: {
      repository,
      description: typeof data.description === "string" ? data.description : "",
      homepage: typeof data.homepageUrl === "string" ? data.homepageUrl : "",
      topics: Array.isArray(data.repositoryTopics)
        ? data.repositoryTopics.map((t) => String(t.name ?? "")).filter((t) => t !== "")
        : [],
    },
    problem: null,
  };
}

/**
 * @param {Record_} expected
 * @param {Record_} actual
 * @returns {string[]}
 */
function differences(expected, actual) {
  /** @type {string[]} */
  const problems = [];

  const scalar = (/** @type {string} */ field, /** @type {string} */ label) => {
    const want = /** @type {any} */ (expected)[field];
    const have = /** @type {any} */ (actual)[field];
    if (want === have) {
      return;
    }
    problems.push(
      `${label} differs:\n      recorded: ${want === "" ? "(empty)" : want}\n      live:     ${
        have === "" ? "(empty)" : have
      }`,
    );
  };

  scalar("description", "description");
  scalar("homepage", "homepage");

  // Topics are a set, and an extra live topic is a disagreement in its own right: it means the
  // remote says something the record does not, which is exactly the drift this exists to catch.
  const want = new Set(expected.topics.map((t) => t.toLowerCase()));
  const have = new Set(actual.topics.map((t) => t.toLowerCase()));
  const missing = [...want].filter((t) => !have.has(t)).sort();
  const extra = [...have].filter((t) => !want.has(t)).sort();
  if (missing.length > 0 || extra.length > 0) {
    const parts = [];
    if (missing.length > 0) {
      parts.push(`recorded but not live: ${missing.join(", ")}`);
    }
    if (extra.length > 0) {
      parts.push(`live but not recorded: ${extra.join(", ")}`);
    }
    problems.push(`topics differ — ${parts.join("; ")}`);
  }

  return problems;
}

function main() {
  const { record, problem: recordProblem } = readRecord();
  const { live, problem: liveProblem } = readLive(
    record === null ? "hermitokatt/gocklkatz" : record.repository,
  );

  if (recordProblem !== null || liveProblem !== null) {
    for (const line of [recordProblem, liveProblem]) {
      if (line !== null) {
        console.error(`audit-mirror-metadata: cannot check — ${line}`);
      }
    }
    console.error("audit-mirror-metadata: nothing was compared, so this is not a pass.");
    return 2;
  }

  if (record === null || live === null) {
    // Unreachable: both problems would have been set. Present so the types are honest.
    console.error("audit-mirror-metadata: cannot check — one side was not read.");
    return 2;
  }

  console.log(`repository:  ${record.repository}`);
  const problems = differences(record, live);

  if (problems.length === 0) {
    console.log(`description: matches (${record.description.length} chars)`);
    console.log(`homepage:    matches (${record.homepage === "" ? "(empty)" : record.homepage})`);
    console.log(`topics:      matches (${[...record.topics].sort().join(", ")})`);
    console.log("audit-mirror-metadata: ok — the live copy matches the record in docs/DEPLOY.md");
    return 0;
  }

  for (const line of problems) {
    console.error(`audit-mirror-metadata: FAIL ${line}`);
  }
  console.error(
    `audit-mirror-metadata: ${problems.length} field(s) differ. Repair the live copy with the\n` +
      "  `gh repo edit` invocation in docs/DEPLOY.md, or update the record if the remote is right.",
  );
  return 1;
}

process.exitCode = main();
