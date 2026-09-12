#!/usr/bin/env bash
# Decides whether a Vercel project should build, from what changed in this push.
#
# This is the command to put in each project's **Ignored Build Step** field, with that project's
# directory as the argument:
#
#   landing page       bash tools/vercel-ignore.sh .
#   Ameisenwerkstatt   bash tools/vercel-ignore.sh apps/ameisenwerkstatt
#   Simplified         bash tools/vercel-ignore.sh apps/simplified
#   Bienenstock        bash tools/vercel-ignore.sh apps/bienenstock
#   Arbeitsmarkt       bash tools/vercel-ignore.sh apps/arbeitsmarkt
#
# READ THIS BEFORE CHANGING THE EXIT CODES — they are inverted, and that inversion is the whole
# reason this file exists as a script rather than a one-liner in a web form.
#
# Vercel's documented behaviour: **exit 0 SKIPS the build; exit 1 or greater BUILDS it.** That is the
# opposite of how a reader parses "ignore this step", and a rule written the intuitive way round
# silently skips precisely the deployments it was meant to make. Worse, the polarity is reported to
# differ between production and previews, so a rule can look correct on pull requests and stop
# production dead — which is the failure this repository spent four hours on 2026-09-12 not
# diagnosing. Every path below returns through `build` or `skip`, never with a bare exit.
#
# Why each app is an island: no application imports, reads or builds from anything outside its own
# directory. Each has its own package.json, lockfile, tests and gates. So a change confined to
# `apps/<name>` cannot affect any sibling, and a change outside `apps/` cannot affect any app.
#
# The landing page is the repository root, so its set is "anything except the apps, except docs".
# That has to be an explicit subtraction: `git diff -- .` for a root directory matches every path,
# so a rule that only tested "did anything change?" would rebuild the landing page for every
# sub-issue of every epic while the apps rebuilt for none.
#
# Usage: bash tools/vercel-ignore.sh <project-root-path>
# Exit:  0 skip this build, 1 build, 2 misuse (and 2 builds, deliberately — see below).

set -uo pipefail

ROOT="${1:-}"
BASE_ARG="${2:-}"
HEAD_ARG="${3:-}"
if [ -z "$ROOT" ]; then
    echo "vercel-ignore: usage: vercel-ignore.sh <project-root-path> [base-sha] [head-sha]" >&2
    exit 2
fi

# Never skip on an uncertain state. An unnecessary build costs a build minute; a wrongly skipped
# build costs a deployment nobody notices is stale. Every error path below exits 1, which BUILDS.
build() { echo "vercel-ignore: build — $1"; exit 1; }
skip()  { echo "vercel-ignore: skip — $1";  exit 0; }

# Vercel clones shallowly. Without a parent we cannot attribute the change, so we build.
if ! git rev-parse --git-dir >/dev/null 2>&1; then
    build "not a git checkout"
fi

# The base and head are overridable so this rule can be exercised against any pair of commits, which
# is how tests/vercel-ignore.test.sh proves both directions of the polarity without a checkout. Vercel
# calls it with the root path only.
HEAD_REF="${HEAD_ARG:-HEAD}"
BASE=""
if [ -n "$BASE_ARG" ]; then
    git rev-parse --verify --quiet "${BASE_ARG}^{commit}" >/dev/null 2>&1 || build "base '$BASE_ARG' is not a commit here"
    BASE="$BASE_ARG"
elif git rev-parse --verify --quiet 'HEAD^' >/dev/null 2>&1; then
    BASE="HEAD^"
elif [ -n "${VERCEL_GIT_PREVIOUS_SHA:-}" ] && git rev-parse --verify --quiet "${VERCEL_GIT_PREVIOUS_SHA}" >/dev/null 2>&1; then
    BASE="${VERCEL_GIT_PREVIOUS_SHA}"
fi

if [ -z "$BASE" ]; then
    build "no parent commit available (shallow clone), cannot attribute the change"
fi

if ! CHANGED="$(git diff --name-only "$BASE" "$HEAD_REF" 2>/dev/null)"; then
    build "git diff $BASE..$HEAD_REF failed"
fi

if [ -z "$CHANGED" ]; then
    skip "nothing changed between $BASE and $HEAD_REF"
fi

matches=""
if [ "$ROOT" = "." ]; then
    # The landing page: everything except the applications, and except prose.
    matches="$(printf '%s\n' "$CHANGED" | grep -v '^apps/' | grep -v '^docs/' | grep -v '^README\.md$' || true)"
else
    root="${ROOT%/}"
    matches="$(printf '%s\n' "$CHANGED" | grep "^${root}/" || true)"
fi

if [ -z "$matches" ]; then
    skip "no change under '$ROOT'"
fi

echo "vercel-ignore: build — $ROOT changed:"
printf '%s\n' "$matches" | sed 's/^/    /'
exit 1
