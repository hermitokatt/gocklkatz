#!/usr/bin/env bash
# Proves Ameisenwerkstatt RUNS, which scripts/ci.sh cannot.
#
# Builds the app, starts it, waits for the port to accept connections, probes the served HTTP
# surface, and always shuts the server down again — including on failure. Asserting on the port
# being released afterwards is deliberate: a verify that leaves a server behind poisons the next
# run, and the next run would then be probing somebody else's process.
#
# What it asserts, and why each one is here:
#
#   /                       200, and names the app
#   /ameisen                200, and contains text the page actually renders. A 200 on an error
#                           page must not pass, so the assertion is on content, not on status.
#   /api/health             200, JSON, `{"ok":true,"service":"demo-shell"}`
#   /api/ameisen/snapshot   200, JSON
#   the mutate routes       403 with `mutate_forbidden` when no secret is configured. The write
#                           routes fail closed by design, and that is a property worth checking
#                           rather than assuming: a missing secret must never mean "allowed".
#
# Usage:  bash scripts/verify.sh
# Env:    VERIFY_PORT  override the port (default 43123; the landing page holds 43124)
#
# Written for bash 3.2, which is what macOS ships as /bin/bash.

set -uo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR" || exit 2

PORT="${VERIFY_PORT:-43123}"
HOST="127.0.0.1"
BASE="http://$HOST:$PORT"
READY_TIMEOUT_S="${VERIFY_READY_TIMEOUT_S:-90}"

SERVER_PID=""
CLEANED=0
LEAKED=0
FAILED=0
LOG="$(mktemp "${TMPDIR:-/tmp}/ameisen-verify.XXXXXX")" || exit 2
TRACE="${TRACE:-}"

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

say "verify: Ameisenwerkstatt"
say "base:   $BASE"

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
    if curl -fsS -o /dev/null -m 2 "$BASE/api/health" 2>/dev/null; then
        ready=1
        break
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
if [ "$code" = "200" ] && printf '%s' "$html" | grep -q 'Ameisenfabrik'; then
    ok "GET / is 200 and names the app"
else
    bad "GET / did not answer 200 with the app's name (got $code)"
fi

# /ameisen — the Werkstatt, asserted on content rather than status
body="$(curl -sS -m 10 -w '\n%{http_code}' "$BASE/ameisen" 2>/dev/null)"
code="$(printf '%s' "$body" | tail -1)"
html="$(printf '%s' "$body" | sed '$d')"
say "route GET /ameisen                $code"
if [ "$code" = "200" ] && printf '%s' "$html" | grep -q 'Werkstatt'; then
    ok "GET /ameisen is 200 and renders the Werkstatt"
else
    bad "GET /ameisen did not answer 200 with rendered Werkstatt content (got $code)"
fi

# /api/health — asserted on the parsed body, not the status alone
body="$(curl -sS -m 10 "$BASE/api/health" 2>/dev/null)"
say "route GET /api/health             $(printf '%s' "$body" | head -c 60)"
if printf '%s' "$body" | grep -q '"ok":true' && printf '%s' "$body" | grep -q '"service":"demo-shell"'; then
    ok "GET /api/health returns ok and the expected service"
else
    bad "GET /api/health body was not the expected JSON: $body"
fi

# /api/ameisen/snapshot — read-only
code="$(curl -sS -m 10 -o /dev/null -w '%{http_code}' "$BASE/api/ameisen/snapshot" 2>/dev/null)"
say "route GET /api/ameisen/snapshot   $code"
if [ "$code" = "200" ]; then
    ok "GET /api/ameisen/snapshot is 200"
else
    bad "GET /api/ameisen/snapshot answered $code, expected 200"
fi

# the mutate routes must fail closed with no secret configured
for route in params step tools; do
    code="$(curl -sS -m 10 -o /tmp/ameisen-mutate-body -w '%{http_code}' \
        -X POST -H 'content-type: application/json' -d '{}' \
        "$BASE/api/ameisen/$route" 2>/dev/null)"
    said="$(cat /tmp/ameisen-mutate-body 2>/dev/null)"
    say "route POST /api/ameisen/$route$(printf '%*s' $((8 - ${#route})) '') $code"
    if [ "$code" = "403" ] && printf '%s' "$said" | grep -q 'mutate_forbidden'; then
        ok "POST /api/ameisen/$route fails closed with no secret"
    else
        bad "POST /api/ameisen/$route answered $code — expected 403 mutate_forbidden"
    fi
done
rm -f /tmp/ameisen-mutate-body

# ---------------------------------------------------------------------------
step "verdict"
if [ "$FAILED" -ne 0 ]; then
    say "    VERIFY: FAIL"
    dump_log
    exit 1
fi
say "    VERIFY: PASS"
exit 0
