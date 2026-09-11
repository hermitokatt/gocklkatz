#!/usr/bin/env bash
# Self-test for tools/gate.sh.
#
# Proves the gate detects a broken app rather than merely existing. Every case asserts on the
# gate's own output, not only its exit code: a gate that fails to run and a gate that runs and
# finds nothing both exit the same way, and only one of them is working. The must-fail cases
# additionally assert that the FAILING APP IS NAMED.
#
# Fixtures are written to var/ (gitignored), never to a tracked path.
#
# Written for bash 3.2.
#
# Usage: bash tests/gate.test.sh

set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO" || exit 2

pass=0
fail=0

expect() {
    # expect <label> <expected-exit> <expected-substring> <output>
    local label="$1" want_rc="$2" want_text="$3" out="$4" rc="$5"
    if [ "$rc" != "$want_rc" ]; then
        echo "  FAIL $label (expected exit $want_rc, got $rc)"
        printf '%s\n' "$out" | sed 's/^/       /'
        fail=$((fail + 1))
        return
    fi
    if ! printf '%s' "$out" | grep -qF "$want_text"; then
        echo "  FAIL $label (ran, but did not report '$want_text')"
        printf '%s\n' "$out" | sed 's/^/       /'
        fail=$((fail + 1))
        return
    fi
    echo "  ok   $label"
    pass=$((pass + 1))
}

tmp="var/gate-test"
rm -rf "$tmp"
mkdir -p "$tmp"

echo "gate self-test (bash ${BASH_VERSION%%(*})"

# --- 1. the real configuration passes today -------------------------------
out="$(GATE_SKIP_SELF_TESTS=1 GIT_AUTHOR_NAME='Hermito Katt' GIT_AUTHOR_EMAIL='gocklkatz@gmail.com' bash tools/gate.sh 2>&1)"; rc=$?
expect "real repo.config passes (harness-only)" 0 "GATE: PASS" "$out" "$rc"

# --- 2. an app that is not declared is reported as absent ----------------
cat >"$tmp/unknown-app.config" <<'CFG'
version: 1
apps:
  - name: ghost
    path: apps/does-not-exist
    enabled: true
    verify_cmd: bash scripts/verify.sh
CFG
out="$(GATE_CONFIG="$tmp/unknown-app.config" GATE_SKIP_SELF_TESTS=1 GIT_AUTHOR_NAME='Hermito Katt' GIT_AUTHOR_EMAIL='gocklkatz@gmail.com' bash tools/gate.sh 2>&1)"; rc=$?
expect "missing app path fails" 1 "ghost" "$out" "$rc"

# --- 3. an app whose ci.sh fails is caught -------------------------------
mkdir -p "$tmp/badapp/scripts"
printf '#!/usr/bin/env bash\nexit 1\n' >"$tmp/badapp/scripts/ci.sh"
cat >"$tmp/bad-ci.config" <<CFG
version: 1
apps:
  - name: badapp
    path: $tmp/badapp
    enabled: true
    verify_cmd: bash scripts/verify.sh
CFG
out="$(GATE_CONFIG="$tmp/bad-ci.config" GATE_SKIP_SELF_TESTS=1 GIT_AUTHOR_NAME='Hermito Katt' GIT_AUTHOR_EMAIL='gocklkatz@gmail.com' bash tools/gate.sh 2>&1)"; rc=$?
expect "failing scripts/ci.sh is caught" 1 "badapp" "$out" "$rc"

# --- 4. an app whose verify fails is caught even when ci.sh is green -----
printf '#!/usr/bin/env bash\nexit 0\n' >"$tmp/badapp/scripts/ci.sh"
printf '#!/usr/bin/env bash\nexit 1\n' >"$tmp/badapp/scripts/verify.sh"
out="$(GATE_CONFIG="$tmp/bad-ci.config" GATE_SKIP_SELF_TESTS=1 GIT_AUTHOR_NAME='Hermito Katt' GIT_AUTHOR_EMAIL='gocklkatz@gmail.com' bash tools/gate.sh 2>&1)"; rc=$?
expect "failing verify is caught even with green ci.sh" 1 "does not run correctly" "$out" "$rc"

# --- 5. a green app passes, and a missing verify.sh is caught ------------
printf '#!/usr/bin/env bash\nexit 0\n' >"$tmp/badapp/scripts/verify.sh"
out="$(GATE_CONFIG="$tmp/bad-ci.config" GATE_SKIP_SELF_TESTS=1 GIT_AUTHOR_NAME='Hermito Katt' GIT_AUTHOR_EMAIL='gocklkatz@gmail.com' bash tools/gate.sh 2>&1)"; rc=$?
expect "green ci.sh + green verify passes" 0 "GATE: PASS" "$out" "$rc"

rm -f "$tmp/badapp/scripts/verify.sh"
out="$(GATE_CONFIG="$tmp/bad-ci.config" GATE_SKIP_SELF_TESTS=1 GIT_AUTHOR_NAME='Hermito Katt' GIT_AUTHOR_EMAIL='gocklkatz@gmail.com' bash tools/gate.sh 2>&1)"; rc=$?
expect "verify_cmd without verify.sh fails" 1 "verify.sh is missing" "$out" "$rc"

# --- 6. a disabled app is skipped, not silently ignored ------------------
cat >"$tmp/disabled.config" <<CFG
version: 1
apps:
  - name: later
    path: $tmp/badapp
    enabled: false
CFG
out="$(GATE_CONFIG="$tmp/disabled.config" GATE_SKIP_SELF_TESTS=1 GIT_AUTHOR_NAME='Hermito Katt' GIT_AUTHOR_EMAIL='gocklkatz@gmail.com' bash tools/gate.sh 2>&1)"; rc=$?
expect "disabled app is skipped and named" 0 "disabled in" "$out" "$rc"

# --- 7. a dependency manifest without a lockfile fails -------------------
# The check scans apps/*/, so the fixture must live there. It is removed immediately after.
mkdir -p "apps/_gatetest/scripts"
printf '{"name":"x"}\n' >"apps/_gatetest/package.json"
printf '#!/usr/bin/env bash\nexit 0\n' >"apps/_gatetest/scripts/ci.sh"
cat >"$tmp/lock.config" <<CFG
version: 1
apps: []
CFG
out="$(GATE_CONFIG="$tmp/lock.config" GATE_SKIP_SELF_TESTS=1 GIT_AUTHOR_NAME='Hermito Katt' GIT_AUTHOR_EMAIL='gocklkatz@gmail.com' bash tools/gate.sh 2>&1)"; rc=$?
expect "manifest without lockfile fails" 1 "without package-lock.json" "$out" "$rc"
rm -rf "apps/_gatetest"

rm -rf "$tmp"

echo
echo "gate self-test: $pass passed, $fail failed"
[ "$fail" -eq 0 ] || exit 1
