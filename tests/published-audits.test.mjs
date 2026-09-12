#!/usr/bin/env node
/**
 * Self-test for the published-link audit's decision rules.
 *
 * Three rules in `tools/audit-published-links.mjs` decide whether a link is fine, broken, or beyond
 * what an anonymous scripted client can judge, and one of them was written because it had already
 * gone wrong: `looksLikeAddress` exists because a bare `https://` inside this tool's own comment was
 * discovered as a published URL. The tool had been generated while still untracked — so it did not
 * scan itself — and committing it turned the repository gate red on a fragment of a comment.
 *
 * Runs two ways, like `tests/licence-audit.test.mjs`: `node tests/published-audits.test.mjs` for the
 * gate, and under Vitest for the application suite. The `isDirect` check below keeps the two paths
 * apart, because the Node path does not need Vitest installed.
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const FIXTURE_DIR = join(REPO_ROOT, "var", "published-audits-test");

const audit = await import(pathToFileURL(join(REPO_ROOT, "tools", "audit-published-links.mjs")));
const { looksLikeAddress, relativeLinkProblems, statusIsOk } = audit;

/**
 * Each case returns a list of `{ label, ok }` checks. Both runners assert the same ones.
 */
const CASES = [
  {
    id: "bare-scheme",
    label: "a bare scheme is not an address",
    run: () => [
      {
        label: "rejects the bare `https://` that broke the gate",
        ok: looksLikeAddress("https://") === false,
      },
      { label: "rejects a bare `http://`", ok: looksLikeAddress("http://") === false },
      {
        label: "rejects a scheme followed only by a slash",
        ok: looksLikeAddress("https:///path") === false,
      },
      {
        label: "accepts an address with a host",
        ok: looksLikeAddress("https://example.com/x") === true,
      },
      {
        label: "accepts a host with no path",
        ok: looksLikeAddress("https://example.com") === true,
      },
      {
        label: "accepts a host and port",
        ok: looksLikeAddress("http://127.0.0.1:43124/") === true,
      },
    ],
  },
  {
    id: "recorded-status",
    label: "--check's verdict on a recorded status",
    run: () => [
      { label: "a 2xx is ok", ok: statusIsOk("200") === true },
      { label: "a recorded `ok` is ok", ok: statusIsOk("ok") === true },
      {
        label: "a recorded unverifiable observation is accepted",
        ok: statusIsOk("unverifiable: HTTP 403 to an anonymous client") === true,
      },
      {
        label: "a 404 is never accepted, whatever is recorded",
        ok: statusIsOk("FAIL: HTTP 404") === false,
      },
      {
        label: "a 500 is never accepted",
        ok: statusIsOk("FAIL: HTTP 500") === false,
      },
      {
        label: "a login redirect is never accepted",
        ok: statusIsOk("FAIL: 307 to an authentication host") === false,
      },
    ],
  },
  {
    id: "relative-links",
    label: "relative markdown links resolve against the file they appear in",
    run: () => {
      // Paths are repository-relative, because that is what `relativeLinkProblems` resolves against.
      const rel = "var/published-audits-test/docs";
      const dir = join(FIXTURE_DIR, "docs");
      mkdirSync(join(dir, "sub"), { recursive: true });
      writeFileSync(join(dir, "target.md"), "# target\n");
      writeFileSync(join(dir, "target.json"), "{}\n");
      writeFileSync(
        join(dir, "good.md"),
        [
          "# good",
          "[one](target.md)",
          "[two](./target.json)",
          "[three](sub/../target.md)",
          "[external](https://example.com/)",
          "[anchor](#section)",
          "[mail](mailto:someone@example.com)",
        ].join("\n"),
      );
      writeFileSync(
        join(dir, "bad.md"),
        ["# bad", "[gone](./never-existed.md)", "[also](./nope.json)"].join("\n"),
      );

      const good = relativeLinkProblems([`${rel}/good.md`]);
      const bad = relativeLinkProblems([`${rel}/bad.md`]);

      return [
        { label: "a resolvable relative link raises nothing", ok: good.length === 0 },
        { label: "a dead relative link is reported", ok: bad.length === 2 },
        {
          label: "the report names the file and the target",
          ok: bad.some((p) => p.includes(`${rel}/bad.md`) && p.includes("./never-existed.md")),
        },
      ];
    },
  },
];

function cleanup() {
  rmSync(FIXTURE_DIR, { recursive: true, force: true });
}

function runAsNode() {
  console.log("published-audits self-test");
  let pass = 0;
  let fail = 0;

  for (const testCase of CASES) {
    console.log(`\ncase: ${testCase.label}`);
    let checks;
    try {
      checks = testCase.run();
    } catch (error) {
      console.log(`  FAIL ${testCase.label} threw: ${error.message}`);
      fail += 1;
      continue;
    }
    for (const check of checks) {
      if (check.ok) {
        console.log(`  ok   ${check.label}`);
        pass += 1;
      } else {
        console.log(`  FAIL ${check.label}`);
        fail += 1;
      }
    }
  }

  cleanup();
  console.log(`\npublished-audits self-test: ${pass} passed, ${fail} failed`);
  return fail === 0 ? 0 : 1;
}

const isDirect =
  process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirect) {
  process.exit(runAsNode());
}

const { afterAll, describe, expect, it } = await import("vitest");

describe("published-audits rules", () => {
  afterAll(cleanup);

  for (const testCase of CASES) {
    it(testCase.label, () => {
      for (const check of testCase.run()) {
        expect(check.ok, check.label).toBe(true);
      }
    });
  }
});
