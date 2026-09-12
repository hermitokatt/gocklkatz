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

/** @typedef {{ slug: string, status: string | null, hrefs: string[], block: string, claim: string | null, claimSource: string | null, claimSourceHref: string | null, claimCommand: string | null }} Card */
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
 * Read one attribute out of a fragment of markup, or null when it is absent.
 *
 * @param {string} markup
 * @param {string} name attribute name, lowercased
 * @returns {string | null}
 */
function attributeValue(markup, name) {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i");
  const m = re.exec(markup);
  if (m === null) {
    return null;
  }
  return decodeAttribute(m[1] ?? m[2] ?? m[3] ?? "");
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

    const block = html.slice(bodyStart, closeAt);
    cards.push({
      slug,
      status: attributeValue(match[0], "data-status"),
      block,
      hrefs: hrefsIn(block),
      // Requirement 1 of ticket GOC-11: every card carries a measured claim, the file it came from,
      // and the command that reproduces it. Read here rather than trusted, because the card is what
      // a visitor sees.
      claim: attributeValue(block, "data-claim"),
      claimSource: attributeValue(block, "data-claim-source"),
      // `data-claim-source` records the repository-relative path; the fetchable URL is the href of
      // the anchor that carries it. Reading the attribute as if it were the URL was the first
      // version of this check, and it failed on links that were resolving fine.
      claimSourceHref: (() => {
        const m =
          /<a\b[^>]*?\bdata-claim-source\s*=[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(
            block,
          ) ??
          /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))[^>]*?\bdata-claim-source\s*=/i.exec(
            block,
          );
        return m === null ? null : decodeAttribute(m[1] ?? m[2] ?? m[3] ?? "");
      })(),
      claimCommand: attributeValue(block, "data-claim-command"),
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
 * The card-level half of the claim rule: a live card must carry a claim, name its source, and link
 * to it. The reachability of that link is checked separately, because it needs a fetch.
 *
 * Exported so scripts/probe.test.mjs can exercise both directions without a server — the fetch is
 * the only part this predicate cannot cover, and the fetch is the part the ticket's A-2
 * demonstrates by hand.
 *
 * @param {Card} card
 * @returns {string[]} problems, empty when the card satisfies the rule
 */
export function claimCardProblems(card) {
  /** @type {string[]} */
  const problems = [];
  if (card.status !== "live") {
    return problems;
  }
  const label = `card "${card.slug}"`;
  if (!card.claim || card.claim.trim().length < 10) {
    problems.push(`${label}: publishes no measured claim (data-claim)`);
    return problems;
  }
  if (!card.claimSource) {
    problems.push(`${label}: its claim names no source (data-claim-source)`);
    return problems;
  }
  if (!card.claimCommand) {
    problems.push(`${label}: its claim names no reproducing command (data-claim-command)`);
    return problems;
  }
  if (!card.claimSourceHref || !/^https:\/\//.test(card.claimSourceHref)) {
    problems.push(
      `${label}: records the source "${card.claimSource}" but renders no link to it (data-claim-source needs an absolute href)`,
    );
  }
  return problems;
}

/**
 * The claim rule's other half: the card must publish a count.
 *
 * A claim of the form "62 tests over X, all passing" is checkable, and `npm run test` is the
 * command that checks it. A claim with no number in it would pass everything else here while
 * telling the reader nothing, so the shape is asserted rather than left to the card's discretion.
 *
 * The VALUE is deliberately not asserted here: `scripts/ci.sh` in each app runs the suite, and
 * scripts/verify.sh fetches the cited source. This predicate only refuses a claim that publishes no
 * measurement at all.
 *
 * @param {Card} card
 * @returns {string[]}
 */
export function claimCountProblems(card) {
  if (card.status !== "live") {
    return [];
  }
  if (!card.claim) {
    return [];
  }
  if (!/^\d+ tests? over /.test(card.claim.trim())) {
    return [
      `card "${card.slug}": its claim states no measured count — "${card.claim}" should begin with "<n> tests over …"`,
    ];
  }
  return [];
}

/**
 * Every stylesheet the served page links, so a layout rule can be read from what the browser is
 * actually sent rather than from the file in the repository.
 *
 * @param {string} html
 * @returns {string[]}
 */
export function stylesheetHrefs(html) {
  /** @type {string[]} */
  const hrefs = [];
  const link = /<link\b[^>]*>/gi;
  let match;
  while ((match = link.exec(html)) !== null) {
    const tag = match[0];
    if (
      !/\brel\s*=\s*(?:"[^"]*\bstylesheet\b[^"]*"|'[^']*\bstylesheet\b[^']*'|stylesheet)/i.test(tag)
    ) {
      continue;
    }
    const href = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(tag);
    if (href === null) {
      continue;
    }
    const value = decodeAttribute(href[1] ?? href[2] ?? href[3] ?? "");
    if (value !== "") {
      hrefs.push(value);
    }
  }
  return hrefs;
}

/**
 * Declarations of every rule whose selector is exactly `className`, across the concatenated
 * stylesheets, as `property -> value` with the last declaration winning — which is what the
 * cascade does for rules of equal specificity.
 *
 * @param {string} css
 * @param {string} className
 * @returns {Map<string, string>}
 */
function declarationsFor(css, className) {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Comments first: `app/globals.css` documents its rules, and a rule preceded by a comment is
  // preceded by `*/`, which is neither the start of the sheet nor a brace. A selector may also
  // begin a block rather than follow another rule, which a media query needs.
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rule = new RegExp(`(?:^|[}{,])\\s*\\.${escaped}\\s*(?:,[^{]*)?\\{([^}]*)\\}`, "gi");
  /** @type {Map<string, string>} */
  const declarations = new Map();
  let match;
  while ((match = rule.exec(clean)) !== null) {
    for (const declaration of (match[1] ?? "").split(";")) {
      const at = declaration.indexOf(":");
      if (at === -1) {
        continue;
      }
      const property = declaration.slice(0, at).trim().toLowerCase();
      const value = declaration.slice(at + 1).trim();
      if (property !== "") {
        declarations.set(property, value);
      }
    }
  }
  return declarations;
}

/** `css` length prefix as a number, or null when the value is not a length we can judge. */
function lengthValue(/** @type {string} */ value) {
  const match = /^\s*([+-]?(?:\d+\.?\d*|\.\d+))/.exec(value);
  return match === null || match[1] === undefined ? null : Number(match[1]);
}

/**
 * The landing page's provenance line renders a file path and the command that reproduces its claim
 * side by side. They were adjacent inline elements, so a served card read
 *
 *     apps/simplified/tests/radicals.test.tsreproduce: npm run test
 *
 * — two unrelated facts fused into one string, with no error anywhere to say so. The fix is a gap,
 * and **a gap only separates flex and grid children**: set the container back to `block` and the
 * rule still parses, still applies, and silently stops doing anything.
 *
 * So both halves are asserted against the stylesheet the server actually sends: the line is a flex
 * container, and its horizontal gap is a non-zero length. Either one alone is passable by a broken
 * page — `display: flex` with no gap still runs the text together, and a gap on a block container
 * does nothing at all. Exported so scripts/probe.test.mjs can exercise it on the pre-fix
 * stylesheet, which is the case that must fail.
 *
 * @param {string} css all served stylesheets, concatenated
 * @returns {string[]} problems, empty when the line is separated by layout rather than narration
 */
export function provenanceLayoutProblems(css) {
  /** @type {string[]} */
  const problems = [];
  const declarations = declarationsFor(css, "card__provenance");
  if (declarations.size === 0) {
    problems.push(
      "the served stylesheets define no .card__provenance rule, so the card's source path and its reproduce command have no layout separating them",
    );
    return problems;
  }

  const display = declarations.get("display") ?? "";
  if (!/^(inline-)?flex$|^grid$/.test(display.trim().toLowerCase())) {
    problems.push(
      `.card__provenance has display: ${display === "" ? "<unset>" : display}, which is not flex or grid — its gap cannot separate anything, and the source path and the reproduce command run together`,
    );
  }

  // The column gap is what separates the two items when they share a line: `gap: A B` is row then
  // column, a single `gap: A` is both, and `column-gap` overrides the shorthand's second value.
  let column = declarations.get("column-gap");
  if (column === undefined) {
    const gap = declarations.get("gap");
    if (gap === undefined) {
      problems.push(
        ".card__provenance declares no gap, so the source path and the reproduce command are laid out flush against each other",
      );
      return problems;
    }
    const parts = gap.trim().split(/\s+/);
    column = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  }
  const width = column === undefined ? null : lengthValue(column);
  if (width === null) {
    problems.push(`.card__provenance column gap is not a length this check can read: "${column}"`);
  } else if (width <= 0) {
    problems.push(
      `.card__provenance column gap is ${column}, which separates nothing — the source path and the reproduce command run together`,
    );
  }
  return problems;
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

  // ---- every card carries a measured, sourced claim (ticket GOC-11) -----
  //
  // Requirement 1: a claim, the file it came from, and the command that reproduces it. Requirement
  // 3: the source is LINKED, so a reader who doubts a number can open the file it came from. The
  // fetch below asserts that link answers 200 and NAMES THE CARD when it does not, which is what
  // A-2 of the ticket asks for. A rendered anchor is not the same as a reachable one.
  for (const card of page.cards) {
    const label = `card "${card.slug}"`;
    const problems = [...claimCardProblems(card), ...claimCountProblems(card)];
    if (problems.length > 0) {
      failures.push(...problems);
      continue;
    }
    if (card.status !== "live") {
      continue;
    }
    say(`claim ${card.slug.padEnd(18)} ${card.claimSource}  [${card.claimCommand}]`);

    // Already asserted non-null by claimCardProblems above; restated for the type checker.
    if (!card.claimSourceHref) {
      continue;
    }
    const source = await get(card.claimSourceHref);
    if ("error" in source) {
      failures.push(
        `${label}: its claim source does not resolve — ${card.claimSourceHref} (${source.error})`,
      );
      continue;
    }
    if (source.status !== 200) {
      failures.push(
        `${label}: its claim source answered ${source.status}, expected 200 — ${card.claimSourceHref}`,
      );
      continue;
    }
    say(`claim ${card.slug.padEnd(18)} source ${source.status}`);
  }

  // ---- the provenance line is separated by layout, not by a space character ----------
  //
  // The markup checks above cannot see this. Two adjacent inline spans carry every data attribute
  // the probe reads and are perfectly well-formed; the page is simply unreadable. That is the half
  // that needs the stylesheet, so it is read from what the server sends rather than from the file
  // in the repository — a rule that exists only in the working tree is not a rule the visitor got.
  const stylesheets = stylesheetHrefs(home.body);
  if (stylesheets.length === 0) {
    failures.push(
      "GET / links no stylesheet, so the card layout cannot be read from what the server actually sends",
    );
  }
  /** @type {string[]} */
  const cssParts = [];
  for (const href of stylesheets) {
    const url = new URL(href, `${base}/`).toString();
    const sheet = await get(url);
    if ("error" in sheet) {
      failures.push(`the stylesheet ${url} does not resolve (${sheet.error})`);
      continue;
    }
    if (sheet.status !== 200) {
      failures.push(`the stylesheet ${url} answered ${sheet.status}, expected 200`);
      continue;
    }
    cssParts.push(sheet.body);
  }
  const layoutProblems = provenanceLayoutProblems(cssParts.join("\n"));
  if (cssParts.length > 0) {
    say(`css   ${cssParts.length} stylesheet(s), ${cssParts.join("").length} bytes`);
  }
  if (layoutProblems.length > 0) {
    failures.push(...layoutProblems);
  } else {
    say("css   .card__provenance is a flex line with a non-zero column gap");
  }

  // ---- the portfolio intro (ticket GOC-12) ------------------------------
  //
  // Requirement 1: one short paragraph at the top saying what these projects are and what connects
  // them. Requirement 2: it must be specific — "Welcome to my portfolio" is explicitly not
  // acceptable. Two assertion directions, because either alone is passable by the wrong text:
  //
  //   absence   the paragraph is there at all
  //   quality   it names the properties the repository actually has, so a greeting cannot satisfy it
  //
  // The words below are the ones site.intro uses, and they are the repository's own rules: every
  // demo here is built, tested, deployed and verified by running it.
  const intro = /<p\b[^>]*\bdata-intro\b[^>]*>([\s\S]*?)<\/p>/i.exec(home.body);
  // The match index is typed as possibly undefined; normalise once rather than asserting.
  const introText = intro === null ? null : (intro[1] ?? "");
  if (introText === null) {
    failures.push("GET / does not publish the portfolio intro (no <p data-intro>)");
  } else {
    const text = introText
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    say(`intro ${text.length} chars`);
    if (text.length < 120) {
      failures.push(
        `the portfolio intro is ${text.length} characters; ticket GOC-12 asks for a paragraph`,
      );
    }
    for (const word of ["built", "tested", "deployed", "verified"]) {
      if (!new RegExp(`\\b${word}\\b`, "i").test(text)) {
        failures.push(
          `the portfolio intro does not say the demos are ${word}; a greeting is not specific enough`,
        );
      }
    }
  }

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
