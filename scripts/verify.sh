#!/usr/bin/env bash
# Proves the landing page RUNS, which scripts/ci.sh cannot.
#
# Builds the app, starts it, waits for the port to accept connections, probes the served HTTP
# surface, and always shuts the server down again — including on failure.
#
# What is asserted lives in scripts/probe.mjs: that `/` answers 200 and names all four demos,
# that `/api/health` answers 200 with `{"ok": true, "service": "gocklkatz"}`, and requirement 4
# of ticket 001 in both directions — every anchor the page publishes resolves to a 200, and a
# card whose status is `in-development` renders no anchor at all.
#
# The rules that must fail are exercised directly by scripts/probe.test.mjs, which runs in
# scripts/ci.sh. A link check that has never been seen to fail is not a link check.
#
# Usage:  bash scripts/verify.sh
# Env:    VERIFY_PORT  override the port (default 43124; 43123 belongs to Ameisenwerkstatt)
#
# The probe fetches the links the page publishes, so it needs outbound network access. Behind an
# HTTP proxy, Node does not read HTTP_PROXY unless told to: run with NODE_USE_ENV_PROXY=1, or the
# published links will be reported unreachable when the fault is the network, not the page.
#
# Written for bash 3.2, which is what macOS ships as /bin/bash.

set -uo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR" || exit 2

PORT="${VERIFY_PORT:-43124}"
HOST="127.0.0.1"
BASE="http://$HOST:$PORT"
READY_TIMEOUT_S="${VERIFY_READY_TIMEOUT_S:-90}"

SERVER_PID=""
CLEANED=0
LEAKED=0
LOG="$(mktemp "${TMPDIR:-/tmp}/gocklkatz-verify.XXXXXX")" || exit 2

say() { printf '%s\n' "$*"; }
step() { printf '\n==> %s\n' "$*"; }
# The four application verify scripts all define this and this one did not, while calling it twice —
# so a full-build run printed `scripts/verify.sh: line 139: ok: command not found` and carried on,
# because `set -uo pipefail` has no `-e`. A step that reports success through a missing function is
# the kind of thing that stops being noticed.
ok() { printf '    ok    %s\n' "$*"; }

dump_log() {
    say "    ---- last 40 lines of the server log ----"
    tail -40 "$LOG" | sed 's/^/    /'
    say "    ----------------------------------------"
}

# Always runs. A verify that leaves a server behind poisons the next run, so the shutdown is
# asserted too: if the port is still bound afterwards, that is a failure of its own.
cleanup() {
    [ "$CLEANED" = "1" ] && return 0
    CLEANED=1

    if [ -n "$SERVER_PID" ]; then
        step "shutting the server down"
        # The server was started under job control, so it has its own process group and the
        # negative pid takes its children with it. `next start` forks a worker.
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

        if node scripts/probe.mjs port-free "$PORT" >/dev/null 2>&1; then
            say "    ok    server stopped, port $PORT released"
        else
            say "    FAIL  port $PORT is still bound after shutdown"
            LEAKED=1
        fi
    fi

    rm -f "$LOG"
    [ "$LEAKED" = "1" ] && exit 1
    return 0
}
trap cleanup EXIT INT TERM

say "verify: gocklkatz landing page"
say "base:   $BASE"

# ---------------------------------------------------------------------------
step "the port is free"
if ! node scripts/probe.mjs port-free "$PORT"; then
    say "    FAIL  something is already listening on $PORT"
    say "          refusing to probe a server this script did not start; set VERIFY_PORT to"
    say "          use another port, or stop whatever holds this one"
    exit 3
fi
say "    ok    nothing is listening on $PORT"

# ---------------------------------------------------------------------------
if [ ! -f node_modules/.package-lock.json ]; then
    step "install dependencies (npm ci)"
    if ! npm ci >>"$LOG" 2>&1; then
        say "    FAIL  npm ci"
        dump_log
        exit 1
    fi
    say "    ok    install dependencies"
fi

# ---------------------------------------------------------------------------
# Reuse the build scripts/ci.sh just made, when it was made for this exact tree.
#
# The repository gate runs ci.sh and then verify.sh for every app, and ci.sh already runs
# `next build`. Building again here doubled the work of a gate run, which is what pushed a cold CI
# runner past the readiness timeout below — five apps meant ten builds and five server starts.
#
# The marker holds the tree hash, so this skips only when the tree it would build is the tree that
# was built. It is consumed here and removed, so a second verify run in the same tree still builds.
BUILD_MARKER=".gate-build-complete"
marker_ok=0
if [ -f "$BUILD_MARKER" ]; then
    want_tree="$(git rev-parse HEAD^{tree} 2>/dev/null || true)"
    have_tree="$(cat "$BUILD_MARKER" 2>/dev/null || true)"
    rm -f "$BUILD_MARKER"
    if [ -n "$want_tree" ] && [ -n "$have_tree" ] && [ "$want_tree" = "$have_tree" ]; then
        marker_ok=1
    fi
fi

if [ "$marker_ok" = "1" ]; then
    step "build (next build) — reusing the build scripts/ci.sh made for this tree"
    ok "build reused"
else
    step "build (next build)"
    if ! npm run --silent build >>"$LOG" 2>&1; then
        say "    FAIL  build"
        dump_log
        exit 1
    fi
    ok "build"
fi

# ---------------------------------------------------------------------------
step "start (next start on $PORT)"
set -m
node_modules/.bin/next start --hostname "$HOST" --port "$PORT" >>"$LOG" 2>&1 &
SERVER_PID=$!
set +m
say "    ok    started (pid $SERVER_PID)"

# ---------------------------------------------------------------------------
step "waiting for $BASE to accept connections"
waited=0
ready=0
while [ "$waited" -lt "$READY_TIMEOUT_S" ]; do
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
        say "    FAIL  the server exited before it accepted a connection"
        dump_log
        exit 1
    fi
    if node scripts/probe.mjs wait "$BASE/" 2000 >/dev/null 2>&1; then
        ready=1
        break
    fi
    waited=$((waited + 2))
done
if [ "$ready" != "1" ]; then
    say "    FAIL  no answer from $BASE within ${READY_TIMEOUT_S}s"
    dump_log
    exit 1
fi
say "    ok    answering after about ${waited}s"

# ---------------------------------------------------------------------------
step "probing the served application"
if ! node scripts/probe.mjs check "$BASE"; then
    say "    FAIL  the served application does not satisfy ticket 001"
    dump_log
    exit 1
fi
say "    ok    routes and card link rules hold"

step "verdict"
say "    VERIFY: PASS"
exit 0
