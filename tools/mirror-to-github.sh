#!/usr/bin/env bash
# Publish this repository to its public GitHub mirror.
#
# Direction is one-way: Origin is where work happens and is the only place that is written to.
# The GitHub repository is a read-only public window. Nothing is ever committed there directly,
# so the public copy cannot drift from the gated copy — and every commit it shows has already
# passed tools/gate.sh and the required CI check on Origin.
#
# Why a script and not a GitHub Actions workflow: this file is mirrored too, so a workflow here
# would also exist in the GitHub repository and would try to mirror GitHub into itself. Running
# from the trusted copy removes that whole class of problem.
#
# Usage:
#   bash tools/mirror-to-github.sh                 # dry run: show what would change
#   bash tools/mirror-to-github.sh --push          # publish
#
# Publishes the branch and its release tags, and nothing else. See the notes on the push below for
# why both are pushed ref by ref rather than with --mirror or --tags.
#
# Configuration (environment):
#   MIRROR_REMOTE     target URL (default: the public GitHub mirror)
#   MIRROR_BRANCH     branch to publish (default: main)
#   MIRROR_TAG_GLOB   release tags to publish (default: v*)

set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

# The public mirror. This value is not an identity and not a secret: it is the address the
# portfolio is published at. Override with MIRROR_REMOTE to publish elsewhere.
MIRROR_REMOTE="${MIRROR_REMOTE:-https://github.com/hermitokatt/gocklkatz.git}"
MIRROR_BRANCH="${MIRROR_BRANCH:-main}"
DO_PUSH=0
[ "${1:-}" = "--push" ] && DO_PUSH=1

# Publishing is only meaningful from a clean, fully pushed local state: mirroring a dirty tree
# would publish something that is not what was gated.
if [ -z "$MIRROR_REMOTE" ]; then
    echo "mirror: MIRROR_REMOTE is not set (export it, or set it in .env)." >&2
    exit 2
fi

if [ -n "$(git status --porcelain)" ]; then
    echo "mirror: working tree is dirty; commit and gate first." >&2
    git status --short >&2
    exit 1
fi

LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git ls-remote "$MIRROR_REMOTE" "refs/heads/$MIRROR_BRANCH" | cut -f1)"

# Release tags travel with the branch, and MIRROR_TAG_GLOB decides which ones. Not `--tags`: that
# would publish every local tag, including anything experimental, and the public copy is meant to
# show the branch and its releases and nothing else.
MIRROR_TAG_GLOB="${MIRROR_TAG_GLOB:-v*}"
REMOTE_TAGS="$(git ls-remote --tags "$MIRROR_REMOTE" 2>/dev/null || true)"

TAGS_TO_PUSH=""
for tag in $(git tag -l "$MIRROR_TAG_GLOB"); do
    local_tag_sha="$(git rev-parse "refs/tags/$tag")"
    remote_tag_sha="$(printf '%s\n' "$REMOTE_TAGS" | awk -v ref="refs/tags/$tag" '$2 == ref { print $1 }')"
    if [ "$local_tag_sha" != "$remote_tag_sha" ]; then
        TAGS_TO_PUSH="$TAGS_TO_PUSH $tag"
    fi
done

echo "mirror: source  Origin $LOCAL_SHA"
echo "mirror: target  $MIRROR_REMOTE ($MIRROR_BRANCH)"
echo "mirror: target currently ${REMOTE_SHA:-<empty>}"
if [ -n "$TAGS_TO_PUSH" ]; then
    echo "mirror: release tags to publish:$TAGS_TO_PUSH"
else
    echo "mirror: release tags: up to date"
fi

if [ "$LOCAL_SHA" = "$REMOTE_SHA" ] && [ -z "$TAGS_TO_PUSH" ]; then
    echo "mirror: already up to date; nothing to do."
    exit 0
fi

if [ "$DO_PUSH" -ne 1 ]; then
    echo
    echo "mirror: dry run. Would publish $LOCAL_SHA -> $MIRROR_REMOTE ($MIRROR_BRANCH)"
    if [ -n "$TAGS_TO_PUSH" ]; then
        echo "mirror:            and release tags:$TAGS_TO_PUSH"
    fi
    echo "mirror: re-run with --push to publish."
    exit 0
fi

# Push the branch explicitly rather than --mirror: --mirror would also publish Origin's internal
# pull-request refs, which are not part of the public history.
if [ "$LOCAL_SHA" != "$REMOTE_SHA" ]; then
    git push "$MIRROR_REMOTE" "$MIRROR_BRANCH:$MIRROR_BRANCH"
fi

# Tags go one ref at a time for the same reason, and never with --force: a published release tag is
# a fixed point, and moving or deleting one would rewrite what a reader may already have fetched.
# Re-cutting a release means a new tag, not an edited one.
for tag in $TAGS_TO_PUSH; do
    git push "$MIRROR_REMOTE" "refs/tags/$tag:refs/tags/$tag"
done

echo
echo "mirror: published. Verify the public copy:"
echo "  git ls-remote $MIRROR_REMOTE"
echo "  gh api repos/<owner>/<repo>/commits --jq '.[0].commit.message'"
