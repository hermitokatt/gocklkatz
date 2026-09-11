#!/usr/bin/env node
/**
 * HTTP probe for the landing page — the part of `scripts/verify.sh` that talks to the running
 * server and judges what came back.
 *
 * It exists as a separate module for two reasons. Parsing HTML and JSON in shell is how a check
 * becomes a silent no-op: `grep` finding nothing and `grep` having nothing to search look
 * identical from bash. And the card rules below are worth unit-testing directly, which
 * `scripts/probe.test.mjs` does, including the cases that must fail.
 *
 * Subcommands:
 *   node scripts/probe.mjs port-free <port>          exit 0 if the port is free, 1 if taken
 *   node scripts/probe.mjs wait <base-url> <ms>      exit 0 once the port answers HTTP
 *   node scripts/probe.mjs check <base-url>          assert the routes and the card link rules
 *
 * Node built-ins only. Adding a browser driver is a policy decision ticket 001 does not make.
 */

import net from "node:net";
import { pathToFileURL } from "node:url";

/**
 * The demos the page must present, from the ticket rather than from the application's own data
 * module. A probe that reads its expectations out of the thing it is probing agrees with any
 * mistake the thing makes.
 *
 * Cards beyond these four are allowed and are held to the same link rules, so adding a demo
 * does not mean editing this list.
 */
const REQUIRED_DEMOS = [
  { slug: "ameisenwerkstatt", name: "Ameisenwerkstatt" },
  { slug: "bienenstock", name: "Bienenstock" },
  { slug: "simplified", name: "Simplified" },
  { slug: "arbeitsmarkt", name: "Arbeitsmarkt" },
];

const VALID_STATUSES = ["live", "in-development"];

/**
 * The one page-level link the landing page is expected to publish besides its live cards: the
 * repository. Taken from the ticket, not from the application's own config module, for the same
 * reason REQUIRED_DEMOS is: a probe that reads its expectations out of the thing it probes
 * agrees with any mistake that thing makes.
 */
const DEFAULT_PAGE_HREF = "https://github.com/hermitokatt/gocklkatz";

/** @typedef {{ slug: string, status: string | null, hrefs: string[], block: string }} Card */
/** @typedef {{ cards: Card[], outside: string, problems: string[] }} ParsedPage */
/** @typedef {{ label: string, url: string }} LinkTarget */

/**
 * Pull every `href` out of a fragment of markup.
 *
 * Deliberately permissive: the guarantee is "the served HTML publishes no anchor for a card that
 * is not live", and a parser that only recognises what React happens to emit today does not hold
 * that guarantee. Single quotes, no quotes, and uppercase tags all count, because a browser would
 * follow each of them.
 *
 * @param {string} html
 * @returns {string[]}
 */
export function hrefsIn(html) {
  /** @type {string[]} */
  const hrefs = [];
  // <a ... href = "..." | '...' | bare >  — any tag case, any quoting style.
  const anchor = /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
  let match;
  while ((match = anchor.exec(html)) !== null) {
    hrefs.push(decodeAttribute(match[1] ?? match[2] ?? match[3] ?? ""));
  }
  return hrefs;
}

/**
 * @param {string} value
 * @returns {string}
 */
function decodeAttribute(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * Split the served markup into the demo cards and everything around them.
 *
 * A card is **any element** carrying `data-demo`, not specifically an `<article>`. Requiring a
 * particular tag let a card escape the link rule by being a `<div>` or an `<li>`, which is a
 * realistic edit and was demonstrated against this probe. Whatever tag carries the attribute is
 * the card.
 *
 * Its status comes from `data-status` on the same tag. The element body is extracted by counting
 * nested tags of the same name, so a nested element of the same kind cannot terminate the card
 * early and leak its anchors into "outside", where they are not held to the card's link rule.
 *
 * @param {string} html
 * @returns {ParsedPage}
 */
export function parsePage(html) {
  /** @type {Card[]} */
  const cards = [];
  /** @type {string[]} */
  const problems = [];
  let outside = "";
  let cursor = 0;

  // Any tag, any case, with data-demo. Capture the tag name so the body can be delimited.
  const openTag =
    /<([a-z][a-z0-9-]*)\b[^>]*?\bdata-demo\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))[^>]*>/gi;
  let match;
  while ((match = openTag.exec(html)) !== null) {
    const tag = (match[1] ?? "").toLowerCase();
    const slug = decodeAttribute(match[2] ?? match[3] ?? match[4] ?? "");
    outside += html.slice(cursor, match.index);

    const bodyStart = match.index + match[0].length;
    const closeAt = findElementEnd(html, tag, bodyStart);
    if (closeAt === -1) {
      problems.push(`card "${slug}": its <${tag}> is never closed in the served markup`);
      cursor = bodyStart;
      openTag.lastIndex = bodyStart;
      continue;
    }

    const statusMatch = /\bdata-status\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(match[0]);
    const block = html.slice(bodyStart, closeAt);
    cards.push({
      slug,
      status: statusMatch
        ? decodeAttribute(statusMatch[1] ?? statusMatch[2] ?? statusMatch[3] ?? "")
        : null,
      block,
      hrefs: hrefsIn(block),
    });

    cursor = closeAt + `</${tag}>`.length;
    openTag.lastIndex = cursor;
  }

  outside += html.slice(cursor);
  return { cards, outside, problems };
}

/**
 * Index of the `</tag>` that closes the element opened before `from`, counting nesting of the
 * same tag name. Returns -1 when the element is never closed.
 *
 * @param {string} html
 * @param {string} tag lowercased tag name
 * @param {number} from index just past the opening tag
 * @returns {number}
 */
function findElementEnd(html, tag, from) {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  re.lastIndex = from;
  let depth = 1;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1] === "/") {
      depth -= 1;
      if (depth === 0) {
        return m.index;
      }
    } else if (!m[0].endsWith("/>")) {
      depth += 1;
    }
  }
  return -1;
}

/**
 * Requirement 4 of ticket 001, in both directions, plus the checks that stop it passing
 * vacuously: a page with no cards, or a card with no status, must fail rather than satisfy
 * "no in-development card links anywhere" by having nothing to look at.
 *
 * @param {ParsedPage} page
 * @param {{ slug: string, name: string }[]} [required]
 * @param {string | null} [allowedPageHref] the one page-level anchor the page may publish besides
 *   its live cards. Pass `null` to skip the page-level assertion — a caller that has not said what
 *   the page may publish cannot be told what is unaccounted for.
 * @returns {string[]} one line per violation, each naming the card
 */
export function cardFailures(page, required = REQUIRED_DEMOS, allowedPageHref = null) {
  const failures = [...page.problems];

  if (page.cards.length === 0) {
    failures.push("no demo cards found in the served markup (expected an <article data-demo=...>)");
  }

  for (const want of required) {
    const card = page.cards.find((candidate) => candidate.slug === want.slug);
    if (!card) {
      failures.push(`card "${want.slug}": missing from the page`);
      continue;
    }
    if (!card.block.includes(want.name)) {
      failures.push(`card "${want.slug}": does not render its name "${want.name}"`);
    }
  }

  // Page-level anchor assertion. The per-card rule above attributes an anchor to a card by
  // containment, which loses to markup the parser does not delimit — an <a> that wraps the card,
  // an unrecognised tag, a missing attribute. This closes that: every anchor in the served HTML
  // must belong to a card whose status is `live`, or be one of the page-level links we expect.
  // Anything else is published by the page and unaccounted for, so it fails.
  const cardOwned = new Set();
  for (const card of page.cards) {
    for (const href of card.hrefs) {
      cardOwned.add(href);
    }
  }
  const unaccounted = [];
  for (const href of hrefsIn(page.outside)) {
    if (allowedPageHref === null || cardOwned.has(href) || href === allowedPageHref) {
      continue;
    }
    unaccounted.push(href);
  }
  if (unaccounted.length > 0) {
    failures.push(
      `the page publishes ${unaccounted.length} anchor(s) outside the demo cards that are not ` +
        `expected: ${unaccounted.join(", ")} — an anchor on this page must either belong to a ` +
        `live card or be the repository link`,
    );
  }

  for (const card of page.cards) {
    if (card.status === null) {
      failures.push(`card "${card.slug}": renders no data-status, so its link rule is undefined`);
      continue;
    }
    if (!VALID_STATUSES.includes(card.status)) {
      failures.push(
        `card "${card.slug}": status "${card.status}" is not one of ${VALID_STATUSES.join(", ")}`,
      );
      continue;
    }

    if (card.status === "in-development") {
      if (card.hrefs.length > 0) {
        failures.push(
          `card "${card.slug}": status is in-development but it links to ${card.hrefs.join(", ")}` +
            " — an in-development card must render no anchor at all",
        );
      }
      continue;
    }

    if (card.hrefs.length === 0) {
      failures.push(`card "${card.slug}": status is live but it renders no anchor`);
      continue;
    }
    for (const href of card.hrefs) {
      // https only. A live card is a public deployment link on the portfolio's front page, and
      // `http://` there would publish an insecure URL that still passed an http(s) check.
      if (!/^https:\/\//.test(href)) {
        failures.push(
          `card "${card.slug}": status is live but its link "${href}" is not an absolute https URL`,
        );
      }
    }
  }

  return failures;
}

/**
 * Every link the page publishes, labelled with where it came from, so a failure names the card
 * rather than only the URL. Fragments and non-HTTP schemes are not fetchable and are skipped.
 *
 * @param {ParsedPage} page
 * @param {string} baseUrl
 * @returns {LinkTarget[]}
 */
export function linkTargets(page, baseUrl) {
  /** @type {LinkTarget[]} */
  const targets = [];
  const seen = new Set();

  const add = (/** @type {string} */ label, /** @type {string} */ href) => {
    if (href === "" || href.startsWith("#")) {
      return;
    }
    let resolved;
    try {
      resolved = new URL(href, baseUrl);
    } catch {
      targets.push({ label, url: href });
      return;
    }
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return;
    }
    const key = `${label} ${resolved.href}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    targets.push({ label, url: resolved.href });
  };

  for (const card of page.cards) {
    for (const href of card.hrefs) {
      add(`card "${card.slug}"`, href);
    }
  }
  for (const href of hrefsIn(page.outside)) {
    add("page", href);
  }

  return targets;
}

/**
 * @param {string} host
 * @param {number} port
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
function tcpConnects(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (/** @type {boolean} */ result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

/**
 * @param {number} port
 * @returns {Promise<boolean>} true when nothing is listening
 */
function portIsFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for the server to accept a connection and answer, rather than assuming that a started
 * process is a serving process.
 *
 * @param {string} baseUrl
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
async function waitForServer(baseUrl, timeoutMs) {
  const target = new URL(baseUrl);
  const port = Number(target.port || (target.protocol === "https:" ? 443 : 80));
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await tcpConnects(target.hostname, port, 1_000)) {
      try {
        await fetch(baseUrl, { signal: AbortSignal.timeout(5_000) });
        return true;
      } catch {
        // Connected but not answering yet: keep waiting.
      }
    }
    await sleep(250);
  }
  return false;
}

/**
 * @param {string} url
 * @returns {Promise<{ status: number, body: string, contentType: string } | { error: string }>}
 */
async function get(url) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    return {
      status: response.status,
      body: await response.text(),
      contentType: response.headers.get("content-type") ?? "",
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * @param {string} baseUrl
 * @returns {Promise<number>} process exit code
 */
async function check(baseUrl) {
  const base = baseUrl.replace(/\/$/, "");
  /** @type {string[]} */
  const failures = [];
  const say = (/** @type {string} */ line) => console.log(line);

  // ---- GET / -------------------------------------------------------------
  const home = await get(`${base}/`);
  if ("error" in home) {
    say(`route GET /              UNREACHABLE (${home.error})`);
    failures.push(`GET / did not answer: ${home.error}`);
    return report(failures);
  }
  say(`route GET /              ${home.status} (${home.body.length} bytes)`);
  if (home.status !== 200) {
    failures.push(`GET / answered ${home.status}, expected 200`);
  }

  for (const demo of REQUIRED_DEMOS) {
    if (home.body.includes(demo.name)) {
      say(`name  ${demo.name.padEnd(18)} present in /`);
    } else {
      say(`name  ${demo.name.padEnd(18)} MISSING from /`);
      failures.push(`GET / does not mention the demo "${demo.name}"`);
    }
  }

  // ---- the card link rules ----------------------------------------------
  const page = parsePage(home.body);
  for (const card of page.cards) {
    const anchors = card.hrefs.length === 0 ? "no anchor" : card.hrefs.join(", ");
    say(`card  ${card.slug.padEnd(18)} status=${card.status ?? "<none>"}  ${anchors}`);
  }
  // The page-level assertion is enabled here, in the real run, with the one anchor the landing
  // page is expected to publish besides its live cards. Its default is off so that unit tests can
  // exercise the card rules on markup that carries no footer link.
  failures.push(...cardFailures(page, REQUIRED_DEMOS, DEFAULT_PAGE_HREF));

  // ---- every published link resolves ------------------------------------
  const targets = linkTargets(page, `${base}/`);
  if (targets.length === 0) {
    say("link  (none published)");
  }
  for (const target of targets) {
    const response = await get(target.url);
    if ("error" in response) {
      say(`link  ${target.url} UNREACHABLE (${response.error}) [${target.label}]`);
      failures.push(`${target.label}: ${target.url} does not resolve — ${response.error}`);
      continue;
    }
    say(`link  ${target.url} ${response.status} [${target.label}]`);
    if (response.status !== 200) {
      failures.push(`${target.label}: ${target.url} answered ${response.status}, expected 200`);
    }
  }

  // ---- GET /api/health ---------------------------------------------------
  const health = await get(`${base}/api/health`);
  if ("error" in health) {
    say(`route GET /api/health    UNREACHABLE (${health.error})`);
    failures.push(`GET /api/health did not answer: ${health.error}`);
    return report(failures);
  }
  say(`route GET /api/health    ${health.status} ${health.body.trim()}`);
  if (health.status !== 200) {
    failures.push(`GET /api/health answered ${health.status}, expected 200`);
  }
  if (!health.contentType.includes("application/json")) {
    failures.push(`GET /api/health content-type is "${health.contentType}", expected JSON`);
  }
  try {
    const parsed = JSON.parse(health.body);
    if (parsed === null || typeof parsed !== "object") {
      failures.push("GET /api/health did not return a JSON object");
    } else {
      if (parsed.ok !== true) {
        failures.push(`GET /api/health returned ok=${JSON.stringify(parsed.ok)}, expected true`);
      }
      if (parsed.service !== "gocklkatz") {
        failures.push(
          `GET /api/health returned service=${JSON.stringify(parsed.service)}, expected "gocklkatz"`,
        );
      }
    }
  } catch (error) {
    failures.push(
      `GET /api/health did not parse as JSON: ${error instanceof Error ? error.message : error}`,
    );
  }

  return report(failures);
}

/**
 * @param {string[]} failures
 * @returns {number}
 */
function report(failures) {
  if (failures.length === 0) {
    console.log("probe: ok");
    return 0;
  }
  console.log("");
  for (const failure of failures) {
    console.log(`probe: FAIL ${failure}`);
  }
  console.log(`probe: ${failures.length} failure(s)`);
  return 1;
}

/**
 * @param {string[]} argv
 * @returns {Promise<number>}
 */
async function main(argv) {
  const [command, first, second] = argv;

  switch (command) {
    case "port-free": {
      const port = Number(first);
      if (!Number.isInteger(port) || port <= 0) {
        console.error("probe: port-free requires a port number");
        return 2;
      }
      if (await portIsFree(port)) {
        return 0;
      }
      console.error(`probe: port ${port} is already in use on 127.0.0.1`);
      return 1;
    }
    case "wait": {
      if (!first) {
        console.error("probe: wait requires a base URL");
        return 2;
      }
      const timeoutMs = Number(second ?? 30_000);
      if (await waitForServer(first, timeoutMs)) {
        return 0;
      }
      console.error(`probe: ${first} did not answer within ${timeoutMs}ms`);
      return 1;
    }
    case "check": {
      if (!first) {
        console.error("probe: check requires a base URL");
        return 2;
      }
      return await check(first);
    }
    default:
      console.error("probe: expected one of port-free, wait, check");
      return 2;
  }
}

// Only the CLI path runs; scripts/probe.test.mjs imports the functions above.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
