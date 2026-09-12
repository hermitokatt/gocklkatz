#!/usr/bin/env bash
# Proves every PUBLISHED URL is reachable by a stranger.
#
# A deployment can exist, build successfully, and still refuse every visitor: Vercel's Deployment
# Protection intercepts the request and redirects it to an SSO login. A portfolio behind a login is
# not published, and nothing else in this repository notices — the deployment is green, the build log
# is clean, and the dashboard is happy.
#
# So this check does three things a dashboard cannot:
#
#   1. It fetches ANONYMOUSLY — no session, no cookies, no Vercel account.
#   2. It treats a `302` to an authentication host as FAILURE. It does not follow the redirect: a
#      followed redirect would land on a login page, answer `200`, and report success for a site
#      nobody can read.
#   3. It asserts a string the application actually renders, because an error page or a login page
#      can also answer `200`.
#
# What is PUBLISHED, and what is not:
#
#   published      the custom domain attached to each project, e.g. gocklkatz.vercel.app
#   not published  the project and branch aliases, e.g. gocklkatz-gocklkatz.vercel.app, which
#                  `ssoProtection: all_except_custom_domains` deliberately gates
#
# Only the published ones are listed below. The gated ones are the negative fixture — see the `--url`
# example in the usage, which is how this check was shown to tell the two apart.
#
# Usage:
#   bash tools/verify-live.sh                          # check every published URL
#   bash tools/verify-live.sh --url <url> [<text>]     # check one URL, optionally asserting text
#   bash tools/verify-live.sh --expect-fail            # exit 0 only if something FAILED
#
# Exit: 0 every URL served the application, 1 at least one did not, 2 misconfigured.
#
# The negative fixture, which must FAIL:
#   bash tools/verify-live.sh --expect-fail \
#     --url https://gocklkatz-gocklkatz.vercel.app/ "Gocklkatz Inc"

set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO" || exit 2

# The published surface: one custom domain per project, and a string that project actually renders.
TARGET_URLS=(
    "https://gocklkatz.vercel.app/"
    "https://gocklkatz-ameisenwerkstatt.vercel.app/"
    "https://gocklkatz-simplified.vercel.app/"
    "https://gocklkatz-bienenstock.vercel.app/bienen"
    "https://gocklkatz-arbeitsmarkt.vercel.app/arbeitsmarkt"
)
TARGET_TEXTS=(
    "Gocklkatz Inc"
    "Werkstatt"
    "Simplified"
    "Bienenstock"
    "Synthetic"
)
TARGET_LABELS=(
    "landing page"
    "Ameisenwerkstatt"
    "Simplified"
    "Bienenstock"
    "Arbeitsmarkt"
)

ONLY_URL=""
ONLY_TEXT=""
EXPECT_FAIL=0
while [ $# -gt 0 ]; do
    case "$1" in
        --url)
            shift
            ONLY_URL="${1:-}"
            [ -n "$ONLY_URL" ] || { echo "verify-live: --url needs a URL" >&2; exit 2; }
            if [ $# -gt 1 ] && [ "${2#--}" = "${2}" ]; then
                shift
                ONLY_TEXT="${1:-}"
            fi
            ;;
        --expect-fail) EXPECT_FAIL=1 ;;
        *) echo "verify-live: unknown argument '$1'" >&2; exit 2 ;;
    esac
    shift
done

for tool in curl python3; do
    command -v "$tool" >/dev/null 2>&1 || { echo "verify-live: $tool is not on PATH" >&2; exit 2; }
done

say() { printf '%s\n' "$*"; }
ok() { printf '  ok    %s\n' "$*"; }
bad() { printf '  FAIL  %s\n' "$*"; }

if [ -n "$ONLY_URL" ]; then
    urls=("$ONLY_URL")
    texts=("$ONLY_TEXT")
    labels=("ad-hoc URL")
else
    urls=("${TARGET_URLS[@]}")
    texts=("${TARGET_TEXTS[@]}")
    labels=("${TARGET_LABELS[@]}")
fi

say "verify-live: ${#urls[@]} URL(s)"
say "date:        $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
say "fetched:     anonymously, following no redirects"
say ""

failures=0
checked=0

for i in "${!urls[@]}"; do
    url="${urls[$i]}"
    want="${texts[$i]}"
    label="${labels[$i]}"
    checked=$((checked + 1))

    body="$(mktemp "${TMPDIR:-/tmp}/verify-live.XXXXXX")"
    meta="$(curl -sS -m 25 -o "$body" -w '%{http_code} %{redirect_url}' "$url" 2>/dev/null || echo "000 -")"
    code="${meta%% *}"
    redirect="${meta#* }"

    case "$code" in
        301|302|307|308)
            case "$redirect" in
                *sso-api*|*vercel.com/login*|*vercel.com/sso*)
                    bad "$label — $code to an authentication host, so a visitor gets a login: $url"
                    bad "        redirects to: $redirect"
                    ;;
                *)
                    bad "$label — $code redirect, not followed: $url -> $redirect"
                    ;;
            esac
            failures=$((failures + 1))
            ;;
        200)
            if [ -n "$want" ] && ! grep -qF "$want" "$body"; then
                bad "$label — HTTP 200 but the body does not contain '$want': $url"
                failures=$((failures + 1))
            else
                bytes="$(wc -c < "$body" | tr -d ' ')"
                if [ -n "$want" ]; then
                    ok "$label — 200, contains '$want' ($bytes bytes): $url"
                else
                    ok "$label — 200 ($bytes bytes): $url"
                fi
            fi
            ;;
        *)
            bad "$label — HTTP $code: $url"
            failures=$((failures + 1))
            ;;
    esac
    rm -f "$body"
done

say ""
if [ "$EXPECT_FAIL" = "1" ]; then
    if [ "$failures" -gt 0 ]; then
        say "verify-live: $failures of $checked failed, as expected — the check tells gated from published"
        exit 0
    fi
    say "verify-live: expected at least one failure and got none; the check is proving nothing" >&2
    exit 1
fi

if [ "$failures" -ne 0 ]; then
    say "verify-live: FAIL ($failures of $checked URL(s) are not reachable by a stranger)"
    exit 1
fi
say "verify-live: PASS ($checked URL(s) reachable anonymously, each serving its own content)"
exit 0
