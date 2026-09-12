#!/usr/bin/env bash
# Self-test for tools/vercel-ignore.sh.
#
# That script decides whether five production projects rebuild, through an INVERTED exit code:
# **0 skips the build, 1 or greater builds it.** A mistake in it does not fail loudly — it silently
# stops deploying, which is the failure this repository spent four hours on 2026-09-12 not
# diagnosing. So the polarity is asserted in both directions here rather than described in a comment.
#
# The fixtures are real commits from this repository, chosen because each has a shape the rule must
# get right. The rule is given an explicit base and head, so nothing is checked out and the working
# tree is never touched.
#
# Written for bash 3.2, which is what macOS ships as /bin/bash.

set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO" || exit 2

pass=0
fail=0

# expect <label> <root arg> <commit> <expected exit> <expected word>
expect() {
    local label="$1" arg="$2" sha="$3" want_rc="$4" want_word="$5"
    local out rc
    out="$(bash tools/vercel-ignore.sh "$arg" "${sha}^" "$sha" 2>&1)"
    rc=$?
    if [ "$rc" != "$want_rc" ]; then
        echo "  FAIL $label (expected exit $want_rc, got $rc)"
        printf '%s\n' "$out" | sed 's/^/       /'
        fail=$((fail + 1))
        return
    fi
    if ! printf '%s' "$out" | grep -q "$want_word"; then
        echo "  FAIL $label (ran, but did not report '$want_word')"
        printf '%s\n' "$out" | sed 's/^/       /'
        fail=$((fail + 1))
        return
    fi
    echo "  ok   $label"
    pass=$((pass + 1))
}

echo "vercel-ignore self-test (bash ${BASH_VERSION%%(*})"

# Fixture commits. Each is verified to have the shape this test relies on, so a future rebase that
# changed it fails loudly here rather than silently testing nothing.
DOCS_ONLY="$(git rev-parse --verify --quiet a285366^{commit} || echo '')"
LANDING="$(git rev-parse --verify --quiet 31115a3^{commit} || echo '')"
NEW_APP="$(git rev-parse --verify --quiet 85b136f^{commit} || echo '')"

if [ -z "$DOCS_ONLY" ] || [ -z "$LANDING" ] || [ -z "$NEW_APP" ]; then
    echo "  FAIL a fixture commit is missing from this clone"
    exit 1
fi

# Assert the fixtures still have the shape the expectations assume.
shape_ok=1
if [ -n "$(git diff --name-only "${DOCS_ONLY}^" "$DOCS_ONLY" | grep -v '^docs/' | grep -v '^LESSONS_LEARNED\.md$' || true)" ]; then
    echo "  FAIL the docs-only fixture now changes something outside docs/"
    shape_ok=0
fi
if ! git diff --name-only "${LANDING}^" "$LANDING" | grep -q '^src/lib/demos\.ts$'; then
    echo "  FAIL the landing-page fixture no longer changes src/lib/demos.ts"
    shape_ok=0
fi
if ! git diff --name-only "${NEW_APP}^" "$NEW_APP" | grep -q '^apps/arbeitsmarkt/'; then
    echo "  FAIL the new-app fixture no longer adds apps/arbeitsmarkt"
    shape_ok=0
fi
if [ "$shape_ok" = "1" ]; then
    echo "  ok   the fixture commits still have the shapes this test assumes"
    pass=$((pass + 1))
else
    fail=$((fail + 1))
fi

echo
echo "  --- a docs-only commit skips every project ---"
# This is the commit that stalled production. It touched LESSONS_LEARNED.md and docs/DEPLOY.md, which
# are inputs to no build, so nothing rebuilding is correct — and correct is not the same as what
# happened on 2026-09-12.
expect "landing page skips on a docs-only commit" "." "$DOCS_ONLY" 0 "skip"
expect "Ameisenwerkstatt skips on a docs-only commit" "apps/ameisenwerkstatt" "$DOCS_ONLY" 0 "skip"
expect "Simplified skips on a docs-only commit" "apps/simplified" "$DOCS_ONLY" 0 "skip"
expect "Bienenstock skips on a docs-only commit" "apps/bienenstock" "$DOCS_ONLY" 0 "skip"
expect "Arbeitsmarkt skips on a docs-only commit" "apps/arbeitsmarkt" "$DOCS_ONLY" 0 "skip"

echo
echo "  --- a change to the landing page's own file rebuilds it, and only it ---"
expect "landing page builds when src/lib/demos.ts changed" "." "$LANDING" 1 "build"
expect "an untouched app skips on the same commit" "apps/bienenstock" "$LANDING" 0 "skip"

echo
echo "  --- adding an app rebuilds that app, not its siblings ---"
expect "the new app builds" "apps/arbeitsmarkt" "$NEW_APP" 1 "build"
expect "a sibling app skips" "apps/simplified" "$NEW_APP" 0 "skip"
expect "the landing page builds, because src/lib/demos.ts changed too" "." "$NEW_APP" 1 "build"

echo
echo "  --- misuse must BUILD, never skip ---"
# An unreadable state has to fall on the build side: an unnecessary build costs a minute, a wrongly
# skipped build costs a deployment nobody notices is stale.
out="$(bash tools/vercel-ignore.sh 2>&1)"; rc=$?
if [ "$rc" = "2" ]; then
    echo "  ok   no argument is misuse (exit 2, not a silent skip)"
    pass=$((pass + 1))
else
    echo "  FAIL no argument should exit 2, got $rc"
    fail=$((fail + 1))
fi

out="$(bash tools/vercel-ignore.sh . not-a-real-sha not-a-real-sha 2>&1)"; rc=$?
if [ "$rc" = "1" ] && printf '%s' "$out" | grep -q "build"; then
    echo "  ok   an unresolvable base is reported as build, not skip"
    pass=$((pass + 1))
else
    echo "  FAIL an unresolvable base must build; got exit $rc"
    fail=$((fail + 1))
fi

out="$(bash tools/vercel-ignore.sh . "$DOCS_ONLY" "$DOCS_ONLY" 2>&1)"; rc=$?
if [ "$rc" = "0" ] && printf '%s' "$out" | grep -q "nothing changed"; then
    echo "  ok   an empty change set skips, and says so"
    pass=$((pass + 1))
else
    echo "  FAIL an empty change set should skip; got exit $rc"
    fail=$((fail + 1))
fi

echo
echo "vercel-ignore self-test: $pass passed, $fail failed"
[ "$fail" -eq 0 ] || exit 1
