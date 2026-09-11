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
run "typecheck (tsc --noEmit)" npm run --silent typecheck
run "tests (vitest run)" npm run --silent test
run "build (next build)" npm run --silent build

echo
if [ "$fail" -ne 0 ]; then
    printf 'ci: FAIL\n'
    exit 1
fi
printf 'ci: PASS (lint, typecheck, tests, build)\n'
