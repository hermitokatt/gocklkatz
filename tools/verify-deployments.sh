#!/usr/bin/env bash
# Verifies every live deployment from OUTSIDE, route by route.
#
# The difference from `tools/verify-live.sh`:
#
#   verify-live.sh         ownership and reachability of the PUBLISHED SURFACE. One URL per project,
#                          and the question is "can a stranger open this, or does Deployment
#                          Protection hand them a login?"
#   verify-deployments.sh  the deployed APPLICATION, route by route. Many routes per project, and the
#                          question is "is each route serving what this app actually renders?"
#
# Both are needed. A host can answer 200 while a route 500s; a route can answer 200 with an error
# page; and a project can be gated so nobody sees either.
#
# Why a dashboard cannot do this: Vercel reports on the deployment, not on what a route serves. Every
# assertion below is on the response BODY, so a route that answers 200 with an error page, an empty
# shell, or another application's HTML fails.
#
# Usage:
#   bash tools/verify-deployments.sh                  # every route of every live deployment
#   bash tools/verify-deployments.sh --url <url> [<text>]
#                                                     # ad-hoc route, for showing the check fail
#   bash tools/verify-deployments.sh --expect-fail    # exit 0 only if something FAILED
#
# Exit: 0 every route served its application, 1 something did not, 2 misconfigured.
#
# Showing it fail (A-2):
#   bash tools/verify-deployments.sh --expect-fail --url https://no-such-host.invalid/

set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO" || exit 2

ONLY_URL=""
ONLY_TEXT=""
EXPECT_FAIL=0
while [ $# -gt 0 ]; do
    case "$1" in
        --url)
            shift
            ONLY_URL="${1:-}"
            [ -n "$ONLY_URL" ] || { echo "verify-deployments: --url needs a URL" >&2; exit 2; }
            if [ $# -gt 1 ] && [ "${2#--}" = "${2}" ]; then
                shift
                ONLY_TEXT="${1:-}"
            fi
            ;;
        --expect-fail) EXPECT_FAIL=1 ;;
        *) echo "verify-deployments: unknown argument '$1'" >&2; exit 2 ;;
    esac
    shift
done

command -v curl >/dev/null 2>&1 || { echo "verify-deployments: curl is not on PATH" >&2; exit 2; }

say() { printf '%s\n' "$*"; }
ok() { printf '  ok    %s\n' "$*"; }
bad() { printf '  FAIL  %s\n' "$*"; }

# One row per route: url | expected HTTP | substring the route actually serves
ROUTES=(
    "https://gocklkatz.vercel.app/|200|Gocklkatz Inc"
    "https://gocklkatz.vercel.app/api/health|200|{\"ok\":true,\"service\":\"gocklkatz\"}"

    "https://gocklkatz-ameisenwerkstatt.vercel.app/|200|Werkstatt"
    "https://gocklkatz-ameisenwerkstatt.vercel.app/ameisen|200|Ameisenfabrik"
    "https://gocklkatz-ameisenwerkstatt.vercel.app/api/health|200|{\"ok\":true,\"service\":\"demo-shell\"}"
    "https://gocklkatz-ameisenwerkstatt.vercel.app/api/ameisen/snapshot|200|\"cities\""

    "https://gocklkatz-simplified.vercel.app/|200|Simplified"
    "https://gocklkatz-simplified.vercel.app/learn/radicals|200|Radicals"
    "https://gocklkatz-simplified.vercel.app/learn/radicals/person|200|person; people"
    "https://gocklkatz-simplified.vercel.app/learn/radicals/practice|200|Practice"
    "https://gocklkatz-simplified.vercel.app/api/health|200|{\"ok\":true,\"service\":\"simplified\"}"
    "https://gocklkatz-simplified.vercel.app/api/radicals|200|\"radicals\""

    "https://gocklkatz-bienenstock.vercel.app/|200|Bienenstock"
    "https://gocklkatz-bienenstock.vercel.app/bienen|200|data-bienen-scene"
    "https://gocklkatz-bienenstock.vercel.app/api/health|200|{\"ok\":true,\"service\":\"bienenstock\"}"

    "https://gocklkatz-arbeitsmarkt.vercel.app/|200|Arbeitsmarkt"
    "https://gocklkatz-arbeitsmarkt.vercel.app/arbeitsmarkt|200|All records in this dataset are synthetic"
    "https://gocklkatz-arbeitsmarkt.vercel.app/arbeitsmarkt/digest|200|data-digest-entry"
    "https://gocklkatz-arbeitsmarkt.vercel.app/arbeitsmarkt/operations|200|data-alarm-state"
    "https://gocklkatz-arbeitsmarkt.vercel.app/api/health|200|{\"ok\":true,\"service\":\"arbeitsmarkt\"}"
)

if [ -n "$ONLY_URL" ]; then
    ROUTES=("$ONLY_URL|200|$ONLY_TEXT")
fi

say "verify-deployments: ${#ROUTES[@]} route(s)"
say "date:               $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
say "fetched:            anonymously, bodies asserted"
say ""

failures=0
checked=0

for row in "${ROUTES[@]}"; do
    url="${row%%|*}"
    rest="${row#*|}"
    want_code="${rest%%|*}"
    want_text="${rest#*|}"
    checked=$((checked + 1))

    body="$(mktemp "${TMPDIR:-/tmp}/verify-deployments.XXXXXX")"
    meta="$(curl -sS -m 25 -o "$body" -w '%{http_code} %{redirect_url}' "$url" 2>/dev/null || echo "000 -")"
    code="${meta%% *}"
    redirect="${meta#* }"

    if [ "$code" != "$want_code" ]; then
        case "$code" in
            301|302|307|308)
                bad "$url — HTTP $code, not $want_code (gated? redirects to $redirect)"
                ;;
            000)
                bad "$url — no response (host does not resolve, or the connection failed)"
                ;;
            *)
                bad "$url — HTTP $code, not $want_code"
                ;;
        esac
        failures=$((failures + 1))
    elif [ -n "$want_text" ] && ! grep -qF "$want_text" "$body"; then
        # A 200 is not a pass: an error page, an empty shell, or another app's HTML also answer 200.
        bad "$url — HTTP $code but the body does not contain '$want_text'"
        failures=$((failures + 1))
    else
        bytes="$(wc -c < "$body" | tr -d ' ')"
        if [ -n "$want_text" ]; then
            ok "$code  $url  ($bytes bytes, contains '$want_text')"
        else
            ok "$code  $url  ($bytes bytes)"
        fi
    fi
    rm -f "$body"
done

say ""
if [ "$EXPECT_FAIL" = "1" ]; then
    if [ "$failures" -gt 0 ]; then
        say "verify-deployments: $failures of $checked failed, as expected — the check notices a deployment that is not serving"
        exit 0
    fi
    say "verify-deployments: expected at least one failure and got none; the check is proving nothing" >&2
    exit 1
fi

if [ "$failures" -ne 0 ]; then
    say "verify-deployments: FAIL ($failures of $checked route(s) are not serving what they should)"
    exit 1
fi
say "verify-deployments: PASS ($checked route(s) across every live deployment, each serving its own content)"
exit 0
