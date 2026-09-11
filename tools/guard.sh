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
#   tools/guard.sh --identity            check identity; report but do not fail if unset
#   tools/guard.sh --require-identity    check identity; an unset identity is a failure
#   tools/guard.sh --audit-commits       check the AUTHOR and COMMITTER of every non-merge commit
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
DIGESTS_FILE="tools/identity-digests.txt"
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
    --identity)         MODE="identity"; CHECK_IDENTITY=1 ;;
    --require-identity) MODE="identity"; CHECK_IDENTITY=1; REQUIRE_IDENTITY=1 ;;
    --audit-commits)    MODE="audit";   CHECK_IDENTITY=1; REQUIRE_IDENTITY=1 ;;
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
    local label="$1" files_list="$2" hits=""
    [ -s "$files_list" ] || return 0
    [ -f "$DIGESTS_FILE" ] || return 0
    hits="$(tr '\n' '\0' <"$files_list" | xargs -0 python3 "$REPO/tools/identity_scan.py" "$DIGESTS_FILE" 2>/dev/null || true)"
    if [ -n "$hits" ]; then
        echo "guard: forbidden identity ($label):" >&2
        printf '%s\n' "$hits" | sed 's/^/    /' >&2
        fail=1
    fi
}

report_content_hits() {
    # $1 = label, $2 = path to a file listing files, $3 = path holding the text to scan
    local label="$1" files_list="$2" content="$3" hits
    [ -s "$files_list" ] || return 0
    hits="$(tr '\n' '\0' <"$files_list" | xargs -0 grep -InEi "$PATTERN" 2>/dev/null || true)"
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
        # No identity configured. Normal in a CI checkout; a defect when a commit is being made.
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
# 3. Commit audit — the AUTHOR and COMMITTER of every reachable commit
# ---------------------------------------------------------------------------
# The checks above inspect files. They cannot see commit metadata, and commit metadata is where
# this repository has twice been caught out: a server-side merge is attributed to the account
# that performed the merge, not to git config and not to the commit's original author. A commit
# can therefore carry a foreign identity while every file in it is spotless.
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
    # --no-merges: a pull-request check is run against a synthetic merge commit that the hosting
    # platform creates and attributes to itself. That commit is an artefact of review, not part of
    # any branch's history, so auditing it reports the platform as a foreign identity and fails on
    # every pull request. The substantive commits are what carry authorship, and those are checked.
    done < <(git log --no-merges --all --format='%h|%an|%ae|%cn|%ce' 2>/dev/null || true)

    if [ "$bad_commits" -gt 0 ]; then
        echo "guard: $bad_commits commit(s) carry an identity other than $IDENTITY_NAME <$IDENTITY_EMAIL>" >&2
        echo "       a server-side merge is attributed to the merging account: merge locally instead" >&2
        fail=1
    else
        echo "guard: commit audit ok — every commit is $IDENTITY_NAME <$IDENTITY_EMAIL>"
    fi
fi

if [ "$fail" -ne 0 ]; then
    echo "guard: FAILED" >&2
    exit 1
fi

echo "guard: ok — content clean, identity $IDENTITY_NAME <$IDENTITY_EMAIL>"
