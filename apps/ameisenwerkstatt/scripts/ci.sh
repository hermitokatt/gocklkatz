#!/usr/bin/env bash
# Quality gate for Ameisenwerkstatt: lint, typecheck, tests, build.
#
# This proves the application builds and its unit tests pass. It does NOT prove it runs — a build
# passes over a route that answers 500, or a page that throws while rendering. That is what
# scripts/verify.sh is for.
#
# The script resolves its own directory, so tools/gate.sh can invoke it from the repository root.
#
# Usage: bash scripts/ci.sh

set -uo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR" || exit 2

fail=0

step() { printf '\n==> %s\n' "$*"; }

run() {
    local label="$1"
    shift
    step "$label"
    if "$@"; then
        printf '    ok    %s\n' "$label"
    else
        printf '    FAIL  %s\n' "$label"
        fail=1
    fi
}

# Each app owns its dependencies, and CI checks the tree out with no install step, so the gate has
# to be able to stand itself up. The predecessor script assumed node_modules was present, which is
# why it failed the first time the repository gate ran it: the source checkout had one, a fresh
# clone does not.
if [ ! -f node_modules/.package-lock.json ]; then
    step "install dependencies (npm ci)"
    if npm ci; then
        printf '    ok    install dependencies\n'
    else
        printf '    FAIL  install dependencies — nothing below could run\n'
        printf '\nci: FAIL\n'
        exit 1
    fi
fi

run "lint (eslint)" npm run --silent lint
# Checked, not merely configured. This app shipped a `.prettierrc.json` that nothing invoked, so 26
# files were unformatted while this script reported PASS. `AGENTS.md` in this app already described
# these gates as "format, lint, typecheck, tests, build" — now that is true.
run "format (prettier --check)" npm run --silent format:check
run "typecheck (tsc --noEmit)" npm run --silent typecheck
run "tests (vitest run)" npm run --silent test
run "build (next build)" npm run --silent build

# Tell scripts/verify.sh that a build for this tree already exists, so a gate run does not
# build every application twice. The content is the tree hash, so verify only skips when the
# tree it would build is the tree that was built. An absent or unreadable hash writes nothing,
# and verify then builds as before — the marker can only ever save work, never cause it to be
# skipped wrongly.
built_tree="$(git rev-parse HEAD^{tree} 2>/dev/null || true)"
if [ "$fail" -eq 0 ] && [ -n "$built_tree" ]; then
    printf '%s\n' "$built_tree" >".gate-build-complete"
fi

echo
if [ "$fail" -ne 0 ]; then
    printf 'ci: FAIL\n'
    exit 1
fi
printf 'ci: PASS (format, lint, typecheck, tests, build)\n'
