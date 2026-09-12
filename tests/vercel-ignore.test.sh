#!/usr/bin/env bash
# Self-test for tools/vercel-ignore.sh.
#
# That script decides whether five production projects rebuild, through an INVERTED exit code:
# **0 skips the build, 1 or greater builds it.** A mistake in it does not fail loudly — it silently
# stops deploying, which is the failure this repository spent four hours on 2026-09-12 not
# diagnosing. So the polarity is asserted in both directions here rather than described in a comment.
#
# It builds its OWN git repositories and commits, in a temporary directory. An earlier version used
# real commits from this repository's history and passed locally while failing in CI, because
# `actions/checkout` clones shallowly and those commits were not there. A test that depends on the
# surrounding clone's depth is a test that works on one machine.
#
# Written for bash 3.2, which is what macOS ships as /bin/bash.

set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO" || exit 2

TOOL="$REPO/tools/vercel-ignore.sh"
[ -f "$TOOL" ] || { echo "vercel-ignore self-test: $TOOL is missing" >&2; exit 2; }

pass=0
fail=0

echo "vercel-ignore self-test (bash ${BASH_VERSION%%(*})"

# A scratch repository, so no fixture depends on this clone's history or on the network.
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/vercel-ignore-test.XXXXXX")" || exit 2
trap 'rm -rf "$SCRATCH"' EXIT INT TERM

mkdir -p "$SCRATCH/apps/alpha" "$SCRATCH/apps/beta" "$SCRATCH/src" "$SCRATCH/docs"
cd "$SCRATCH" || exit 2
git init -q .
git config user.email "test@example.invalid"
git config user.name "vercel-ignore test"

touch apps/alpha/keep apps/beta/keep src/keep docs/keep
git add -A >/dev/null 2>&1
git commit -q -m "base" >/dev/null 2>&1

# commit_touching <path> — one commit that changes only that path.
commit_touching() {
    mkdir -p "$(dirname "$1")"
    printf 'change %s\n' "$2" >>"$1"
    git add -A >/dev/null 2>&1
    git commit -q -m "touch $1" >/dev/null 2>&1
}

# expect <label> <root arg> <commit> <expected exit> <expected word>
# The tool is run with the scratch repository as the working directory, which is how Vercel runs it.
expect() {
    local label="$1" arg="$2" sha="$3" want_rc="$4" want_word="$5"
    local out rc
    out="$(bash "$TOOL" "$arg" "${sha}^" "$sha" 2>&1)"
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

ROOTS=". apps/alpha apps/beta"

echo
echo "  --- a docs-only commit skips every project ---"
# This is the shape that stalled production: prose changed, so no build should be skipped wrongly
# and none should be triggered either.
commit_touching docs/notes.md docs-only
DOCS_SHA="$(git rev-parse HEAD)"
for root in $ROOTS; do
    expect "$root skips on a docs-only commit" "$root" "$DOCS_SHA" 0 "skip"
done

echo
echo "  --- a landing-page file rebuilds the landing page only ---"
commit_touching src/lib-demos.ts landing-page
LANDING_SHA="$(git rev-parse HEAD)"
expect "landing page builds on its own file" "." "$LANDING_SHA" 1 "build"
expect "alpha skips when only the landing page changed" "apps/alpha" "$LANDING_SHA" 0 "skip"
expect "beta skips when only the landing page changed" "apps/beta" "$LANDING_SHA" 0 "skip"

echo
echo "  --- an app change rebuilds that app, not its sibling ---"
commit_touching apps/alpha/page.tsx alpha-change
ALPHA_SHA="$(git rev-parse HEAD)"
expect "alpha builds on its own change" "apps/alpha" "$ALPHA_SHA" 1 "build"
expect "beta skips when alpha changed" "apps/beta" "$ALPHA_SHA" 0 "skip"
expect "the landing page skips when only an app changed" "." "$ALPHA_SHA" 0 "skip"

echo
echo "  --- a root config change rebuilds the landing page ---"
# Deliberately conservative for a root-directory project: anything at the root that is not an app,
# not docs and not root prose counts as an input. A missed rebuild is worse than an extra one.
commit_touching package.json root-config
CONFIG_SHA="$(git rev-parse HEAD)"
expect "landing page builds on a root config change" "." "$CONFIG_SHA" 1 "build"
expect "alpha skips on a root config change" "apps/alpha" "$CONFIG_SHA" 0 "skip"

echo
echo "  --- misuse must BUILD, never skip ---"
# An unreadable state has to fall on the build side: an unnecessary build costs a minute, a wrongly
# skipped build costs a deployment nobody notices is stale.
out="$(bash "$TOOL" 2>&1)"; rc=$?
if [ "$rc" = "2" ]; then
    echo "  ok   no argument is misuse (exit 2, not a silent skip)"
    pass=$((pass + 1))
else
    echo "  FAIL no argument should exit 2, got $rc"
    fail=$((fail + 1))
fi

out="$(bash "$TOOL" . not-a-real-sha not-a-real-sha 2>&1)"; rc=$?
if [ "$rc" = "1" ] && printf '%s' "$out" | grep -q "build"; then
    echo "  ok   an unresolvable base is reported as build, not skip"
    pass=$((pass + 1))
else
    echo "  FAIL an unresolvable base must build; got exit $rc"
    fail=$((fail + 1))
fi

out="$(bash "$TOOL" . "$DOCS_SHA" "$DOCS_SHA" 2>&1)"; rc=$?
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
