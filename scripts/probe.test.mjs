import { describe, expect, it } from "vitest";
import { cardFailures, hrefsIn, linkTargets, parsePage } from "./probe.mjs";

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
