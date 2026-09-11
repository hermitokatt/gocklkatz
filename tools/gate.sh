#!/usr/bin/env bash
# Local pre-flight gate.
#
# This repository is hosted on Origin, where a committed GitHub Actions workflow does **not**
# execute (docs/DEPLOY.md). Depot CI is the intended enforced gate. This script is the second,
# independent line: it runs on the machine before the code leaves it, and it is the only gate
# that can inspect the served application.
#
# Run it before pushing:
#   bash tools/gate.sh
#
# The result is written to var/gate/report-<tree>.txt, which the pre-push hook checks. A gate
# that has never been seen to fail is not a gate, so prove it:
#   bash tests/gate.test.sh
#
# Environment:
#   GATE_CONFIG   config file to read (default repo.config); the self-test overrides it.
#
# Written for bash 3.2 (macOS /bin/bash). No mapfile, readarray, or associative arrays.

set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO" || exit 2

CONFIG="${GATE_CONFIG:-repo.config}"
REPORT_DIR="var/gate"
TREE="$(git rev-parse HEAD^{tree} 2>/dev/null || echo no-commit)"
REPORT="$REPORT_DIR/report-${TREE}.txt"

mkdir -p "$REPORT_DIR"

fail=0

step()  { printf '\n==> %s\n' "$1"; }
ok()    { printf '    ok    %s\n' "$1"; }
bad()   { printf '    FAIL  %s\n' "$1"; fail=1; }
skip()  { printf '    skip  %s\n' "$1"; }

printf 'gate: local pre-flight\ntree: %s\ncommit: %s\nbranch: %s\ndate: %s\n' \
    "$TREE" \
    "$(git rev-parse HEAD 2>/dev/null || echo none)" \
    "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo none)" \
    "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" | tee "$REPORT"

# ---------------------------------------------------------------------------
step "content guard (personal identifiers, machine-local paths, secrets, identity)"
if tools/guard.sh >/dev/null 2>&1; then
    ok "tools/guard.sh"
else
    bad "tools/guard.sh — run it directly to see the finding"
fi

# Checked here rather than in the tracked scan: a CI checkout has no git identity at all, so the
# guard deliberately omits this from --tracked. The first two real Depot runs both failed over
# this — once because the guard asserted it unconditionally, once because this step treated an
# absent identity as fatal. In a bare checkout it is advisory: name the condition, do not fail
# the gate. A wrong identity is still fatal, because that is a real misconfiguration.
step "commit identity"
# Audit commit metadata, not just the configured identity: a server-side merge is attributed to
# the account that performed the merge, so a commit can carry a foreign identity even when the
# working tree and the local configuration are both clean.
audit_out="$(tools/guard.sh --audit-commits 2>&1)"; audit_rc=$?
if [ "$audit_rc" -eq 0 ]; then
    ok "every commit carries the company identity"
else
    printf '%s\n' "$audit_out" | sed 's/^/       /'
    bad "commit audit failed — a commit carries an identity other than the company one"
fi

ident_out="$(tools/guard.sh --identity 2>&1)"; ident_rc=$?
if printf '%s\n' "$ident_out" | grep -q 'no commit identity configured'; then
    skip "no identity configured (expected in CI; .githooks/pre-push enforces it where it matters)"
elif [ "$ident_rc" -eq 0 ]; then
    ok "identity is the company identity"
else
    bad "commit identity is not the company identity — run tools/guard.sh --identity"
fi

# ---------------------------------------------------------------------------
step "repository hygiene"
if [ -f LICENSE ]; then ok "LICENSE present"; else bad "LICENSE missing"; fi

if [ -n "$(git ls-files | grep -E '\.(env|pem|key)$' || true)" ]; then
    bad "tracked secret-shaped files"
else
    ok "no tracked .env/.pem/.key files"
fi

# A dependency manifest without a lockfile cannot be reproduced by `npm ci`.
missing_lock=""
if [ -f package.json ] && [ ! -f package-lock.json ]; then missing_lock="package.json"; fi
for d in apps/*/; do
    [ -d "$d" ] || continue
    if [ -f "$d/package.json" ] && [ ! -f "$d/package-lock.json" ]; then
        missing_lock="$missing_lock $d"
    fi
done
if [ -n "$missing_lock" ]; then
    bad "package.json without package-lock.json:$missing_lock (npm ci would fail)"
else
    ok "every dependency manifest has a lockfile"
fi

# ---------------------------------------------------------------------------
step "dependency allowlist"
deps_out="$(node tools/check-deps.mjs 2>&1)"; deps_rc=$?
if [ "$deps_rc" -eq 0 ]; then
    ok "tools/check-deps.mjs"
else
    printf '%s\n' "$deps_out" | sed 's/^/       /'
    bad "tools/check-deps.mjs"
fi

# The guard's own must-fail proof runs in the gate too. Running only the check would exercise the
# passing path forever, so a regression that broke the failure path would go unnoticed — and a
# guard that has never been seen to fail is not a guard (AGENTS.md section 6).
#
# GATE_SKIP_SELF_TESTS breaks the recursion: tests/gate.test.sh exercises this script, so without
# it the gate would invoke its own test which invokes the gate again, forever.
if [ "${GATE_SKIP_SELF_TESTS:-0}" = "1" ]; then
    step "self-tests"
    skip "skipped (GATE_SKIP_SELF_TESTS=1; this is a nested gate run)"
else
    step "self-tests"
    for t in tests/guard.test.sh tests/gate.test.sh; do
        if GATE_SKIP_SELF_TESTS=1 bash "$t" >/dev/null 2>&1; then
            ok "$t"
        else
            bad "$t — run it directly to see the failing case"
        fi
    done
    if node tests/dependency-allowlist.test.mjs >/dev/null 2>&1; then
        ok "tests/dependency-allowlist.test.mjs"
    else
        bad "tests/dependency-allowlist.test.mjs — run it directly to see the failing case"
    fi
fi

# ---------------------------------------------------------------------------
step "applications"

# Config parsing without a YAML dependency. The supported subset is deliberately tiny:
#   - name: <value>
#     path: <value>
#     enabled: true|false
#     verify_cmd: <command>
# Inline comments are NOT supported in values; put comments on their own line.
run_app_checks() {
    # $1 = name, $2 = path, $3 = enabled, $4 = verify_cmd
    local name="$1" path="$2" enabled="$3" verify_cmd="$4"
    if [ "$enabled" != "true" ]; then
        skip "$name — disabled in $CONFIG"
        return 0
    fi
    if [ ! -d "$path" ]; then
        bad "$name — path '$path' does not exist"
        return 0
    fi
    if [ ! -f "$path/scripts/ci.sh" ]; then
        bad "$name — no scripts/ci.sh; the app has no quality gate"
    elif ( cd "$path" && bash scripts/ci.sh >/dev/null 2>&1 ); then
        ok "$name — scripts/ci.sh (lint, typecheck, test, build)"
    else
        bad "$name — scripts/ci.sh failed (run it in $path)"
    fi
    if [ -z "$verify_cmd" ]; then
        skip "$name — no verify_cmd; nothing proves it RUNS (AGENTS.md section 7)"
    elif [ ! -f "$path/scripts/verify.sh" ]; then
        bad "$name — verify_cmd set but $path/scripts/verify.sh is missing"
    elif ( cd "$path" && eval "$verify_cmd" >/dev/null 2>&1 ); then
        ok "$name — runs and serves (verify)"
    else
        bad "$name — verify failed: the app does not run correctly when served"
    fi
}

app_count=0
if [ ! -f "$CONFIG" ]; then
    bad "$CONFIG missing"
else
    app_name=""; app_path=""; app_enabled=""; app_verify=""
    while IFS= read -r raw; do
        # Trim leading whitespace only; values are taken verbatim.
        line="$(printf '%s' "$raw" | sed 's/^[[:space:]]*//')"
        case "$line" in
            "- name:"*)
                if [ -n "$app_name" ]; then
                    app_count=$((app_count + 1))
                    run_app_checks "$app_name" "$app_path" "$app_enabled" "$app_verify"
                fi
                app_name="$(printf '%s' "$line" | sed 's/^- name:[[:space:]]*//')"
                app_path=""; app_enabled=""; app_verify=""
                ;;
            "path:"*)       app_path="$(printf '%s' "$line" | sed 's/^path:[[:space:]]*//')" ;;
            "enabled:"*)    app_enabled="$(printf '%s' "$line" | sed 's/^enabled:[[:space:]]*//')" ;;
            "verify_cmd:"*) app_verify="$(printf '%s' "$line" | sed 's/^verify_cmd:[[:space:]]*//')" ;;
        esac
    done <"$CONFIG"
    if [ -n "$app_name" ]; then
        app_count=$((app_count + 1))
        run_app_checks "$app_name" "$app_path" "$app_enabled" "$app_verify"
    fi
    [ "$app_count" -eq 0 ] && skip "no apps declared in $CONFIG (harness-only repository)"
fi

# ---------------------------------------------------------------------------
echo
if [ "$fail" -ne 0 ]; then
    printf 'GATE: FAIL\n' | tee -a "$REPORT"
    exit 1
fi
printf 'GATE: PASS (tree %s, %s app block(s))\n' "$TREE" "$app_count" | tee -a "$REPORT"
