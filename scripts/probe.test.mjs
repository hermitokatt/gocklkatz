import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  cardFailures,
  claimCardProblems,
  hrefsIn,
  linkTargets,
  parsePage,
  provenanceLayoutProblems,
  stylesheetHrefs,
} from "./probe.mjs";

const ANTS = { slug: "ameisenwerkstatt", name: "Ameisenwerkstatt" };
const BEES = { slug: "bienenstock", name: "Bienenstock" };
const REQUIRED = [ANTS, BEES];

/**
 * @param {{ slug: string, name: string, status: string, href?: string }} demo
 * @returns {string}
 */
function card({ slug, name, status, href }) {
  const action = href ? `<a href="${href}">Open the demo</a>` : "<span>Not yet deployed</span>";
  return `<article class="card" data-demo="${slug}" data-status="${status}"><h3>${name}</h3><p>desc</p><p>${action}</p></article>`;
}

/**
 * @param {string} body
 * @returns {string}
 */
function page(body) {
  return `<!DOCTYPE html><html><body><main>${body}<footer><a href="https://example.invalid/repo">source</a></footer></main></body></html>`;
}

const goodPage = page(REQUIRED.map((demo) => card({ ...demo, status: "in-development" })).join(""));

describe("parsePage", () => {
  it("finds one card per article and keeps them in document order", () => {
    const parsed = parsePage(goodPage);
    expect(parsed.cards.map((entry) => entry.slug)).toEqual(["ameisenwerkstatt", "bienenstock"]);
    expect(parsed.cards.map((entry) => entry.status)).toEqual(["in-development", "in-development"]);
  });

  it("keeps markup outside the cards, so the footer's link is still seen", () => {
    const parsed = parsePage(goodPage);
    expect(hrefsIn(parsed.outside)).toEqual(["https://example.invalid/repo"]);
    expect(parsed.outside).not.toContain("data-demo");
  });

  it("attributes an anchor to the card that contains it", () => {
    const parsed = parsePage(
      page(card({ ...ANTS, status: "live", href: "https://example.invalid/demo" })),
    );
    expect(parsed.cards[0]?.hrefs).toEqual(["https://example.invalid/demo"]);
  });
});

describe("cardFailures — the passing direction", () => {
  it("accepts in-development cards that render no anchor", () => {
    expect(cardFailures(parsePage(goodPage), REQUIRED)).toEqual([]);
  });

  it("accepts a live card that links to an absolute URL", () => {
    const html = page(
      [
        card({ ...ANTS, status: "live", href: "https://example.invalid/demo" }),
        card({ ...BEES, status: "in-development" }),
      ].join(""),
    );
    expect(cardFailures(parsePage(html), REQUIRED)).toEqual([]);
  });
});

describe("cardFailures — the directions that must fail", () => {
  it("fails, naming the card, when an in-development card renders an anchor", () => {
    const html = page(
      [
        card({ ...ANTS, status: "in-development", href: "https://example.invalid/demo" }),
        card({ ...BEES, status: "in-development" }),
      ].join(""),
    );
    const failures = cardFailures(parsePage(html), REQUIRED);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('card "ameisenwerkstatt"');
    expect(failures[0]).toContain("must render no anchor");
  });

  it("fails, naming the card, when a live card renders no anchor", () => {
    const html = page(
      [card({ ...ANTS, status: "live" }), card({ ...BEES, status: "in-development" })].join(""),
    );
    const failures = cardFailures(parsePage(html), REQUIRED);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('card "ameisenwerkstatt"');
    expect(failures[0]).toContain("renders no anchor");
  });

  it("fails when a live card links somewhere that is not an absolute URL", () => {
    const html = page(
      [
        card({ ...ANTS, status: "live", href: "/ameisenwerkstatt" }),
        card({ ...BEES, status: "in-development" }),
      ].join(""),
    );
    const failures = cardFailures(parsePage(html), REQUIRED);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("not an absolute https URL");
  });

  it("fails when a live card links over plain http, which is not a link to publish", () => {
    const html = page(
      [
        card({ ...ANTS, status: "live", href: "http://example.invalid/demo" }),
        card({ ...BEES, status: "in-development" }),
      ].join(""),
    );
    const failures = cardFailures(parsePage(html), REQUIRED);
    expect(failures.join("\n")).toContain("not an absolute https URL");
  });

  it("fails on a status that is neither live nor in-development", () => {
    const html = page(
      [card({ ...ANTS, status: "soon" }), card({ ...BEES, status: "in-development" })].join(""),
    );
    const failures = cardFailures(parsePage(html), REQUIRED);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('status "soon" is not one of');
  });

  it("fails on a card that renders no status at all, rather than passing vacuously", () => {
    const html = page(
      `<article data-demo="ameisenwerkstatt"><h3>Ameisenwerkstatt</h3><a href="https://example.invalid/x">go</a></article>` +
        card({ ...BEES, status: "in-development" }),
    );
    const failures = cardFailures(parsePage(html), REQUIRED);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("renders no data-status");
  });

  it("fails on a page with no cards, so an empty scan cannot report clean", () => {
    const failures = cardFailures(parsePage(page("")), REQUIRED);
    expect(failures[0]).toContain("no demo cards found");
    expect(failures).toHaveLength(3);
  });

  it("fails when a required demo is missing", () => {
    const html = page(card({ ...ANTS, status: "in-development" }));
    const failures = cardFailures(parsePage(html), REQUIRED);
    expect(failures).toEqual(['card "bienenstock": missing from the page']);
  });

  it("fails when a card's markup does not carry the demo's name", () => {
    const html = page(
      [
        card({ slug: "ameisenwerkstatt", name: "Ant Workshop", status: "in-development" }),
        card({ ...BEES, status: "in-development" }),
      ].join(""),
    );
    const failures = cardFailures(parsePage(html), REQUIRED);
    expect(failures).toEqual([
      'card "ameisenwerkstatt": does not render its name "Ameisenwerkstatt"',
    ]);
  });

  it("fails when a card's article is never closed", () => {
    const html = `<main><article data-demo="ameisenwerkstatt" data-status="live"><h3>Ameisenwerkstatt</h3>`;
    const failures = cardFailures(parsePage(html), REQUIRED);
    expect(failures[0]).toContain("never closed");
  });
});

describe("linkTargets", () => {
  it("labels a card's link with the card, and the rest with the page", () => {
    const html = page(
      [
        card({ ...ANTS, status: "live", href: "https://example.invalid/demo" }),
        card({ ...BEES, status: "in-development" }),
      ].join(""),
    );
    expect(linkTargets(parsePage(html), "http://127.0.0.1:43124/")).toEqual([
      { label: 'card "ameisenwerkstatt"', url: "https://example.invalid/demo" },
      { label: "page", url: "https://example.invalid/repo" },
    ]);
  });

  it("resolves a relative link against the served origin", () => {
    const parsed = parsePage(`<footer><a href="/imprint">imprint</a></footer>`);
    expect(linkTargets(parsed, "http://127.0.0.1:43124/")).toEqual([
      { label: "page", url: "http://127.0.0.1:43124/imprint" },
    ]);
  });

  it("skips fragments and non-HTTP schemes, which are not fetchable", () => {
    const parsed = parsePage(
      `<footer><a href="#main">skip</a><a href="mailto:someone@example.invalid">mail</a></footer>`,
    );
    expect(linkTargets(parsed, "http://127.0.0.1:43124/")).toEqual([]);
  });
});

/**
 * Regression tests for the two bypasses an independent review demonstrated against this probe.
 * Both were real: the check reported `no anchor` for a card that was entirely clickable.
 */
describe("bypasses the review demonstrated, now closed", () => {
  it("sees an anchor whatever its quoting style or tag case", () => {
    expect(hrefsIn(`<a href="https://x.invalid/1">a</a>`)).toEqual(["https://x.invalid/1"]);
    expect(hrefsIn(`<a href='https://x.invalid/2'>a</a>`)).toEqual(["https://x.invalid/2"]);
    expect(hrefsIn(`<a href=https://x.invalid/3>a</a>`)).toEqual(["https://x.invalid/3"]);
    expect(hrefsIn(`<A HREF="https://x.invalid/4">a</A>`)).toEqual(["https://x.invalid/4"]);
  });

  it("catches a wrapping anchor that would otherwise escape into 'outside'", () => {
    // The whole <article> is the link. Containment-based parsing alone lost this.
    const html = page(
      [
        `<a href="https://example.invalid/wrapped"><article data-demo="ameisenwerkstatt" data-status="in-development"><h3>Ameisenwerkstatt</h3></article></a>`,
        card({ ...BEES, status: "in-development" }),
      ].join(""),
    );
    const failures = cardFailures(parsePage(html), REQUIRED, "https://example.invalid/repo");
    expect(failures.join("\n")).toMatch(/not expected|unaccounted|outside the demo cards/);
  });

  it("holds a card to the link rule whatever tag carries data-demo", () => {
    const html = page(
      [
        `<div data-demo="ameisenwerkstatt" data-status="in-development"><h3>Ameisenwerkstatt</h3><a href="https://example.invalid/x">go</a></div>`,
        card({ ...BEES, status: "in-development" }),
      ].join(""),
    );
    const failures = cardFailures(parsePage(html), REQUIRED);
    expect(failures.join("\n")).toMatch(/in-development but it links to/);
  });

  it("does not let a nested tag of the same name end the card early", () => {
    const html = page(
      [
        `<article data-demo="ameisenwerkstatt" data-status="in-development"><div><article><a href="https://example.invalid/nested">go</a></article></div></article>`,
        card({ ...BEES, status: "in-development" }),
      ].join(""),
    );
    const failures = cardFailures(parsePage(html), REQUIRED);
    expect(failures.join("\n")).toMatch(/in-development but it links to/);
  });

  it("fails on an unaccounted page-level anchor when one is declared", () => {
    const html = page(
      [
        card({ ...ANTS, status: "in-development" }),
        card({ ...BEES, status: "in-development" }),
        `<a href="https://example.invalid/surprise">extra</a>`,
      ].join(""),
    );
    const failures = cardFailures(parsePage(html), REQUIRED, "https://example.invalid/repo");
    expect(failures.join("\n")).toMatch(/not\s+expected|not expected/);
  });

  it("does not run the page-level assertion when the caller declares nothing", () => {
    const html = page(card({ ...ANTS, status: "in-development" }));
    expect(cardFailures(parsePage(html), [ANTS])).toEqual([]);
  });
});

describe("claimCardProblems — measured claim, no test-path / reproduce row", () => {
  const SOURCE = "apps/example/tests/example.test.ts";
  const HREF = `https://example.invalid/blob/main/${SOURCE}`;

  /**
   * @param {{ status?: string, claim?: string | null, source?: string | null, href?: string | null, command?: string | null, reproduceText?: boolean }} over
   */
  function claimCard(over = {}) {
    const source =
      over.source === undefined
        ? ""
        : `<a href="${over.href ?? HREF}" data-claim-source="${over.source}">${over.source}</a>`;
    const command =
      over.command === undefined
        ? ""
        : `<code data-claim-command="${over.command}">${over.command}</code>`;
    const reproduce = over.reproduceText ? `<span>reproduce: npm run test</span>` : "";
    const markup = `<article data-demo="example" data-status="${over.status ?? "live"}">
      <p data-claim="${over.claim ?? "12 tests over the example fixture, all passing"}">…</p>
      ${source}
      ${command}
      ${reproduce}
    </article>`;
    const parsed = parsePage(markup).cards[0];
    if (!parsed) {
      throw new Error("the fixture markup did not parse into a card");
    }
    return parsed;
  }

  it("accepts a live card that carries a claim and no provenance row", () => {
    expect(claimCardProblems(claimCard())).toEqual([]);
  });

  it("reads the claim text off the served markup", () => {
    expect(claimCard().claim).toBe("12 tests over the example fixture, all passing");
  });

  it("exempts a card that is not live from the claim-text rule", () => {
    expect(claimCardProblems(claimCard({ status: "in-development" }))).toEqual([]);
  });

  it("rejects a live card with no claim", () => {
    const problems = claimCardProblems(claimCard({ claim: "" }));
    expect(problems.join(" ")).toMatch(/no measured claim/);
  });

  it("rejects the old card that printed the test path and reproduce command", () => {
    // The case that must fail: the four cards used to render
    // "apps/…/tests/….test.ts" and "reproduce: npm run test".
    const problems = claimCardProblems(
      claimCard({ source: SOURCE, href: HREF, command: "npm run test" }),
    );
    expect(problems.join(" ")).toMatch(/test-path \/ reproduce line/);
    expect(problems.join(" ")).toContain('card "example"');
  });

  it("rejects a card that still prints reproduce: even without data attributes", () => {
    const problems = claimCardProblems(claimCard({ reproduceText: true }));
    expect(problems.join(" ")).toMatch(/test-path \/ reproduce line/);
  });
});

describe("stylesheetHrefs", () => {
  it("finds the stylesheet a browser would load", () => {
    const html =
      '<html><head><link rel="preload" href="/fonts/x.woff2"><link rel="stylesheet" href="/_next/static/css/a.css"><link rel="icon" href="/favicon.ico"></head></html>';
    expect(stylesheetHrefs(html)).toEqual(["/_next/static/css/a.css"]);
  });

  it("accepts the multi-token rel values Next.js emits", () => {
    const html = '<link rel="preload stylesheet" href="/x.css">';
    expect(stylesheetHrefs(html)).toEqual(["/x.css"]);
  });

  it("finds nothing when the page links no stylesheet", () => {
    // The case the check must not mistake for "the layout is fine": no CSS at all.
    expect(stylesheetHrefs("<html><head></head><body>bare</body></html>")).toEqual([]);
  });
});

describe("provenanceLayoutProblems", () => {
  const OLD = ".card__provenance{display:flex;flex-wrap:wrap;gap:.35rem .75rem}";

  it("accepts a stylesheet with no .card__provenance rule", () => {
    expect(provenanceLayoutProblems(".card{padding:1.5rem}")).toEqual([]);
  });

  it("accepts the stylesheet committed in this repository", () => {
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    expect(provenanceLayoutProblems(css)).toEqual([]);
    expect(css).not.toMatch(/card__provenance/);
  });

  it("rejects the old stylesheet that still styled the provenance row", () => {
    expect(provenanceLayoutProblems(OLD).join(" ")).toMatch(/still define \.card__provenance/);
  });
});
