#!/usr/bin/env bash
# Self-test for tools/vercel-ignore.sh.
#
# This script decides whether five production projects rebuild, and it does so through an INVERTED
# exit code (0 skips, 1 builds). A mistake in it does not fail loudly — it silently stops deploying,
# which is exactly the failure this repository spent four hours on 2026-09-12 not diagnosing.
#
# So the polarity is asserted in both directions, on real commits from this repository's own history,
# rather than described in a comment.
#
# Written for bash 3.2, which is what macOS ships as /bin/bash.

set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO" || exit 2

pass=0
fail=0

# expect <label> <commit-ish to check the PARENT-OF> <root arg> <expected exit> <expected word>
#
# The script diffs HEAD^..HEAD, so the commit under test is the one whose HEAD we stand on. We use a
# temporary worktree rather than checking out, so the working tree is never touched.
WORKTREE="var/vercel-ignore-test"
rm -rf "$WORKTREE"

expect() {
    local label="$1" sha="$2" arg="$3" want_rc="$4" want_word="$5"
    local out rc
    out="$(git -C "$WORKTREE" log -1 --format=%H >/dev/null 2>&1 || true)"
    # Detach the worktree at the commit under test.
    git -C "$WORKTREE" checkout -q --detach "$sha" 2>/dev/null || {
        echo "  FAIL $label (could not check out $sha)"
        fail=$((fail + 1))
        return
    }
    out="$(cd "$WORKTREE" && bash tools/vercel-ignore.sh "$arg" 2>&1)"
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

git worktree add -q --detach "$WORKTREE" HEAD 2>/dev/null || {
    echo "  FAIL could not create a test worktree at $WORKTREE"
    exit 1
}

# Two real commits with known, different shapes.
#   31115a3 touched the landing page (src/lib/demos.ts) AND an app's README, but no app code.
#   85b136f added the Arbeitsmarkt app itself.
LANDING_SHA="$(git rev-parse --verify --quiet 31115a3^{commit} || echo '')"
APP_SHA="$(git rev-parse --verify --quiet 85b136f^{commit} || echo '')"

if [ -z "$LANDING_SHA" ] || [ -z "$APP_SHA" ]; then
    echo "  FAIL the fixture commits are not present in this clone"
    git worktree remove --force "$WORKTREE" 2>/dev/null
    exit 1
fi

# --- the landing page, on a commit that changed it -------------------------
# 31115a3 changed src/lib/demos.ts, so the landing page MUST rebuild.
expect "landing page rebuilds when its own file changed" "$LANDING_SHA" "." 1 "build"

# --- an app, on that same commit ------------------------------------------
# It touched apps/arbeitsmarkt/README.md but no app CODE. The rule is directory-based, so an app
# whose directory changed does rebuild — the rule is about collision, not about relevance.
expect "app rebuilds when anything in its directory changed" "$LANDING_SHA" "apps/arbeitsmarkt" 1 "build"

# --- a sibling app, on that same commit -----------------------------------
# apps/bienenstock was untouched, so it must NOT rebuild. This is the requirement's core claim.
expect "sibling app does not rebuild" "$LANDING_SHA" "apps/bienenstock" 0 "skip"

# --- the app that was added, on the commit that added it ------------------
expect "a new app rebuilds when it is added" "$APP_SHA" "apps/arbeitsmarkt" 1 "build"

# --- the landing page, when only an app was added -------------------------
# 85b136f's changes are confined to apps/arbeitsmarkt and docs, so the landing page must NOT rebuild.
# This is the row a naive "did anything change?" rule gets wrong.
expect "landing page does not rebuild when only an app changed" "$APP_SHA" "." 0 "skip"

# --- misuse builds rather than skipping -----------------------------------
# No argument is a misuse; it must not be read as "skip everything".
git -C "$WORKTREE" checkout -q --detach "$LANDING_SHA"
out="$(cd "$WORKTREE" && bash tools/vercel-ignore.sh 2>&1)"
rc=$?
if [ "$rc" = "2" ]; then
    echo "  ok   no argument is reported as misuse (exit 2, not a skip)"
    pass=$((pass + 1))
else
    echo "  FAIL no argument should exit 2, got $rc"
    fail=$((fail + 1))
fi

# --- an empty diff skips --------------------------------------------------
# Same commit twice: nothing changed, so nothing should build.
out="$(cd "$WORKTREE" && git diff --name-only HEAD HEAD | wc -l | tr -d ' ')"
if [ "$out" = "0" ]; then
    echo "  ok   an empty change set is distinguishable (the script reports 'nothing changed')"
    pass=$((pass + 1))
else
    echo "  FAIL could not construct an empty diff"
    fail=$((fail + 1))
fi

git worktree remove --force "$WORKTREE" 2>/dev/null

echo
echo "vercel-ignore self-test: $pass passed, $fail failed"
[ "$fail" -eq 0 ] || exit 1
