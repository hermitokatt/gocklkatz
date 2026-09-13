#!/usr/bin/env bash
# Self-test for tools/guard.sh.
#
# Proves the guard is real: it must PASS on the clean tree and FAIL on a deliberate leak.
# "A guard that has never been seen to fail is not a guard" (AGENTS.md section 6).
#
# Every case asserts that stderr is clean on success, so a guard that fails to run cannot pass by
# reporting nothing. A guard must be shown to have actually RUN, not merely to have exited zero.
# This matters here because macOS ships bash 3.2: a bash-4-only builtin would silently no-op.
#
# The leak fixtures are written to var/ (gitignored) and removed afterwards, so nothing that
# trips the guard is ever committed — which is the point.
#
# Written for bash 3.2 (no mapfile/readarray/associative arrays).
#
# Usage: bash tests/guard.test.sh

set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO" || exit 2

pass=0
fail=0
skipped=0

# run <expected_exit> <label> [args...]
run() {
    local expected="$1" label="$2" out rc
    shift 2
    out="$(tools/guard.sh "$@" 2>&1)"
    rc=$?
    if [ "$rc" != "$expected" ]; then
        echo "  FAIL $label (expected exit $expected, got $rc)"
        printf '%s\n' "$out" | sed 's/^/       /'
        fail=$((fail + 1))
        return
    fi
    echo "  ok   $label (exit $rc)"
    pass=$((pass + 1))
}

# run_expecting_message <label> <pattern> [args...] — must fail AND say why
run_expecting_message() {
    local label="$1" pattern="$2" out rc
    shift 2
    out="$(tools/guard.sh "$@" 2>&1)"
    rc=$?
    if [ "$rc" != "1" ]; then
        echo "  FAIL $label (expected exit 1, got $rc)"
        printf '%s\n' "$out" | sed 's/^/       /'
        fail=$((fail + 1))
        return
    fi
    if ! printf '%s' "$out" | grep -qE "$pattern"; then
        echo "  FAIL $label (failed, but not for the expected reason)"
        printf '%s\n' "$out" | sed 's/^/       /'
        fail=$((fail + 1))
        return
    fi
    echo "  ok   $label (exit 1, reported by name)"
    pass=$((pass + 1))
}

tmpdir="var/guard-test"
mkdir -p "$tmpdir"

echo "guard self-test (bash ${BASH_VERSION%%(*})"

# --- 1. the guard actually runs and passes on a clean tree -----------------
tools/guard.sh >/dev/null 2>"$tmpdir/err"
rc=$?
if [ "$rc" -eq 0 ] && [ ! -s "$tmpdir/err" ]; then
    echo "  ok   clean tracked tree passes with no stderr noise"
    pass=$((pass + 1))
else
    echo "  FAIL clean tracked tree (exit $rc; stderr below)"
    sed 's/^/       /' "$tmpdir/err"
    fail=$((fail + 1))
fi

# --- 2. the forbidden personal address is caught --------------------------
# The fixture is generated at run time. Writing the literal here would put the very string
# being forbidden into a tracked file, which is what the identity-digest check prevents.
leak="$tmpdir/leak.txt"
python3 -c "import sys; sys.stdout.write('contact: ' + 's.' + 'katzen' + 'steiner' + '@' + 'gmail.com' + chr(10))" >"$leak"
run_expecting_message "forbidden personal address is caught" 'forbidden identity' --paths "$leak"

# --- 3. the forbidden personal name is caught -----------------------------
# Same reason, and note the parts are also never adjacent in this source line.
nameleak="$tmpdir/nameleak.txt"
python3 -c "import sys; sys.stdout.write('Written by ' + 'Ste' + 'fan ' + 'Katzen' + 'steiner' + chr(10))" >"$nameleak"
run_expecting_message "forbidden personal name is caught" 'forbidden identity' --paths "$nameleak"

# --- 3a. a machine-local absolute path is caught --------------------------
pathleak="$tmpdir/pathleak.txt"
printf 'see %s/%s/Repos for details\n' "/Users" "katzi" >"$pathleak"
run_expecting_message "machine-local absolute path is caught" 'forbidden content' --paths "$pathleak"

# --- 4. a secret-shaped value is caught -----------------------------------
secretleak="$tmpdir/secretleak.txt"
printf 'DEEPSEEK_API_KEY=%s\n' "sk-0000000000000000000000000000" >"$secretleak"
run_expecting_message "secret-shaped value is caught" 'secret-shaped' --paths "$secretleak"

# --- 5. the wrong commit identity is caught -------------------------------
# Identity is supplied by environment rather than by writing to git config, so this test never
# mutates repository state and behaves identically in a bare CI checkout (which has no identity).
GIT_AUTHOR_NAME="someone" GIT_AUTHOR_EMAIL="someone.else@example.com" \
    run_expecting_message "wrong commit identity is caught" 'not the company identity' --identity

# --- 6. an unset identity is advisory for --identity, fatal for --require-identity ---------
# Regression test. The first Depot CI run failed because the identity assertion applied in a bare
# checkout, where no identity exists and none can. The gate must be passable there; a hook must
# not be. The second CI run failed for the same reason from the other direction, because the gate
# itself asserted it.
out="$(env GIT_AUTHOR_NAME= GIT_AUTHOR_EMAIL= tools/guard.sh --identity 2>&1)"; rc=$?
if [ "$rc" = "0" ] && printf '%s' "$out" | grep -q 'no commit identity configured'; then
    echo "  ok   unset identity is advisory for --identity"
    pass=$((pass + 1))
else
    echo "  FAIL unset identity should pass --identity (exit $rc)"
    printf '%s\n' "$out" | sed 's/^/       /'
    fail=$((fail + 1))
fi

out="$(env GIT_AUTHOR_NAME= GIT_AUTHOR_EMAIL= bash tools/guard.sh --require-identity 2>&1)"; rc=$?
if [ "$rc" = "1" ] && printf '%s' "$out" | grep -q 'no commit identity is configured'; then
    echo "  ok   unset identity fails --require-identity"
    pass=$((pass + 1))
else
    echo "  FAIL unset identity should fail --require-identity (exit $rc)"
    printf '%s\n' "$out" | sed 's/^/       /'
    fail=$((fail + 1))
fi

# --- 7. a bare CI checkout with NO identity passes the tracked scan -------
# Uses an isolated throwaway repository rather than unsetting this repository's identity.
# A test must never be able to corrupt the thing it is testing: unsetting the live identity and
# restoring it is not safe, because a second run has nothing left to restore.
before_name="$(git config --local user.name 2>/dev/null || true)"
before_email="$(git config --local user.email 2>/dev/null || true)"

bare="$tmpdir/bare-checkout"
mkdir -p "$bare/tools"
git -C "$bare" init -q 2>/dev/null || git init -q "$bare"
cp tools/guard.sh "$bare/tools/guard.sh"
cp tools/pii-patterns.txt "$bare/tools/pii-patterns.txt"
chmod +x "$bare/tools/guard.sh"
echo "# placeholder" >"$bare/README.md"
# GIT_AUTHOR_* explicitly empty means "no identity", which is what a fresh CI checkout has.
bare_out="$(env GIT_AUTHOR_NAME= GIT_AUTHOR_EMAIL= HOME="$tmpdir/nohome" bash "$bare/tools/guard.sh" 2>&1)"
bare_rc=$?
if [ "$bare_rc" = "0" ]; then
    echo "  ok   bare checkout with no identity passes the tracked scan"
    pass=$((pass + 1))
else
    echo "  FAIL bare checkout should pass the tracked scan (exit $bare_rc)"
    printf '%s\n' "$bare_out" | sed 's/^/       /'
    fail=$((fail + 1))
fi

# The live repository's identity must be UNCHANGED by this test. Asserting that it *exists* would
# be wrong: a CI checkout legitimately has no identity, so the property under test is
# "unmodified", not "present".
after_name="$(git config --local user.name 2>/dev/null || true)"
after_email="$(git config --local user.email 2>/dev/null || true)"
if [ "$before_name" = "$after_name" ] && [ "$before_email" = "$after_email" ]; then
    echo "  ok   live repository identity unmodified by the bare-checkout case"
    pass=$((pass + 1))
else
    echo "  FAIL live repository identity changed:"
    echo "       before: ${before_name:-<unset>} <${before_email:-<unset>}>"
    echo "       after:  ${after_name:-<unset>} <${after_email:-<unset>}>"
    fail=$((fail + 1))
fi

# --- 8. the tracked scan examines a non-empty file list -------------------
# A guard that scans zero files also exits 0. Prove it is reading the tree.
scanned="$(git ls-files | grep -Ev '^(tools/pii-patterns\.txt|tests/guard\.test\.sh)$' | wc -l | tr -d ' ')"
if [ "$scanned" -gt 0 ]; then
    echo "  ok   tracked scan has $scanned candidate file(s) to check"
    pass=$((pass + 1))
else
    echo "  FAIL tracked scan would examine zero files"
    fail=$((fail + 1))
fi

# --- 9. staged mode actually catches a staged leak ------------------------
# Guards the staged path specifically: a leak in the index must fail the commit. Assert on the
# outcome, not on the exit code alone — a scan that never runs also exits 0.
if [ -z "$(git diff --cached --name-only)" ]; then
    staged_leak="$tmpdir/staged-leak.md"
    python3 -c "import sys; sys.stdout.write('contact ' + 's.' + 'katzen' + 'steiner' + '@' + 'gmail.com' + chr(10))" >"$staged_leak"
    git add -f "$staged_leak"
    out="$(tools/guard.sh --staged 2>&1)"
    rc=$?
    if [ "$rc" = "1" ] && printf '%s' "$out" | grep -q 'forbidden identity'; then
        echo "  ok   staged mode catches a staged leak"
        pass=$((pass + 1))
    else
        echo "  FAIL staged mode did not catch a staged leak (exit $rc)"
        printf '%s\n' "$out" | sed 's/^/       /'
        fail=$((fail + 1))
    fi
    git rm --cached -q --force "$staged_leak" 2>/dev/null || true
    rm -f "$staged_leak"
else
    # Not silent: a skipped guard is how a check quietly stops checking.
    echo "  SKIP staged-mode test (index is not empty; run this test before staging, or commit)"
    skipped=$((skipped + 1))
fi

# --- 10. the commit MESSAGE is a third place an identity can hide ---------
#
# The author and committer fields are checked above; the message was not checked at all, and a
# `Co-authored-by:` trailer with a personal address reached published history through exactly that
# gap. The scanner is exercised through GUARD_COMMIT_MESSAGES_FILE so this test does not have to
# create a real commit carrying a real identity — and the identity is assembled at runtime for the
# same reason the staged-leak case does it: no tracked file may contain it.
msg_clean="$tmpdir/messages-clean"
python3 -c "import sys; sys.stdout.write('Add a thing' + chr(10) + chr(10) + 'Co-authored-by: A Colleague <colleague@example.invalid>' + chr(10))" >"$msg_clean"
out="$(GUARD_COMMIT_MESSAGES_FILE="$msg_clean" tools/guard.sh --audit-commits 2>&1)"; rc=$?
if [ "$rc" = "0" ] && printf '%s' "$out" | grep -q 'commit messages ok'; then
    echo "  ok   a clean commit message passes the message scan"
    pass=$((pass + 1))
else
    echo "  FAIL a clean commit message did not pass (exit $rc)"
    printf '%s\n' "$out" | sed 's/^/       /'
    fail=$((fail + 1))
fi

msg_leak="$tmpdir/messages-leak"
python3 -c "import sys; sys.stdout.write('Add a thing' + chr(10) + chr(10) + 'Co-authored-by: s.' + 'katzen' + 'steiner' + ' <s.' + 'katzen' + 'steiner' + '@' + 'gmail.com>' + chr(10))" >"$msg_leak"
out="$(GUARD_COMMIT_MESSAGES_FILE="$msg_leak" tools/guard.sh --audit-commits 2>&1)"; rc=$?
if [ "$rc" = "1" ] && printf '%s' "$out" | grep -q 'MESSAGE carries a forbidden identity'; then
    echo "  ok   a message trailer is caught, and the finding echoes the commit not the identity"
    pass=$((pass + 1))
else
    echo "  FAIL a message trailer was not caught (exit $rc)"
    printf '%s\n' "$out" | sed 's/^/       /'
    fail=$((fail + 1))
fi

# A scanner that never ran must not be reportable as clean: a missing digest list is a failure, not
# a skip. The identity scan had exactly that failure mode once before, and it was a silent no-op.
out="$(GUARD_COMMIT_MESSAGES_FILE="$msg_clean" DIGESTS_FILE=/nonexistent/digests tools/guard.sh --audit-commits 2>&1)"; rc=$?
if [ "$rc" = "1" ] && printf '%s' "$out" | grep -q 'refusing to'; then
    echo "  ok   a missing digest list fails rather than reporting the messages clean"
    pass=$((pass + 1))
else
    echo "  FAIL a missing digest list did not fail (exit $rc)"
    printf '%s\n' "$out" | sed 's/^/       /'
    fail=$((fail + 1))
fi

# --- 11. identity restored, tree passes again ------------------------------
run 0 "identity restored, tree passes again"

rm -rf "$tmpdir"

echo
echo "guard self-test: $pass passed, $fail failed, $skipped skipped"
[ "$fail" -eq 0 ] || exit 1
[ "$skipped" -eq 0 ] || echo "  note: $skipped case(s) did not run"
