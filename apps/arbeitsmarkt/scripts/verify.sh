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
#   /arbeitsmarkt           200, contains the synthetic-data statement, and contains a string the
#                           page actually renders (`Synthetic data only`). A 200 on an error page
#                           or empty shell must not pass, so the assertion is on content, not on
#                           status alone.
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
if [ "$code" = "200" ] \
    && printf '%s' "$html" | grep -q 'All records in this dataset are synthetic' \
    && printf '%s' "$html" | grep -q 'Synthetic data only' \
    && printf '%s' "$html" | grep -q 'SYN-'; then
    ok "GET /arbeitsmarkt is 200 with synthetic statement and rendered content"
else
    bad "GET /arbeitsmarkt did not answer 200 with synthetic statement and rendered content (got $code)"
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
