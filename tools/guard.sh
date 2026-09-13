#!/usr/bin/env bash
# Content guard for a public repository.
#
# Two jobs:
#   1. Forbidden-content scan — personal identifiers, machine-local paths, secret-shaped values.
#   2. Commit identity assertion — author and committer must both be the company identity.
#
# Modes (at most one; default is --tracked):
#   tools/guard.sh              scan all tracked files
#   tools/guard.sh --staged     scan the staged index, and check the commit identity
#   tools/guard.sh --paths F..  scan named files
#   tools/guard.sh --identity            report the configured identity; absent is not a failure
#   tools/guard.sh --require-identity    check identity; an unset identity is a failure
#   tools/guard.sh --audit-commits       check the AUTHOR and COMMITTER of every commit, and its MESSAGE
#
# The commit-identity check is deliberately NOT part of --tracked. A bare CI checkout has no git
# identity at all, so asserting one there fails every run for a condition that cannot hold. The
# identity only matters where a commit is being created: the pre-commit hook (--staged), the
# pre-push hook, and tools/gate.sh — and only the hooks use --require-identity, because the gate
# must be passable in a CI checkout while the hooks must never allow a commit without it.
#
# Exit: 0 clean, 1 a finding, 2 the guard itself is misconfigured.
#
# Written for bash 3.2, which is what macOS ships as /bin/bash. Do not use mapfile, readarray,
# associative arrays, or ${var,,}: they are silently unavailable and make the guard pass by
# doing nothing.
#
# Why this exists: the development machine carries a personal git identity and a personal
# account elsewhere. This repository is public and is authored by Gocklkatz Inc, so no identity
# other than the company one may appear in the tree, a commit, or a tracked log.
#
# A guard that has never been seen to fail is not a guard (AGENTS.md section 6). Prove it:
#   bash tests/guard.test.sh

set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO" || exit 2

PATTERNS_FILE="tools/pii-patterns.txt"
ALLOWLIST_FILE="tools/commit-identity-allowlist.txt"
SECRET_ALLOWLIST_FILE="tools/secret-allowlist.txt"
DIGESTS_FILE="${DIGESTS_FILE:-tools/identity-digests.txt}"
IDENTITY_NAME="Hermito Katt"
IDENTITY_EMAIL="gocklkatz@gmail.com"

# The digest file lists SHA-256 digests of forbidden identities rather than the identities
# themselves, so no tracked file has to contain the text it forbids. No file needs exempting
# from the digest check for that reason — only from the path-pattern check.
EXEMPT_RE='^(tools/pii-patterns\.txt)$'

MODE="tracked"
CHECK_IDENTITY=0
REQUIRE_IDENTITY=0
TARGETS=""
case "${1:-}" in
    --staged)           MODE="staged";   CHECK_IDENTITY=1; REQUIRE_IDENTITY=1 ;;
    --identity)         MODE="identity"; CHECK_IDENTITY=1 ;;  # absent is a note, wrong is fatal
    --require-identity) MODE="identity"; CHECK_IDENTITY=1; REQUIRE_IDENTITY=1 ;;
    --audit-commits)    MODE="audit" ;;
    --paths)            MODE="paths"; shift; TARGETS="$*" ;;
    "")                 ;;
    *)                  echo "guard: unknown argument '$1'" >&2; exit 2 ;;
esac
if [ "$MODE" = "paths" ] && [ -z "$TARGETS" ]; then
    echo "guard: --paths requires at least one path" >&2
    exit 2
fi

# Pipe-delimited so a whole `Name <email>` can be matched exactly rather than by substring.
ALLOWED_IDENTITIES="|"
if [ -f "$ALLOWLIST_FILE" ]; then
    while IFS= read -r entry; do
        case "$entry" in
            ""|"#"*) continue ;;
        esac
        ALLOWED_IDENTITIES="$ALLOWED_IDENTITIES$entry|"
    done <"$ALLOWLIST_FILE"
fi

fail=0

# ---------------------------------------------------------------------------
# 1. Forbidden content
# ---------------------------------------------------------------------------
if [ ! -f "$PATTERNS_FILE" ]; then
    echo "guard: missing $PATTERNS_FILE" >&2
    exit 2
fi

PATTERN="$(grep -vE '^[[:space:]]*(#|$)' "$PATTERNS_FILE" | paste -sd'|' -)"
if [ -z "$PATTERN" ]; then
    echo "guard: $PATTERNS_FILE contains no patterns" >&2
    exit 2
fi

# Matches forbidden identities by digest: lowercases every word token plus every adjacent token
# pair, hashes each, and compares against tools/identity-digests.txt. Storing digests means the
# plaintext identity is nowhere in the repository, while detection still works.
report_identity_hits() {
    local label="$1" files_list="$2" hits rc=""
    [ -s "$files_list" ] || return 0
    # A missing digest list used to return silently, which turned the identity check into a no-op
    # that still reported the tree clean. If the list is absent, that is a failure.
    if [ ! -f "$DIGESTS_FILE" ]; then
        echo "guard: $DIGESTS_FILE is missing — the identity scan cannot run, refusing to" >&2
        echo "       report the tree clean." >&2
        fail=1
        return 0
    fi
    # One process for the whole list, like content_scan.py, so there is no batch boundary whose
    # exit code could be misread.
    hits="$(python3 "$REPO/tools/identity_scan.py" "$DIGESTS_FILE" <"$files_list" 2>/dev/null)"
    rc=$?
    if [ "$rc" -ne 0 ]; then
        echo "guard: the identity scanner could not run (exit $rc) — refusing to" >&2
        echo "       report the tree clean when nothing was scanned." >&2
        fail=1
        return 0
    fi
    if [ -n "$hits" ]; then
        echo "guard: forbidden identity ($label):" >&2
        printf '%s\n' "$hits" | sed 's/^/    /' >&2
        fail=1
    fi
}

report_content_hits() {
    # $1 = label, $2 = path to a file listing files, $3 = path holding the text to scan
    local label="$1" files_list="$2" content="$3" hits rc
    [ -s "$files_list" ] || return 0
    # Scanned by tools/content_scan.py rather than grep/xargs: their exit codes differ between BSD
    # and GNU, and distinguishing "matched nothing" from "could not run" across both platforms is
    # what broke this check on CI after it had passed locally. One process, explicit exit codes.
    hits="$(python3 "$REPO/tools/content_scan.py" "$PATTERNS_FILE" <"$files_list" 2>/dev/null)"
    rc=$?
    if [ "$rc" -ne 0 ]; then
        echo "guard: the content scanner could not run (exit $rc) — refusing to" >&2
        echo "       report the tree clean when nothing was scanned." >&2
        fail=1
        return 0
    fi
    if [ -n "$hits" ]; then
        echo "guard: forbidden content ($label):" >&2
        printf '%s\n' "$hits" | sed 's/^/    /' >&2
        fail=1
    fi
}

list="$(mktemp)"
trap 'rm -f "$list" "$list.path" "$list.bak"' EXIT

case "$MODE" in
    tracked)
        # Discover files from git, so a new top-level directory cannot escape the scan.
        git ls-files | grep -Ev "$EXEMPT_RE" >"$list"
        report_content_hits "tracked" "$list" "$list"
        report_identity_hits "tracked" "$list"
        ;;
    staged)
        # Scan committed blobs from the index, so what is checked is what would land.
        git diff --cached --name-only --diff-filter=ACM | grep -Ev "$EXEMPT_RE" >"$list.path"
        while IFS= read -r f; do
            [ -n "$f" ] || continue
            printf '\n===== %s =====\n' "$f"
            git show ":$f" 2>/dev/null || true
        done <"$list.path" >"$list.bak"
        mv "$list.bak" "$list"
        report_content_hits "staged" "$list.path" "$list"
        report_identity_hits "staged" "$list.path"
        ;;
    paths)
        for f in $TARGETS; do printf '%s\n' "$f" >>"$list.path"; done
        report_content_hits "paths" "$list.path" "$list.path"
        report_identity_hits "paths" "$list.path"
        ;;
    identity|audit)
        # nothing to scan; the identity assertions below are the whole check
        ;;
esac

# Secret-shaped values: a credential-ish key name followed by a long literal.
SECRET_RE='(api[_-]?key|secret|password|passwd|token)["'"'"']?[[:space:]]*[:=][[:space:]]*["'"'"']?[A-Za-z0-9_/+-]{16,}'
secret_hits=""
case "$MODE" in
    tracked|paths)
        if [ "$MODE" = "tracked" ]; then
            sec_list="$(git ls-files | grep -Ev "$EXEMPT_RE")"
        else
            sec_list="$TARGETS"
        fi
        if [ -n "$sec_list" ]; then
            printf '%s\n' "$sec_list" >"$list"
            secret_hits="$(tr '\n' '\0' <"$list" | xargs -0 grep -InEi "$SECRET_RE" 2>/dev/null || true)"
        fi
        ;;
    staged)
        secret_hits="$(git diff --cached -U0 | grep -E '^\+' | grep -Ei "$SECRET_RE" || true)"
        ;;
esac
# Known test fixtures are dropped before reporting; see the allow-list for why a line belongs
# there and why adding one is a reviewable act.
if [ -n "$secret_hits" ] && [ -f "$SECRET_ALLOWLIST_FILE" ]; then
    secret_hits="$(printf '%s\n' "$secret_hits" | grep -Evf "$SECRET_ALLOWLIST_FILE" || true)"
fi
if [ -n "$secret_hits" ]; then
    echo "guard: secret-shaped value detected:" >&2
    printf '%s\n' "$secret_hits" | sed 's/^/    /' >&2
    fail=1
fi

# ---------------------------------------------------------------------------
# 2. Commit identity — only where a commit is being created, never in a bare CI checkout
# ---------------------------------------------------------------------------
if [ "$CHECK_IDENTITY" = "1" ]; then
    # An explicitly set (even empty) GIT_AUTHOR_* means "this is the identity, do not fall back to
    # git config". Without that distinction, `VAR= cmd` cannot express "no identity", which is
    # exactly the CI condition this check has to tolerate.
    if [ "${GIT_AUTHOR_NAME+set}" = "set" ] || [ "${GIT_AUTHOR_EMAIL+set}" = "set" ]; then
        name="${GIT_AUTHOR_NAME:-}"
        email="${GIT_AUTHOR_EMAIL:-}"
    else
        name="$(git config user.name 2>/dev/null || true)"
        email="$(git config user.email 2>/dev/null || true)"
    fi
    if [ -z "$name" ] && [ -z "$email" ]; then
        # No identity configured. Normal in a CI checkout, so only --require-identity and
        # --staged treat it as a defect: those are the paths where a commit is being created.
        if [ "$REQUIRE_IDENTITY" = "1" ]; then
            echo "guard: no commit identity is configured." >&2
            echo "       expected: $IDENTITY_NAME <$IDENTITY_EMAIL>" >&2
            fail=1
        else
            echo "guard: note — no commit identity configured (expected in CI)"
        fi
    elif [ "$name" != "$IDENTITY_NAME" ] || [ "$email" != "$IDENTITY_EMAIL" ]; then
        echo "guard: commit identity is not the company identity." >&2
        echo "       expected: $IDENTITY_NAME <$IDENTITY_EMAIL>" >&2
        echo "       actual:   ${name:-<unset>} <${email:-<unset>}>" >&2
        echo "       fix with: git config --local user.name '$IDENTITY_NAME'" >&2
        echo "                 git config --local user.email '$IDENTITY_EMAIL'" >&2
        fail=1
    fi
fi

# ---------------------------------------------------------------------------
# 3. Commit audit — the AUTHOR and COMMITTER of every reachable commit, and its MESSAGE
# ---------------------------------------------------------------------------
# The checks above inspect files. They cannot see commit metadata, and commit metadata is where
# this repository has three times been caught out: a server-side merge is attributed to the account
# that performed the merge, not to git config and not to the commit's original author; and the
# message is a third place an identity can hide, which nothing checked until one arrived.
if [ "$MODE" = "audit" ]; then
    bad_commits=0
    while IFS='|' read -r sha an ae cn ce; do
        [ -n "$sha" ] || continue
        ac="$(printf '%s <%s>' "$an" "$ae")"
        cc="$(printf '%s <%s>' "$cn" "$ce")"
        # Allow-listed automation identities are accepted; see that file for why only one is.
        case "$ALLOWED_IDENTITIES" in *"|$ac|"*) ac="$IDENTITY_NAME <$IDENTITY_EMAIL>" ;; esac
        case "$ALLOWED_IDENTITIES" in *"|$cc|"*) cc="$IDENTITY_NAME <$IDENTITY_EMAIL>" ;; esac
        if [ "$ac" != "$IDENTITY_NAME <$IDENTITY_EMAIL>" ] ||
           [ "$cc" != "$IDENTITY_NAME <$IDENTITY_EMAIL>" ]; then
            echo "guard: commit with a foreign identity: $sha" >&2
            echo "       author:    $an <$ae>" >&2
            echo "       committer: $cn <$ce>" >&2
            bad_commits=$((bad_commits + 1))
        fi
    # Merge commits are included on purpose. Excluding them was a hole: a merge performed through
    # the hosting platform is attributed to the ACCOUNT THAT MERGED, so a personal identity can
    # arrive as a merge commit and be invisible to a check that skips merges. That is exactly how
    # one reached main. The synthetic merge commits the platform creates for review are covered by
    # the allow-list instead, which is a much narrower exemption than skipping a commit type.
    done < <(git log --all --format='%h|%an|%ae|%cn|%ce' 2>/dev/null || true)

    if [ "$bad_commits" -gt 0 ]; then
        echo "guard: $bad_commits commit(s) carry an identity other than $IDENTITY_NAME <$IDENTITY_EMAIL>" >&2
        echo "       a server-side merge is attributed to the merging account: merge locally instead" >&2
        fail=1
    else
        echo "guard: commit audit ok — every commit is $IDENTITY_NAME <$IDENTITY_EMAIL>"
    fi

    # ---- the message is a third place an identity can hide -----------------
    #
    # A `Co-authored-by:` trailer, a `Signed-off-by:`, a "thanks to" line: all of them publish an
    # address in the commit message, and none of them touches the author or committer fields or any
    # file. One arrived this way — a personal address in a trailer on a commit pushed straight to
    # main — and every check this repository had passed it.
    #
    # Matched by digest, through the same scanner the tracked-file check uses, so a finding names
    # the commit and never echoes the identity itself. GUARD_COMMIT_MESSAGES_FILE exists so the
    # self-test can exercise this without creating a commit carrying a real identity.
    msg_list="$(mktemp)"
    msg_dir=""
    if [ -n "${GUARD_COMMIT_MESSAGES_FILE:-}" ]; then
        printf '%s\n' "$GUARD_COMMIT_MESSAGES_FILE" >"$msg_list"
    else
        # One file per commit, named by its short SHA, so a finding names the commit. `%x01` starts
        # each record; awk splits on it in a single pass rather than one `git log` per commit.
        msg_dir="$(mktemp -d)"
        git log --all --format='%x01%h%x02%B' 2>/dev/null | awk -v dir="$msg_dir" '
            /^\001/ {
                if (target != "") close(target)
                sha = substr($0, 2)
                sub(/\002.*$/, "", sha)
                target = dir "/" sha
                rest = $0
                sub(/^\001[^\002]*\002/, "", rest)
                print rest > target
                next
            }
            { if (target != "") print > target }
        '
        for f in "$msg_dir"/*; do
            [ -f "$f" ] && printf '%s\n' "$f" >>"$msg_list"
        done
    fi

    if [ ! -f "$DIGESTS_FILE" ]; then
        echo "guard: $DIGESTS_FILE is missing — the commit-message scan cannot run, refusing to" >&2
        echo "       report the history clean." >&2
        fail=1
    elif [ -s "$msg_list" ]; then
        msg_hits="$(python3 "$REPO/tools/identity_scan.py" "$DIGESTS_FILE" <"$msg_list" 2>/dev/null)"
        msg_rc=$?
        if [ "$msg_rc" -ne 0 ]; then
            echo "guard: the commit-message identity scanner could not run (exit $msg_rc) —" >&2
            echo "       refusing to report the history clean when the messages were not read." >&2
            fail=1
        elif [ -n "$msg_hits" ]; then
            echo "guard: a commit MESSAGE carries a forbidden identity:" >&2
            printf '%s\n' "$msg_hits" | while IFS= read -r hit; do
                hit_sha="$(printf '%s' "$hit" | sed -n 's|.*/\([^/]*\):[0-9][0-9]*:.*|\1|p')"
                echo "       commit ${hit_sha:-<unknown>}" >&2
            done
            echo "       a message is published with the commit, so the identity is published too." >&2
            echo "       Removing the trailer means rewriting that commit; nothing else un-publishes it." >&2
            fail=1
        else
            echo "guard: commit messages ok — no forbidden identity in any message"
        fi
    fi

    rm -rf "$msg_list" "$msg_dir" 2>/dev/null || true
fi

if [ "$fail" -ne 0 ]; then
    echo "guard: FAILED" >&2
    exit 1
fi

echo "guard: ok — content clean, identity $IDENTITY_NAME <$IDENTITY_EMAIL>"
