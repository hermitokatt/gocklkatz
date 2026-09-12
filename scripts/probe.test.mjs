import { describe, expect, it } from "vitest";
import { cardFailures, claimCardProblems, hrefsIn, linkTargets, parsePage } from "./probe.mjs";

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

describe("claimCardProblems — one measured, sourced claim per live card", () => {
  const SOURCE = "apps/example/tests/example.test.ts";
  const HREF = `https://example.invalid/blob/main/${SOURCE}`;

  /**
   * @param {{ status?: string, claim?: string | null, source?: string | null, href?: string | null, command?: string | null }} over
   */
  function claimCard(over = {}) {
    const markup = `<article data-demo="example" data-status="${over.status ?? "live"}">
      <p data-claim="${over.claim ?? "12 tests over the example fixture, all passing"}">…</p>
      <a href="${over.href ?? HREF}" data-claim-source="${over.source ?? SOURCE}">${over.source ?? SOURCE}</a>
      <code data-claim-command="${over.command ?? "npm run test"}">…</code>
    </article>`;
    const parsed = parsePage(markup).cards[0];
    if (!parsed) {
      throw new Error("the fixture markup did not parse into a card");
    }
    return parsed;
  }

  it("accepts a live card that carries claim, source and command", () => {
    expect(claimCardProblems(claimCard())).toEqual([]);
  });

  it("reads the claim fields off the served markup", () => {
    const card = claimCard();
    expect(card.claim).toBe("12 tests over the example fixture, all passing");
    expect(card.claimSource).toBe(SOURCE);
    expect(card.claimSourceHref).toBe(HREF);
    expect(card.claimCommand).toBe("npm run test");
  });

  it("exempts a card that is not live", () => {
    // An in-development card has no deployment, so there is nothing for a claim to be about yet.
    expect(claimCardProblems(claimCard({ status: "in-development" }))).toEqual([]);
  });

  it("rejects a live card with no claim", () => {
    const problems = claimCardProblems(claimCard({ claim: "" }));
    expect(problems.join(" ")).toMatch(/no measured claim/);
  });

  it("rejects a claim that names no source", () => {
    const problems = claimCardProblems(claimCard({ source: "" }));
    expect(problems.join(" ")).toMatch(/names no source/);
  });

  it("rejects a claim with no reproducing command", () => {
    // AGENTS.md section 4: a number nobody can re-derive is a claim, not a measurement.
    const problems = claimCardProblems(claimCard({ command: "" }));
    expect(problems.join(" ")).toMatch(/no reproducing command/);
  });

  it("rejects a source that is recorded but not linked", () => {
    // Requirement 3: the reader must be able to check the number in two clicks.
    const problems = claimCardProblems(claimCard({ href: "", source: SOURCE }));
    expect(problems.join(" ")).toMatch(/renders no link to it/);
  });

  it("rejects a relative href, which a reader could not follow as a link", () => {
    const problems = claimCardProblems(claimCard({ href: SOURCE }));
    expect(problems.join(" ")).toMatch(/renders no link to it/);
  });

  it("names the card whose claim is wrong", () => {
    expect(claimCardProblems(claimCard({ command: "" })).join(" ")).toContain('card "example"');
  });
});
