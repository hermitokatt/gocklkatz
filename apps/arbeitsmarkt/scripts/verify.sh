#!/usr/bin/env bash
# Proves Arbeitsmarkt RUNS, which scripts/ci.sh cannot.
#
# Builds the app, starts it, waits for the port to accept connections, probes the served HTTP
# surface, and always shuts the server down again — including on failure. Asserting on the port
# being released afterwards is deliberate: a verify that leaves a server behind poisons the next
# run, and the next run would then be probing somebody else's process.
#
# What it asserts, and why each one is here:
#
#   /                       200, and names the app
#   /arbeitsmarkt           200, contains the synthetic-data statement, and renders at least
#                           SAMPLE_MIN sample records — counted from the record markup, not grepped
#                           from a string. A 200 on an error page or empty shell must not pass.
#   /arbeitsmarkt/digest    200, synthetic statement, pipeline stage counts, and at least
#                           DIGEST_MIN entries each carrying a rank and a stated reason (counted
#                           per entry, not once on the page). Also asserts the top score is
#                           strictly greater than the score at DIGEST_MIN — a flat scoreboard is
#                           not a ranking.
#   /arbeitsmarkt/operations
#                           200, synthetic statement, every alarm id named (counted, not one
#                           match), a quarantined source visible, and A-3: every rendered
#                           source id / display name matches the synthetic construction (and
#                           any listing id / employer markers, if present, match theirs).
#   /api/health             200, JSON, `"ok": true`, and naming this app. The service field is
#                           checked too: `ok` alone would let a sibling app that answers the same
#                           shape pass as this one.
#
# Usage:  bash scripts/verify.sh
# Env:    VERIFY_PORT  override the port (default 43127; 43123 Ameisenwerkstatt, 43124 landing,
#                      43125 Simplified, 43126 Bienenstock)
#
# Written for bash 3.2, which is what macOS ships as /bin/bash.

set -uo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR" || exit 2

PORT="${VERIFY_PORT:-43127}"
HOST="127.0.0.1"
BASE="http://$HOST:$PORT"
READY_TIMEOUT_S="${VERIFY_READY_TIMEOUT_S:-180}"
# Digests must show enough ranked rows that the funnel is visible. Counted per entry markup.
DIGEST_MIN=8
# The base view renders a sample of the dataset. Counted per record markup, not by grepping for a
# string the legend also contains.
SAMPLE_MIN=4
# Operational model alarm ids — must all appear on the operations page (counted, not one match).
ALARM_IDS="source_quarantined source_backed_off budget_exhausted disabled_source_collected"
ALARM_COUNT=4
# Source cards on the operations view.
SOURCE_MIN=4
# Generous on purpose. On a cold CI runner the first start can take far longer than on a
# developer machine, and a timeout that is too tight produces a failure that looks like a
# broken app. The wait reports progress every 15s, so a genuinely hung start is visible.

SERVER_PID=""
CLEANED=0
LEAKED=0
FAILED=0
LOG="$(mktemp "${TMPDIR:-/tmp}/arbeitsmarkt-verify.XXXXXX")" || exit 2

say() { printf '%s\n' "$*"; }
step() { printf '\n==> %s\n' "$*"; }
ok() { printf '    ok    %s\n' "$*"; }
bad() { printf '    FAIL  %s\n' "$*"; FAILED=1; }

dump_log() {
    say "    ---- last 40 lines of the server log ----"
    tail -40 "$LOG" | sed 's/^/    /'
    say "    ----------------------------------------"
}

port_is_free() {
    if command -v lsof >/dev/null 2>&1; then
        ! lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
    else
        # No lsof: try to connect. A refused connection means nothing is listening.
        ! (exec 3<>/dev/tcp/127.0.0.1/"$1") 2>/dev/null
    fi
}

# Always runs, including on failure and on Ctrl-C.
cleanup() {
    [ "$CLEANED" = "1" ] && return 0
    CLEANED=1

    # On failure, say how far the script got before it stopped. Without this, a CI-only failure
    # reports only the step's consequence and the reader cannot tell which step produced it.
    if [ "${FAILED:-0}" != "0" ] || [ "${LEAKED:-0}" != "0" ]; then
        say ""
        say "verify: FAILED after the step marked above. Server log follows in full:"
        sed 's/^/    | /' "$LOG"
    fi

    if [ -n "$SERVER_PID" ]; then
        step "shutting the server down"
        # Started under job control, so it has its own process group and the negative pid takes
        # its children with it. `next start` forks a worker.
        kill -TERM "-$SERVER_PID" 2>/dev/null || kill -TERM "$SERVER_PID" 2>/dev/null || true
        n=0
        while [ "$n" -lt 20 ]; do
            kill -0 "$SERVER_PID" 2>/dev/null || break
            sleep 0.5
            n=$((n + 1))
        done
        if kill -0 "$SERVER_PID" 2>/dev/null; then
            kill -KILL "-$SERVER_PID" 2>/dev/null || kill -KILL "$SERVER_PID" 2>/dev/null || true
            sleep 1
        fi
        wait "$SERVER_PID" 2>/dev/null

        if port_is_free "$PORT"; then
            ok "server stopped, port $PORT released"
        else
            bad "port $PORT is still bound after shutdown"
            LEAKED=1
        fi
    fi

    rm -f "$LOG"
    [ "$LEAKED" = "1" ] && exit 1
    return 0
}
trap cleanup EXIT INT TERM

say "verify: Arbeitsmarkt"
say "base:   $BASE"

# The probe needs curl. A missing curl would look exactly like a server that never answers, and
# that ambiguity cost a CI cycle, so it is checked explicitly.
for tool in curl npm; do
    if ! command -v "$tool" >/dev/null 2>&1; then
        say "verify: $tool is not on PATH; cannot probe the server."
        exit 4
    fi
done

# ---------------------------------------------------------------------------
step "the port is free"
if ! port_is_free "$PORT"; then
    bad "something is already listening on $PORT"
    say "          refusing to probe a server this script did not start; set VERIFY_PORT to use"
    say "          another port, or stop whatever holds this one"
    exit 3
fi
ok "nothing is listening on $PORT"

# ---------------------------------------------------------------------------
if [ ! -f node_modules/.package-lock.json ]; then
    step "install dependencies (npm ci)"
    if ! npm ci >>"$LOG" 2>&1; then
        bad "npm ci"
        dump_log
        exit 1
    fi
    ok "install dependencies"
fi

# ---------------------------------------------------------------------------
step "build (next build)"
if ! npm run --silent build >>"$LOG" 2>&1; then
    bad "build"
    dump_log
    exit 1
fi
ok "build"

# ---------------------------------------------------------------------------
step "start (next start on $PORT)"
set -m
node_modules/.bin/next start --hostname "$HOST" --port "$PORT" >>"$LOG" 2>&1 &
SERVER_PID=$!
set +m
ok "started (pid $SERVER_PID)"

# ---------------------------------------------------------------------------
step "waiting for $BASE to accept connections"
waited=0
ready=0
while [ "$waited" -lt "$READY_TIMEOUT_S" ]; do
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
        bad "the server exited before it accepted a connection"
        dump_log
        exit 1
    fi
    if curl -s -o /dev/null -m 2 "$BASE/api/health" 2>/dev/null; then
        ready=1
        break
    fi
    # Every 15s, say what the probe is seeing. A wait that reports nothing cannot be told apart
    # from a wait that is not running.
    if [ $((waited % 15)) -eq 0 ]; then
        probe_rc="$(curl -s -o /dev/null -w '%{http_code}' -m 2 "$BASE/api/health" 2>&1)"
        say "    ... waiting ${waited}s (curl exit $?, response '${probe_rc:-none}')"
    fi
    waited=$((waited + 2))
done
if [ "$ready" != "1" ]; then
    bad "no answer from $BASE within ${READY_TIMEOUT_S}s"
    dump_log
    exit 1
fi
ok "answering after about ${waited}s"

# ---------------------------------------------------------------------------
step "probing the served application"

# / — the app's own card
body="$(curl -sS -m 10 -w '\n%{http_code}' "$BASE/" 2>/dev/null)"
code="$(printf '%s' "$body" | tail -1)"
html="$(printf '%s' "$body" | sed '$d')"
say "route GET /                       $code"
if [ "$code" = "200" ] && printf '%s' "$html" | grep -q 'Arbeitsmarkt'; then
    ok "GET / is 200 and names the app"
else
    bad "GET / did not answer 200 with the app's name (got $code)"
fi

# /arbeitsmarkt — synthetic statement + rendered content, not status alone
body="$(curl -sS -m 10 -w '\n%{http_code}' "$BASE/arbeitsmarkt" 2>/dev/null)"
code="$(printf '%s' "$body" | tail -1)"
html="$(printf '%s' "$body" | sed '$d')"
say "route GET /arbeitsmarkt           $code"

# Count the sample records themselves. This used to grep for the literal `SYN-`, which the
# legend also contains, so the assertion passed on an EMPTY dataset: the legend alone satisfied it.
# Observed with `records: []` — this route reported ok while the digest route reported
# `entries=0`. A check that a page renders records has to count records.
sample_count="$(printf '%s' "$html" | grep -o 'data-sample-record=' | wc -l | tr -d ' ')"
say "          sample records rendered: $sample_count (need >= $SAMPLE_MIN)"
if [ "$code" = "200" ] \
    && [ "$sample_count" -ge "$SAMPLE_MIN" ] \
    && printf '%s' "$html" | grep -q 'All records in this dataset are synthetic' \
    && printf '%s' "$html" | grep -q 'Synthetic data only'; then
    ok "GET /arbeitsmarkt is 200 with synthetic statement and $sample_count rendered records"
else
    bad "GET /arbeitsmarkt did not answer 200 with synthetic statement and rendered content (got $code)"
fi

# /arbeitsmarkt/digest — ranked entries counted per-entry, stages, synthetic statement
body="$(curl -sS -m 10 -w '\n%{http_code}' "$BASE/arbeitsmarkt/digest" 2>/dev/null)"
code="$(printf '%s' "$body" | tail -1)"
html="$(printf '%s' "$body" | sed '$d')"
say "route GET /arbeitsmarkt/digest    $code"

# Count entry chunks that each carry data-rank and data-reason. Splitting on the entry marker
# means one well-formed entry cannot satisfy a check meant for DIGEST_MIN.
digest_entry_count="$(
    printf '%s' "$html" | awk -v RS='data-digest-entry' '
        NR > 1 {
            if ($0 ~ /data-rank=/ && $0 ~ /data-reason/) ok++
        }
        END { print ok+0 }
    '
)"
say "          digest entries with rank+reason: $digest_entry_count (need >= $DIGEST_MIN)"

stage_ok=1
for stage in collect filter rank digest; do
    if ! printf '%s' "$html" | grep -q "data-pipeline-stage=\"$stage\""; then
        stage_ok=0
        say "          missing pipeline stage marker: $stage"
    fi
done
# Stage counts must be present as attributes, not only as labels.
stage_count_attrs="$(printf '%s' "$html" | grep -o 'data-stage-count="[0-9]*"' | wc -l | tr -d ' ')"
say "          data-stage-count attributes: $stage_count_attrs"

# Ranking must differentiate: top score strictly greater than the score at DIGEST_MIN.
# gawk 3-arg match() is not portable; use sed on each entry chunk instead.
score_list="$(
    printf '%s' "$html" | awk -v RS='data-digest-entry' 'NR > 1 { print }' \
        | sed -n 's/.*data-score="\([0-9.][0-9.]*\)".*/\1/p'
)"
score_1=""
score_n=""
score_i=0
while IFS= read -r sc; do
    [ -z "$sc" ] && continue
    score_i=$((score_i + 1))
    if [ "$score_i" -eq 1 ]; then
        score_1="$sc"
    fi
    if [ "$score_i" -eq "$DIGEST_MIN" ]; then
        score_n="$sc"
    fi
done <<EOF
$score_list
EOF
say "          score at rank 1: ${score_1:-none}; score at rank $DIGEST_MIN: ${score_n:-none}"

ranking_differentiates=0
if [ -n "$score_1" ] && [ -n "$score_n" ]; then
    if awk -v a="$score_1" -v b="$score_n" 'BEGIN { exit !(a > b) }'; then
        ranking_differentiates=1
    fi
fi

if [ "$code" = "200" ] \
    && printf '%s' "$html" | grep -q 'All records in this dataset are synthetic' \
    && printf '%s' "$html" | grep -q 'data-synthetic-statement' \
    && [ "$digest_entry_count" -ge "$DIGEST_MIN" ] \
    && [ "$stage_ok" = "1" ] \
    && [ "$stage_count_attrs" -ge 4 ] \
    && [ "$ranking_differentiates" = "1" ]; then
    ok "GET /arbeitsmarkt/digest is 200 with >= $DIGEST_MIN ranked entries (each with reason), stages, and synthetic statement"
else
    bad "GET /arbeitsmarkt/digest failed content checks (got $code; entries=$digest_entry_count; stages_ok=$stage_ok; stage_attrs=$stage_count_attrs; ranking_diff=$ranking_differentiates)"
fi

# /arbeitsmarkt/operations — alarms named by id, quarantine visible, synthetic statement, A-3
body="$(curl -sS -m 10 -w '\n%{http_code}' "$BASE/arbeitsmarkt/operations" 2>/dev/null)"
code="$(printf '%s' "$body" | tail -1)"
html="$(printf '%s' "$body" | sed '$d')"
say "route GET /arbeitsmarkt/operations $code"

alarm_named=0
alarm_missing=""
for alarm_id in $ALARM_IDS; do
    # Count distinct data-alarm-id markers for this id (not a single page-wide grep).
    hits="$(printf '%s' "$html" | grep -o "data-alarm-id=\"$alarm_id\"" | wc -l | tr -d ' ')"
    if [ "$hits" -ge 1 ]; then
        alarm_named=$((alarm_named + 1))
        say "          alarm id named: $alarm_id (markers=$hits)"
    else
        alarm_missing="$alarm_missing $alarm_id"
        say "          missing alarm id: $alarm_id"
    fi
done
say "          alarms named: $alarm_named / $ALARM_COUNT"

source_count="$(printf '%s' "$html" | grep -o 'data-source-id=' | wc -l | tr -d ' ')"
say "          source cards rendered: $source_count (need >= $SOURCE_MIN)"

quarantined_count="$(printf '%s' "$html" | grep -o 'data-operational-status="quarantined"' | wc -l | tr -d ' ')"
say "          quarantined sources shown: $quarantined_count (need >= 1)"

# A-3: positive construction checks on marked fields. This cannot mean "no word that appears in
# a real listing" — titles and company stems are legitimate. It checks that every rendered
# identifier stays inside the synthetic schemes, and that every employer / source name matches
# the documented construction.
#
# A `while read` over an empty list runs zero times and leaves the verdict at pass, so a field the
# page does not render would be reported as clean while nothing was checked. On THIS page that is
# the case for employers and listing ids: the operations view renders sources only. Rather than
# leave two scans silently vacuous, they are stated as invariants — this view must render none —
# and counted, so a leak into this page fails instead of being skipped. Measured before this
# change: data-employer 0, data-listing-id 0.
a3_ok=1
a3_detail=""
source_id_seen=0
source_name_seen=0
employer_seen=0
listing_id_seen=0

# Source ids: syn-src-NNNN
while IFS= read -r sid; do
    [ -z "$sid" ] && continue
    source_id_seen=$((source_id_seen + 1))
    case "$sid" in
        syn-src-[0-9][0-9][0-9][0-9]) ;;
        *)
            a3_ok=0
            a3_detail="bad source id '$sid'"
            break
            ;;
    esac
done <<EOF
$(printf '%s' "$html" | tr ' ' '\n' | sed -n 's/^data-source-id="\([^"]*\)"$/\1/p')
EOF

# Source display names: SRC- + letters
if [ "$a3_ok" = "1" ]; then
    while IFS= read -r sname; do
        [ -z "$sname" ] && continue
        source_name_seen=$((source_name_seen + 1))
        case "$sname" in
            SRC-[A-Za-z]*) ;;
            *)
                a3_ok=0
                a3_detail="bad source name '$sname'"
                break
                ;;
        esac
    done <<EOF
$(printf '%s' "$html" | tr ' ' '\n' | sed -n 's/^data-source-name="\([^"]*\)"$/\1/p')
EOF
fi

# Listing ids (if any markers): syn-NNNN
if [ "$a3_ok" = "1" ]; then
    while IFS= read -r lid; do
        [ -z "$lid" ] && continue
        listing_id_seen=$((listing_id_seen + 1))
        case "$lid" in
            syn-[0-9][0-9][0-9][0-9]) ;;
            *)
                a3_ok=0
                a3_detail="bad listing id '$lid'"
                break
                ;;
        esac
    done <<EOF
$(printf '%s' "$html" | tr ' ' '\n' | sed -n 's/^data-listing-id="\([^"]*\)"$/\1/p')
EOF
fi

# Employers (if any markers): SYN- + letters
if [ "$a3_ok" = "1" ]; then
    while IFS= read -r emp; do
        [ -z "$emp" ] && continue
        employer_seen=$((employer_seen + 1))
        case "$emp" in
            SYN-[A-Za-z]*) ;;
            *)
                a3_ok=0
                a3_detail="bad employer '$emp'"
                break
                ;;
        esac
    done <<EOF
$(printf '%s' "$html" | tr ' ' '\n' | sed -n 's/^data-employer="\([^"]*\)"$/\1/p')
EOF
fi

# The two scans above read a field this page does not render, so on their own they would pass while
# checking nothing. State it as the invariant it is: the operations view lists SOURCES, and must not
# start publishing listing or employer fields. If someone later renders one here, this fails and
# they either mark it properly (and the scan above starts checking) or they have found a leak.
say "          A-3 markers seen: source-id=$source_id_seen source-name=$source_name_seen employer=$employer_seen listing-id=$listing_id_seen"

if [ "$a3_ok" = "1" ]; then
    if [ "$source_id_seen" -lt "$SOURCE_MIN" ]; then
        a3_ok=0
        a3_detail="only $source_id_seen source id(s) scanned; the id scheme was not exercised"
    elif [ "$source_name_seen" -lt "$SOURCE_MIN" ]; then
        a3_ok=0
        a3_detail="only $source_name_seen source name(s) scanned; the name scheme was not exercised"
    elif [ "$employer_seen" -ne 0 ] || [ "$listing_id_seen" -ne 0 ]; then
        a3_ok=0
        a3_detail="this view renders employer=$employer_seen listing-id=$listing_id_seen; operations shows sources only"
    fi
fi

say "          A-3 synthetic-field scan: $([ "$a3_ok" = "1" ] && echo pass || echo "FAIL ($a3_detail)")"

if [ "$code" = "200" ] \
    && printf '%s' "$html" | grep -q 'All records in this dataset are synthetic' \
    && printf '%s' "$html" | grep -q 'data-synthetic-statement' \
    && [ "$alarm_named" -eq "$ALARM_COUNT" ] \
    && [ -z "$alarm_missing" ] \
    && [ "$source_count" -ge "$SOURCE_MIN" ] \
    && [ "$quarantined_count" -ge 1 ] \
    && [ "$a3_ok" = "1" ]; then
    ok "GET /arbeitsmarkt/operations is 200 with $alarm_named named alarms, quarantine visible, synthetic statement, A-3 clean"
else
    bad "GET /arbeitsmarkt/operations failed content checks (got $code; alarms=$alarm_named/$ALARM_COUNT; sources=$source_count; quarantined=$quarantined_count; a3=$a3_ok)"
fi

# /api/health — asserted on the parsed body, not the status alone
body="$(curl -sS -m 10 "$BASE/api/health" 2>/dev/null)"
say "route GET /api/health             $(printf '%s' "$body" | head -c 60)"
if printf '%s' "$body" | grep -q '"ok":true' \
    && printf '%s' "$body" | grep -q '"service":"arbeitsmarkt"'; then
    ok "GET /api/health returns ok and the expected service"
else
    bad "GET /api/health body was not the expected JSON: $body"
fi

# ---------------------------------------------------------------------------
step "verdict"
if [ "$FAILED" -ne 0 ]; then
    say "    VERIFY: FAIL"
    dump_log
    exit 1
fi
say "    VERIFY: PASS"
exit 0
