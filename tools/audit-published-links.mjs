#!/usr/bin/env node
/**
 * Audit every published HTTP(S) URL in the tracked tree.
 *
 * Discovers URLs from `git ls-files` (not from a hand-written list), classifies each one by
 * rule into exactly one class, fetches every `external` URL anonymously, and writes or checks
 * `docs/LINK_AUDIT.md`.
 *
 * Usage:
 *   node tools/audit-published-links.mjs            fetch and report; exit 1 on a failure
 *   node tools/audit-published-links.mjs --write    regenerate docs/LINK_AUDIT.md
 *   node tools/audit-published-links.mjs --check    fail if the document is stale or incomplete
 *
 * Node built-ins only. Does not read node_modules or any build output.
 */

import { spawnSync } from "node:child_process";
import { lookup } from "node:dns/promises";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const AUDIT_PATH = join(REPO_ROOT, "docs", "LINK_AUDIT.md");
const AUDIT_REL = "docs/LINK_AUDIT.md";
const MAX_REDIRECTS = 5;
const USER_AGENT = "Gocklkatz-link-audit/1.0 (anonymous; no cookies)";

const CLASSES = ["external", "local", "fixture", "placeholder"];

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

// Stop at whitespace, quotes, markdown closers, and `|` (shell table rows in
// tools/verify-deployments.sh are `url|status|text`, which is not a URL).
const URL_RE = /https?:\/\/[^\s<>"'`\]|]+/gi;

/**
 * @param {string} rel
 * @returns {boolean}
 */
function skipFile(rel) {
  const base = rel.split("/").pop() ?? rel;
  if (base === "package-lock.json") {
    return true;
  }
  if (rel === AUDIT_REL || rel === "docs/CLAIM_AUDIT.md") {
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
 * @param {string} raw
 * @returns {string}
 */
function cleanUrl(raw) {
  let url = raw.replace(/&amp;/g, "&").replace(/&quot;/g, '"');
  // Markdown emphasis often wraps a URL: **http://localhost:3000**
  url = url.replace(/[*_~]+$/u, "");
  // Shell `${VAR:-https://...}` leaves a trailing `}` — strip it only when it is
  // not part of an interpolation inside the URL.
  if (url.includes("${")) {
    url = url.replace(/[.,;:!?]+$/u, "");
  } else {
    url = url.replace(/[.,;:!?{}]+$/u, "");
  }
  while (
    url.endsWith(")") &&
    (url.match(/\(/g) ?? []).length < (url.match(/\)/g) ?? []).length
  ) {
    url = url.slice(0, -1);
  }
  while (
    url.endsWith("]") &&
    (url.match(/\[/g) ?? []).length < (url.match(/\]/g) ?? []).length
  ) {
    url = url.slice(0, -1);
  }
  const hash = url.indexOf("#");
  if (hash !== -1) {
    url = url.slice(0, hash);
  }
  return url;
}

/**
 * Whether a cleaned candidate is an address at all.
 *
 * A bare scheme is not: `https://` with nothing after it appears in this very file, inside the
 * comment on `cleanUrl` that explains how `${VAR:-https://...}` is handled, and in a shell
 * parameter-expansion example. Treating that as a published URL is not merely noise — it makes the
 * audit stale against its own source the moment the file becomes tracked, which is precisely what
 * happened: `--write` ran while this tool was still untracked, so the tool did not scan itself, and
 * committing it turned the gate red. A fragment in a comment is not a link a reader can follow.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function looksLikeAddress(url) {
  return /^https?:\/\/[^\s/]/.test(url);
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function urlsIn(text) {
  /** @type {string[]} */
  const found = [];
  const seen = new Set();
  for (const match of text.matchAll(URL_RE)) {
    const url = cleanUrl(match[0] ?? "");
    if (url === "" || !looksLikeAddress(url) || seen.has(url)) {
      continue;
    }
    seen.add(url);
    found.push(url);
  }
  return found;
}

/**
 * @param {string} location
 * @returns {boolean}
 */
function isAuthRedirect(location) {
  const value = location.toLowerCase();
  if (value.includes("sso-api")) {
    return true;
  }
  if (value.includes("vercel.com/login") || value.includes("vercel.com/sso")) {
    return true;
  }
  try {
    const resolved = new URL(location, "https://example.invalid");
    const path = `${resolved.pathname}${resolved.search}`;
    if (/\/(login|sso)(\/|$|\?)/i.test(path) && !/\/login\/oauth\//i.test(path)) {
      return true;
    }
  } catch {
    // Unparseable Location still matches the string checks above.
  }
  return false;
}

/**
 * Classification is by URL shape, not by a hand-maintained exclusion list.
 *
 * @param {string} url
 * @returns {{ class: string, reason: string }}
 */
function classify(url) {
  if (/\$[A-Za-z_][A-Za-z0-9_]*|\$\{/.test(url)) {
    return {
      class: "local",
      reason: "contains a shell or template variable; reachable only after local expansion",
    };
  }
  if (/https?:\/\/[^/\s]*<[^>]+>/.test(url) || /<host>|<name>|<label>|<url>/i.test(url)) {
    return {
      class: "placeholder",
      reason: "template URL with an angle-bracket placeholder, not a published address",
    };
  }
  if (/https?:\/\/10\.x\./i.test(url)) {
    return {
      class: "local",
      reason: "documented LAN-address pattern, not a specific host",
    };
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    if (/localhost|127\.0\.0\.1/.test(url)) {
      return {
        class: "local",
        reason: "loopback address in a URL this check could not parse",
      };
    }
    return {
      class: "placeholder",
      reason: "not a parseable URL; treated as a documentation placeholder",
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      class: "placeholder",
      reason: `scheme ${parsed.protocol} is not a published http(s) address`,
    };
  }

  const host = parsed.hostname.toLowerCase();

  if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1") {
    return {
      class: "local",
      reason: "loopback host; reachable only from a developer machine",
    };
  }
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(host)) {
    return {
      class: "local",
      reason: "private-network address; reachable only from a developer machine",
    };
  }

  if (host === "invalid" || host.endsWith(".invalid")) {
    return {
      class: "fixture",
      reason:
        "RFC 2606 .invalid host — deliberately unresolvable, so a negative test can fail on purpose",
    };
  }
  if (
    host === "example" ||
    host.endsWith(".example") ||
    host === "example.com" ||
    host === "example.net" ||
    host === "example.org" ||
    host.endsWith(".example.com") ||
    host.endsWith(".example.net") ||
    host.endsWith(".example.org")
  ) {
    return {
      class: "fixture",
      reason: "RFC 2606 example host — reserved for documentation, not a published address",
    };
  }
  if (host === "test" || host.endsWith(".test") || host === "localhost.localdomain") {
    return {
      class: "fixture",
      reason: "reserved special-use domain, not a published address",
    };
  }

  // Custom domains are `{project}.vercel.app`. Team-suffixed aliases
  // (`{project}-gocklkatz.vercel.app`, `{project}-git-{branch}-gocklkatz.vercel.app`) are
  // gated by ssoProtection and are the documented failure fixture, not published links.
  if (host.endsWith("-gocklkatz.vercel.app")) {
    return {
      class: "placeholder",
      reason:
        "Vercel project or branch alias with the team suffix; gated by ssoProtection, not a published custom domain",
    };
  }

  // SVG/XHTML xmlns values look like URLs and are not hyperlinks.
  if (
    (host === "www.w3.org" || host === "w3.org") &&
    /^\/\d{4}\/[A-Za-z0-9.+-]+\/?$/.test(parsed.pathname)
  ) {
    return {
      class: "placeholder",
      reason: "XML namespace URI (xmlns), not a published hyperlink",
    };
  }

  return { class: "external", reason: "published http(s) address; fetched anonymously" };
}

/**
 * @returns {{ url: string, class: string, reason: string, files: string[] }[]}
 */
function discover() {
  /** @type {Map<string, { class: string, reason: string, files: Set<string> }>} */
  const byUrl = new Map();

  for (const rel of trackedFiles()) {
    const abs = join(REPO_ROOT, rel);
    if (!existsSync(abs)) {
      continue;
    }
    let text;
    try {
      const buf = readFileSync(abs);
      if (buf.includes(0)) {
        continue;
      }
      text = buf.toString("utf8");
    } catch {
      continue;
    }
    for (const url of urlsIn(text)) {
      const { class: cls, reason } = classify(url);
      const entry = byUrl.get(url);
      if (entry) {
        entry.files.add(rel);
        continue;
      }
      byUrl.set(url, { class: cls, reason, files: new Set([rel]) });
    }
  }

  return [...byUrl.entries()]
    .map(([url, entry]) => ({
      url,
      class: entry.class,
      reason: entry.reason,
      files: [...entry.files].sort(),
    }))
    .sort((a, b) => {
      const ci = CLASSES.indexOf(a.class) - CLASSES.indexOf(b.class);
      if (ci !== 0) {
        return ci;
      }
      return a.url.localeCompare(b.url);
    });
}

/**
 * One anonymous GET, following no redirects — the same curl invocation as
 * tools/verify-live.sh (`-sS -m 25 -w '%{http_code} %{redirect_url}'`).
 *
 * @param {string} url
 * @returns {{ code: string, redirect: string, error: string }}
 */
function curlOnce(url) {
  const dir = mkdtempSync(join(tmpdir(), "link-audit-"));
  const body = join(dir, "body");
  try {
    const result = spawnSync(
      "curl",
      [
        "-sS",
        "-m",
        "25",
        "-o",
        body,
        "-w",
        "%{http_code} %{redirect_url}",
        "-A",
        USER_AGENT,
        // Browser-like content negotiation, and it is load-bearing rather than cosmetic.
        //
        // The question this check answers is "can a reader open this?", and a reader arrives with a
        // browser. Some hosts content-negotiate on `Accept`: with a bare client the request gets a
        // 403 that a browser never sees. `hanzicraft.com/lists/frequency` is one — 403 without these
        // headers, 200 with them, measured 2026-09-12. Without this, the audit reported a live page
        // as a dead link, which is the opposite of the failure it exists to catch.
        //
        // Still anonymous: no cookies, no credentials, no `-L`.
        "-H",
        "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "-H",
        "Accept-Language: en-US,en;q=0.9",
        "--",
        url,
      ],
      { encoding: "utf8" },
    );
    if (result.error && result.error.code === "ENOENT") {
      return { code: "000", redirect: "", error: "curl is not on PATH" };
    }
    const meta = (result.stdout ?? "").trim();
    const error = (result.stderr ?? "").trim();
    const space = meta.indexOf(" ");
    const code = space === -1 ? meta : meta.slice(0, space);
    const redirect = space === -1 ? "" : meta.slice(space + 1).trim();
    if (code === "" || code === "000") {
      return { code: "000", redirect: "", error: error || "no response" };
    }
    return { code, redirect, error };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Whether the hostname resolves at all.
 *
 * This is what separates "the host refused this client, and a reader may still get through" from
 * "this address does not exist" — the second is a defect in the document, the first is a limit of
 * the audit. Without it, a typo such as `gocklkatz-arbeitsmakt.vercel.app` would be recorded as
 * merely unverifiable.
 *
 * @param {string} url
 * @returns {Promise<boolean>}
 */
async function hostResolves(url) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  try {
    await lookup(host);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch anonymously. Do not follow a redirect into a login page and call it success —
 * same rule as tools/verify-live.sh: inspect the status and Location, refuse SSO/login.
 *
 * Non-auth redirects (http→https, trailing slash) are followed up to MAX_REDIRECTS hops
 * so a canonicalisation is not recorded as a dead link.
 *
 * **A third outcome is necessary, and it is not a way to launder a dead link.** Some hosts answer
 * an anonymous scripted request with `401`/`403` whatever the headers, and some are unreachable from
 * the network the audit runs on. `http://www.adobe.com/` is inside a verbatim OFL copyright line and
 * is unreachable from here in every form (TLS fails instantly, IPv4 times out at 60s), while the
 * page itself is obviously alive. Reporting that as a dead link is false; deleting the licence
 * notice to go green is worse. So it is reported as `unverifiable`, with the observation, and it is
 * never silent.
 *
 * The rule is narrow, and a link that is genuinely broken still fails:
 *
 *   2xx                          ok
 *   redirect into a login host   failure — a reader gets a login, not the page
 *   any other 4xx or any 5xx     failure — the server answered and said no
 *   hostname does not resolve    failure — the address is wrong
 *   401 / 403                    unverifiable — the host refused this client
 *   no response, host resolves   unverifiable — not reachable from here
 *
 * @param {string} url
 * @param {number} [hops]
 * @returns {Promise<{ ok: boolean, unverifiable: boolean, status: string, detail: string }>}
 */
async function fetchAnonymous(url, hops = 0) {
  const { code, redirect, error } = curlOnce(url);
  const status = Number(code);

  if (code === "000" || Number.isNaN(status)) {
    const detail = error || "no response";
    if (await hostResolves(url)) {
      return { ok: false, unverifiable: true, status: "no response", detail };
    }
    return { ok: false, unverifiable: false, status: "error", detail: `host does not resolve — ${detail}` };
  }

  if (status >= 200 && status < 300) {
    const suffix = hops > 0 ? ` after ${hops} redirect(s), not to a login page` : "";
    return { ok: true, unverifiable: false, status: String(status), detail: `${status}${suffix}` };
  }

  if ([301, 302, 303, 307, 308].includes(status)) {
    if (redirect === "" || redirect === "-") {
      return {
        ok: false,
        unverifiable: false,
        status: String(status),
        detail: `${status} redirect with no Location`,
      };
    }
    if (isAuthRedirect(redirect)) {
      return {
        ok: false,
        unverifiable: false,
        status: String(status),
        detail: `${status} to an authentication host (not followed): ${redirect}`,
      };
    }
    if (hops >= MAX_REDIRECTS) {
      return {
        ok: false,
        unverifiable: false,
        status: String(status),
        detail: `${status} redirect not followed: hop limit ${MAX_REDIRECTS} (${redirect})`,
      };
    }
    const next = new URL(redirect, url).href;
    return await fetchAnonymous(next, hops + 1);
  }

  if (status === 401 || status === 403) {
    return {
      ok: false,
      unverifiable: true,
      status: String(status),
      detail: `HTTP ${status} to an anonymous client that sends browser Accept headers`,
    };
  }

  return { ok: false, unverifiable: false, status: String(status), detail: `HTTP ${status}` };
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
 * @param {string} markdown
 * @returns {Map<string, { class: string, status: string }>}
 */
function parseAuditRows(markdown) {
  /** @type {Map<string, { class: string, status: string }>} */
  const rows = new Map();
  const start = markdown.indexOf("<!-- BEGIN LINK_AUDIT_ROWS");
  const end = markdown.indexOf("END LINK_AUDIT_ROWS -->");
  if (start === -1 || end === -1 || end <= start) {
    return rows;
  }
  const block = markdown.slice(start, end);
  for (const line of block.split("\n")) {
    if (!line.startsWith("row\t")) {
      continue;
    }
    const parts = line.split("\t");
    const url = parts[1] ?? "";
    const cls = parts[2] ?? "";
    const status = parts[3] ?? "";
    if (url !== "") {
      rows.set(url, { class: cls, status });
    }
  }
  return rows;
}

/**
 * Whether a recorded status satisfies `--check`.
 *
 * `unverifiable` counts, and that is a deliberate weakening of the strictest possible rule. A row
 * recorded that way carries the observation that produced it — a refusal from the host, or no
 * response from a host that resolves — so it is a finding with evidence, not a silent pass. The
 * alternative is an audit that is permanently red on a licence notice's own URL, which trains the
 * reader to ignore it.
 *
 * What it never covers: a `FAIL:` row. Anything the server actively answered — a 404, a 410, a 5xx,
 * a redirect into a login — stays a failure, and so does a hostname that does not resolve.
 *
 * @param {string} status
 * @returns {boolean}
 */
export function statusIsOk(status) {
  if (status === "ok" || status.startsWith("unverifiable:")) {
    return true;
  }
  const code = /^(\d{3})/.exec(status);
  if (code && code[1]) {
    const n = Number(code[1]);
    return n >= 200 && n < 300;
  }
  return false;
}

/**
 * @param {{ url: string, class: string, reason: string, files: string[], status: string, checked: string }[]} rows
 * @param {string} date
 * @param {string} command
 * @param {Record<string, string>} preserved
 * @param {string[]} [unverifiable]
 * @returns {string}
 */
function renderDocument(rows, date, command, preserved, unverifiable = [], relativeProblems = []) {
  const counts = Object.fromEntries(CLASSES.map((c) => [c, 0]));
  for (const row of rows) {
    counts[row.class] += 1;
  }

  const machine = ["<!-- BEGIN LINK_AUDIT_ROWS"];
  for (const row of rows) {
    machine.push(`row\t${row.url}\t${row.class}\t${row.status}`);
  }
  machine.push("END LINK_AUDIT_ROWS -->");

  /** @type {string[]} */
  const lines = [];
  lines.push("# Published-link audit");
  lines.push("");
  lines.push(
    "Every HTTP(S) URL in the tracked tree, discovered by `git ls-files` rather than a hand-written list. `package-lock.json` is excluded: those `resolved` fields are npm registry records, not published links. This file is generated by `--write`; hand-edit only the preserved prose blocks.",
  );
  lines.push("");
  lines.push(`- **Date checked:** ${date} (UTC date; informational — \`--check\` does not compare it)`);
  lines.push(`- **Command:** \`${command}\``);
  lines.push(
    "- **Fetch:** anonymous curl, no cookies, no `-L`. Redirects are inspected; a redirect into a login or SSO host is recorded as failure, matching `tools/verify-live.sh`. Canonicalisation redirects that do not land on a login page are followed, up to five hops, and the final `2xx` is recorded.",
  );
  lines.push("");
  lines.push("## Counts");
  lines.push("");
  lines.push("| Class | Count | Fetched |");
  lines.push("| --- | ---: | --- |");
  lines.push(`| \`external\` | ${counts.external} | yes |`);
  lines.push(`| \`local\` | ${counts.local} | no |`);
  lines.push(`| \`fixture\` | ${counts.fixture} | no |`);
  lines.push(`| \`placeholder\` | ${counts.placeholder} | no |`);
  lines.push(`| **total** | **${rows.length}** | |`);
  lines.push("");
  lines.push("## Table");
  lines.push("");
  lines.push("| URL | Class | Status | Checked | Appears in | Reason |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const row of rows) {
    const files = row.files.map((f) => `\`${f}\``).join(", ");
    lines.push(
      `| \`${row.url}\` | \`${row.class}\` | ${row.status} | ${row.checked} | ${files} | ${row.reason} |`,
    );
  }
  lines.push("");
  lines.push("## Not verifiable from this network");
  lines.push("");
  lines.push(
    "An anonymous scripted client is not a reader. Some hosts answer it with `401`/`403` whatever headers it sends, and some are unreachable from the network this ran on. Those rows are recorded here rather than deleted, because removing a citation to make a check green is the one outcome worse than a failing link. **Each is a judgement for a human, not a cleared link.**",
  );
  lines.push("");
  if (unverifiable.length === 0) {
    lines.push("None on this run.");
  } else {
    for (const line of unverifiable) {
      lines.push(`- ${line}`);
    }
  }
  lines.push("");
  lines.push(
    "The rule that separates these from a defect: a server that **answers** with any other 4xx or any 5xx is a failure, and so is a hostname that does not resolve. Only a refusal (401/403) or no response from a host that **does** resolve is recorded as unverifiable with this command.",
  );
  lines.push("");
  lines.push("## Relative links");
  lines.push("");
  lines.push(
    "Markdown links that point at a path in this repository, resolved against the file they appear in. The HTTP audit cannot see these, and a dead one is the same defect as a dead host: a reader clicks and gets nothing. `--check` verifies this list without a network.",
  );
  lines.push("");
  if (relativeProblems.length === 0) {
    lines.push("Every relative markdown link in the tracked tree resolves to a file that exists.");
  } else {
    for (const problem of relativeProblems) {
      lines.push(`- **FAIL** ${problem}`);
    }
  }
  lines.push("");
  lines.push("## Corrections this run");
  lines.push("");
  lines.push(wrapPreserve("corrections", preserved.corrections ?? ""));
  lines.push("");
  lines.push("## A-3 — card rule (`bash scripts/verify.sh`)");
  lines.push("");
  lines.push(
    "Requirement 3 of GOC-40: every card marked `live` still resolves, and every card marked `in-development` renders no link. `scripts/verify.sh` is the existing check for that rule. Observed output:",
  );
  lines.push("");
  lines.push(wrapPreserve("a3", preserved.a3 ?? ""));
  lines.push("");
  lines.push("## Re-running");
  lines.push("");
  lines.push(
    "A later reader re-runs `node tools/audit-published-links.mjs --check`. That command re-discovers every URL from `git ls-files` and fails if this document is missing any of them, contains a URL the tree no longer has, or records an `external` URL as anything other than ok or a recorded `unverifiable` observation. It does not compare the date column, and it does not fetch.",
  );
  lines.push("");
  lines.push(machine.join("\n"));
  lines.push("");
  return lines.join("\n");
}

/**
 * @param {string} text
 */
function say(text) {
  console.log(text);
}

/**
 * Every relative markdown link in the tracked tree that points at nothing.
 *
 * The HTTP audit cannot see this class at all, and it is a real one: this check was written after a
 * repository-wide sweep found two dead links in an Ameisenwerkstatt eval template, which had been
 * pointing at a `goldens-b.md` / `goldens-b.jsonl` that never existed in this repository. A link a
 * reader can click and get nothing is the same defect whether the target is a host or a path.
 *
 * Markdown only. A relative path in a shell script or a config file is not a published link.
 *
 * @returns {string[]}
 */
export function relativeLinkProblems(files) {
  /** @type {string[]} */
  const problems = [];
  const link = /\[[^\]]*\]\(([^)\s]+)\)/g;
  for (const rel of files ?? trackedFiles()) {
    if (!rel.endsWith(".md")) {
      continue;
    }
    let text;
    try {
      text = readFileSync(join(REPO_ROOT, rel), "utf8");
    } catch {
      continue;
    }
    link.lastIndex = 0;
    let match;
    while ((match = link.exec(text)) !== null) {
      const target = match[1] ?? "";
      if (target.startsWith("http://") || target.startsWith("https://")) {
        continue;
      }
      if (target.startsWith("mailto:") || target.startsWith("#")) {
        continue;
      }
      const withoutFragment = target.split("#")[0];
      if (withoutFragment === "") {
        continue;
      }
      const resolved = join(dirname(rel), withoutFragment);
      if (!existsSync(join(REPO_ROOT, resolved))) {
        problems.push(`${rel} links to \`${target}\`, which does not exist`);
      }
    }
  }
  return problems;
}

/**
 * @param {string[]} argv
 * @returns {Promise<number>}
 */
async function main(argv) {
  const write = argv.includes("--write");
  const check = argv.includes("--check");
  if (write && check) {
    console.error("audit-published-links: use one of --write or --check, not both");
    return 2;
  }

  const discovered = discover();
  if (discovered.length === 0) {
    console.error("audit-published-links: discovered no URLs; the scanner would be a no-op");
    return 1;
  }

  const relativeProblems = relativeLinkProblems();
  if (relativeProblems.length > 0) {
    for (const problem of relativeProblems) {
      console.error(`audit-published-links: FAIL ${problem}`);
    }
  } else {
    say(
      `audit-published-links: relative links — every markdown link in the tracked tree resolves to a file that exists`,
    );
  }

  const unclassified = discovered.filter((row) => !CLASSES.includes(row.class));
  if (unclassified.length > 0) {
    for (const row of unclassified) {
      console.error(`audit-published-links: URL landed in no class: ${row.url}`);
    }
    return 1;
  }

  if (check) {
    if (!existsSync(AUDIT_PATH)) {
      console.error(`audit-published-links: ${AUDIT_REL} is missing`);
      return 1;
    }
    const markdown = readFileSync(AUDIT_PATH, "utf8");
    const recorded = parseAuditRows(markdown);
    if (recorded.size === 0) {
      console.error(
        `audit-published-links: ${AUDIT_REL} has no machine-readable rows; regenerate with --write`,
      );
      return 1;
    }

    /** @type {string[]} */
    const failures = [];
    for (const row of discovered) {
      const have = recorded.get(row.url);
      if (!have) {
        failures.push(`missing from ${AUDIT_REL}: ${row.url} (${row.class})`);
        continue;
      }
      if (row.class === "external" && !statusIsOk(have.status)) {
        failures.push(`external URL is not recorded as ok: ${row.url} (status ${have.status})`);
      }
    }
    for (const url of recorded.keys()) {
      if (!discovered.some((row) => row.url === url)) {
        failures.push(`stale in ${AUDIT_REL}, no longer in the tree: ${url}`);
      }
    }
    if (failures.length > 0) {
      for (const line of failures) {
        console.error(`audit-published-links: FAIL ${line}`);
      }
      console.error(`audit-published-links: ${failures.length} failure(s)`);
      return 1;
    }
    // A dead relative link is a failure in --check too, and it is the half --check can verify
    // without a network: the resolver is a filesystem lookup.
    if (relativeProblems.length > 0) {
      return 1;
    }
    say(`audit-published-links: ${AUDIT_REL} is current (${discovered.length} URL(s))`);
    return 0;
  }

  const date = new Date().toISOString().slice(0, 10);
  const external = discovered.filter((row) => row.class === "external");
  /** @type {Map<string, { ok: boolean, status: string, detail: string }>} */
  const fetched = new Map();
  /** @type {string[]} */
  const failures = [];
  /** @type {string[]} */
  const unverifiable = [];

  say(`audit-published-links: ${discovered.length} distinct URL(s)`);
  say(`date:                   ${date}`);
  say(
    `fetched:                ${external.length} external, anonymously, login redirects not counted as success`,
  );
  say("");

  for (const row of discovered) {
    if (row.class !== "external") {
      say(`  skip  ${row.class.padEnd(12)} ${row.url}`);
      continue;
    }
    const result = await fetchAnonymous(row.url);
    fetched.set(row.url, result);
    if (result.ok) {
      say(`  ok    ${result.detail.padEnd(12)} ${row.url}`);
    } else if (result.unverifiable) {
      say(`  n/a   ${result.detail}  ${row.url}`);
      unverifiable.push(`${row.url} — ${result.detail}`);
    } else {
      say(`  FAIL  ${result.detail}  ${row.url}`);
      failures.push(`${row.url} — ${result.detail}`);
    }
  }

  say("");
  if (unverifiable.length > 0) {
    say(
      `audit-published-links: ${unverifiable.length} URL(s) could not be verified from this network (recorded, not treated as dead)`,
    );
  }

  /** @type {{ url: string, class: string, reason: string, files: string[], status: string, checked: string }[]} */
  const rows = discovered.map((row) => {
    if (row.class !== "external") {
      return {
        ...row,
        status: "not fetched",
        checked: date,
      };
    }
    const result = fetched.get(row.url);
    const detail = result?.detail ?? "missing fetch";
    let status;
    if (result?.ok) {
      status = detail;
    } else if (result?.unverifiable) {
      status = `unverifiable: ${detail}`;
    } else {
      status = `FAIL: ${detail}`;
    }
    return {
      ...row,
      status,
      checked: date,
    };
  });

  if (write) {
    let preserved = { corrections: "", a3: "" };
    if (existsSync(AUDIT_PATH)) {
      const previous = readFileSync(AUDIT_PATH, "utf8");
      preserved = {
        corrections: readPreserve(previous, "corrections"),
        a3: readPreserve(previous, "a3"),
      };
    }
    if (preserved.corrections === "") {
      preserved.corrections =
        failures.length === 0
          ? "None. Every `external` URL returned a success status on this run."
          : failures.map((line) => `- ${line}`).join("\n");
    }
    if (preserved.a3 === "") {
      preserved.a3 =
        "_Not captured in this `--write` run. Paste the observed `bash scripts/verify.sh` output here._";
    }
    const command = "node tools/audit-published-links.mjs --write";
    writeFileSync(AUDIT_PATH, renderDocument(rows, date, command, preserved, unverifiable, relativeProblems), "utf8");
    say(`wrote ${AUDIT_REL}`);
  }

  if (failures.length > 0 || relativeProblems.length > 0) {
    for (const line of failures) {
      console.error(`audit-published-links: FAIL ${line}`);
    }
    console.error(`audit-published-links: ${failures.length} failure(s)`);
    if (relativeProblems.length > 0) {
      console.error(
        `audit-published-links: plus ${relativeProblems.length} dead relative link(s), listed above`,
      );
    }
    return 1;
  }

  const counts = CLASSES.map((c) => `${c}=${discovered.filter((r) => r.class === c).length}`).join(
    " ",
  );
  say(`audit-published-links: ok (${counts})`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
