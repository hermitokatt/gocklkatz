#!/usr/bin/env bash
# Run one Cursor worker pass against a frozen ticket, with a stall watchdog.
#
# Generalized from jobberNG/tools/agent-run.sh after two observed hangs (2026-09-11): one after
# the agent had committed everything, one mid-edit. The lesson recorded there is that a stall is
# idle CPU **and no progress** — requiring a clean tree is the wrong test, because an agent can
# hang with work uncommitted on disk just as easily.
#
# This repository's workers do not commit (AGENTS.md §1), so progress cannot be measured by HEAD
# moving. It is measured by a fingerprint of the working tree: dirty path count plus the diff
# stat. A commitless worker is therefore still bounded.
#
# Usage:
#   tools/worker-run.sh <prompt-file> [repo-root]
#
# Environment:
#   WORKER_MODEL      model id (default: composer-2.5). See `cursor-agent models`. Anthropic
#                     models are refused unless WORKER_ALLOW_ANTHROPIC=1.
#   WORKER_STALL_TICKS  idle ticks before kill; 1 tick = 30s (default: 10 = 5 minutes)
#   WORKER_ALLOW_ANTHROPIC  set to 1 to permit an Anthropic model (refused by default)
#   WORKER_SANDBOX    enabled|disabled (default: enabled)
#
# Logs: var/agent-logs/<timestamp>.log  (tee'd; read non-blockingly)

set -uo pipefail

PROMPT_FILE="${1:?usage: worker-run.sh <prompt-file> [repo-root]}"
REPO="${2:-$(cd "$(dirname "$0")/.." && pwd)}"
MODEL="${WORKER_MODEL:-composer-2.5}"
STALL_TICKS="${WORKER_STALL_TICKS:-10}"
SANDBOX="${WORKER_SANDBOX:-enabled}"

cd "$REPO" || exit 1
mkdir -p var/agent-logs
LOG="var/agent-logs/$(date +%Y%m%dT%H%M%S).log"

# The worker runs under a personal Cursor account, and this machine's GLOBAL git identity is a
# personal one. Workers do not commit (AGENTS.md section 1), but a worker that runs `git commit`
# anyway must not be able to capture the personal identity. Environment variables override git
# config, so the company identity wins even if the worker ignores the brief.
export GIT_AUTHOR_NAME="Hermito Katt"    GIT_AUTHOR_EMAIL="gocklkatz@gmail.com"
export GIT_COMMITTER_NAME="Hermito Katt" GIT_COMMITTER_EMAIL="gocklkatz@gmail.com"

PROMPT="$(cat "$PROMPT_FILE")"

# Identify the model id before spending on a run: an unknown model fails fast and cheap.
if ! cursor-agent models 2>/dev/null | grep -q "^${MODEL} - "; then
    echo "worker-run: model '${MODEL}' is not in \`cursor-agent models\`. Aborting." >&2
    exit 2
fi

# Anthropic models are refused by default. They are the most expensive option available, Cursor's
# own `auto` resolves to one, and a run that names a model explicitly is easy to forget about —
# this harness spent three tickets on claude-opus-5-thinking-high before anyone noticed. Set
# WORKER_ALLOW_ANTHROPIC=1 to override deliberately.
case "$MODEL" in
    claude-*|*opus*|*sonnet*|*fable*)
        if [ "${WORKER_ALLOW_ANTHROPIC:-0}" != "1" ]; then
            echo "worker-run: refusing Anthropic model '$MODEL'." >&2
            echo "worker-run:   the default is non-Anthropic; pick another, or set WORKER_ALLOW_ANTHROPIC=1." >&2
            exit 2
        fi
        echo "worker-run: WARNING — running '$MODEL', an Anthropic model (WORKER_ALLOW_ANTHROPIC=1)." >&2
        ;;
esac

fingerprint() {
    # dirty path count + diff stat; changes when the worker writes a file, even without a commit
    printf '%s|%s' \
        "$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')" \
        "$(git diff --stat 2>/dev/null | tail -1 | tr -d ' ')"
}

before="$(fingerprint)"

# --skip-worktree-setup: a .cursor/worktrees.json setup script would execute arbitrary project
# commands at worktree creation. Nothing in this repository needs that.
cursor-agent -p --trust \
    --sandbox "$SANDBOX" \
    --model "$MODEL" \
    --workspace "$REPO" \
    --output-format text \
    --skip-worktree-setup \
    "$PROMPT" >"$LOG" 2>&1 &
pid=$!

ticks=0
last="$before"
while kill -0 "$pid" 2>/dev/null; do
    sleep 30
    cpu="$(ps -p "$pid" -o %cpu= 2>/dev/null | tr -d ' ' | cut -d. -f1)"
    now="$(fingerprint)"

    if [ "$now" != "$last" ] || [ "${cpu:-1}" != "0" ]; then
        ticks=0
        last="$now"
    else
        ticks=$((ticks + 1))
    fi

    if [ "$ticks" -ge "$STALL_TICKS" ]; then
        {
            echo "watchdog: no progress and 0% CPU for $((STALL_TICKS * 30))s."
            echo "watchdog: before [$before]"
            echo "watchdog: now    [$now]"
            echo "watchdog: work already on disk is preserved. stopping pid $pid."
        } >>"$LOG"
        kill "$pid" 2>/dev/null
        break
    fi
done

wait "$pid" 2>/dev/null
rc=$?

{
    echo "---- worker-run summary ----"
    echo "model:   $MODEL"
    echo "exit:    $rc (143/137 = stopped by watchdog)"
    echo "before:  $before"
    echo "after:   $(fingerprint)"
    echo "--- changed paths ---"
    git status --porcelain | sed 's/^/    /'
} >>"$LOG"

# The worker transcript and anything it wrote must not carry personal identifiers. Logs stay in
# gitignored var/, but a worker can write anywhere and can read the CLI's own config, so check
# the log too rather than assuming it is clean.
PATTERN="$(grep -vE '^[[:space:]]*(#|$)' tools/pii-patterns.txt | paste -sd'|' -)"
guard_state="clean"
tools/guard.sh >/dev/null 2>&1 || guard_state="FINDINGS — run tools/guard.sh"
log_state="clean"
grep -qEi "$PATTERN" "$LOG" 2>/dev/null && log_state="FINDINGS in this log"

{
    echo "--- personal-identifier check ---"
    echo "tracked tree: $guard_state"
    echo "worker log:   $log_state"
} >>"$LOG"

# Print the summary only. The full log stays on disk so progress can be read non-blockingly.
tail -28 "$LOG"
