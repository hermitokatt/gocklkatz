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

# Every line the gate prints is also recorded in the report. The report is the artefact
# .githooks/pre-push trusts, so it has to say what actually ran — a report holding only a verdict
# can be produced by a run that checked nothing, and the reviewer demonstrated exactly that by
# pointing GATE_CONFIG at a config with the one app disabled.
#
# A nested run (GATE_SKIP_SELF_TESTS=1, which tests/gate.test.sh uses) must not write the report
# at all: it runs with a fixture config, and letting it write would leave the real tree's report
# claiming a config that was never used. That happened, and it made the next honest gate run fail.
WRITE_REPORT=1
[ "${GATE_SKIP_SELF_TESTS:-0}" = "1" ] && WRITE_REPORT=0

say() {
    if [ "$WRITE_REPORT" = "1" ]; then
        printf '%s\n' "$*" | tee -a "$REPORT"
    else
        printf '%s\n' "$*"
    fi
}
step()  { say ""; say "==> $1"; }
ok()    { say "    ok    $1"; }
bad()   { say "    FAIL  $1"; fail=1; }
skip()  { say "    skip  $1"; }

if [ "$WRITE_REPORT" = "1" ]; then
    : >"$REPORT"
    {
        printf 'gate: local pre-flight\n'
        printf 'tree: %s\n' "$TREE"
        printf 'commit: %s\n' "$(git rev-parse HEAD 2>/dev/null || echo none)"
        printf 'branch: %s\n' "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo none)"
        printf 'date: %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
        printf 'config: %s\n' "$CONFIG"
        printf 'self-tests: %s\n' "$([ "${GATE_SKIP_SELF_TESTS:-0}" = "1" ] && echo skipped || echo ran)"
    } | tee -a "$REPORT"
fi

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
# This pattern must match the guard's wording exactly. A substring mismatch silently turns the CI
# case into a failure: the audit step above reports ok, and this step reports FAIL, for a checkout
# that simply has no identity configured — which is normal in CI and cannot be otherwise.
if printf '%s\n' "$ident_out" | grep -q 'no commit identity is configured'; then
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

step "dependency licences"
licences_out="$(node tools/audit-licences.mjs 2>&1)"; licences_rc=$?
if [ "$licences_rc" -eq 0 ]; then
    ok "tools/audit-licences.mjs"
else
    printf '%s\n' "$licences_out" | sed 's/^/       /'
    bad "tools/audit-licences.mjs"
fi

# The published audits are kept current here rather than left to whoever remembers to re-run them.
# Both `--check` modes are git and filesystem only — they fetch nothing and read no node_modules —
# so they are safe to run before the applications have installed. A new link, or a new published
# number, in any tracked document fails the gate until the audit is regenerated. That is the point:
# an audit only run when someone chooses to run it goes stale without anyone noticing.
step "published audits are current"
for audit in tools/audit-published-links.mjs tools/audit-published-claims.mjs; do
    audit_out="$(node "$audit" --check 2>&1)"; audit_rc=$?
    if [ "$audit_rc" -eq 0 ]; then
        ok "$audit --check"
    else
        printf '%s\n' "$audit_out" | sed 's/^/       /'
        bad "$audit --check — regenerate with --write and commit the result"
    fi
done

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
    # A self-test's own report names the failing case, and it is the only artefact that does. It used
    # to be sent to /dev/null, so a failure here said only "run it directly" — which is useless in CI,
    # where the reader has no way to run anything. That cost a diagnosis: GOC-48 had to be filed from
    # a CI run whose failing child had printed its reason into a discard.
    #
    # Success stays quiet; failure is shown, tail-truncated so one noisy suite cannot bury the rest.
    selftest_log="$(mktemp "${TMPDIR:-/tmp}/gate-selftest.XXXXXX")"
    run_selftest() {
        # $1 = label, rest = command
        local label="$1"
        shift
        if "$@" >"$selftest_log" 2>&1; then
            ok "$label"
        else
            bad "$label — output follows"
            # Enough to reach the report when a case failed early: a case prints a failing gate's
            # whole run before its own FAIL line, so a short tail shows the wrong part. The closing
            # counter is the single most useful line in any of these reports.
            tail -60 "$selftest_log" | sed 's/^/          /'
        fi
    }
    # tests/vercel-ignore.test.sh is here because tools/vercel-ignore.sh decides whether five
    # production projects rebuild, through an inverted exit code. A mistake in it does not fail
    # loudly — it silently stops deploying. A rule with that much authority over production should
    # not be guarded only by whoever remembers to run its test by hand.
    for t in tests/guard.test.sh tests/gate.test.sh tests/vercel-ignore.test.sh; do
        run_selftest "$t" env GATE_SKIP_SELF_TESTS=1 bash "$t"
    done
    run_selftest "tests/dependency-allowlist.test.mjs" node tests/dependency-allowlist.test.mjs
    run_selftest "tests/licence-audit.test.mjs" node tests/licence-audit.test.mjs
    run_selftest "tests/published-audits.test.mjs" node tests/published-audits.test.mjs
    rm -f "$selftest_log"
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
    # The app's own output is kept and shown on failure. Discarding it is how a CI-only failure
    # becomes undiagnosable: the gate reports that something did not work, and the evidence that
    # would say why has already been thrown away.
    local app_log
    app_log="$(mktemp)"

    if [ ! -f "$path/scripts/ci.sh" ]; then
        bad "$name — no scripts/ci.sh; the app has no quality gate"
    elif ( cd "$path" && bash scripts/ci.sh ) >"$app_log" 2>&1; then
        ok "$name — scripts/ci.sh (lint, typecheck, test, build)"
    else
        bad "$name — scripts/ci.sh failed (run it in $path)"
        sed 's/^/          /' "$app_log" | tail -30
    fi

    if [ -z "$verify_cmd" ]; then
        skip "$name — no verify_cmd; nothing proves it RUNS (AGENTS.md section 7)"
    elif [ ! -f "$path/scripts/verify.sh" ]; then
        bad "$name — verify_cmd set but $path/scripts/verify.sh is missing"
    elif ( cd "$path" && eval "$verify_cmd" ) >"$app_log" 2>&1; then
        ok "$name — runs and serves (verify)"
    else
        bad "$name — verify failed: the app does not run correctly when served"
        sed 's/^/          /' "$app_log" | tail -80
    fi

    rm -f "$app_log"
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
say ""
if [ "$fail" -ne 0 ]; then
    say "GATE: FAIL"
    exit 1
fi
say "GATE: PASS (tree $TREE, $app_count app block(s))"
