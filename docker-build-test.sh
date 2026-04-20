#!/bin/bash

# Docker build test script for astro-blog
# Builds the project in a Docker container matching GitHub Actions environment
# Run this before pushing to verify the build works in CI

set -e

IMAGE_NAME="astro-blog:test"
CACHE_FILE=".docker-cache"
# Grace period (in days) to trust the last green build when the local image
# has been GC'd but build inputs are unchanged. Override with DOCKER_CACHE_TTL_DAYS.
GRACE_DAYS="${DOCKER_CACHE_TTL_DAYS:-7}"

# Hash build inputs: in a git worktree, hash tracked + untracked non-ignored
# files so source/content changes invalidate the cache. Tracked and untracked
# sets are disjoint, and $CACHE_FILE is gitignored so it won't appear in either.
# Outside git, fall back to manifests (e.g., fresh tarball extract).
compute_input_hash() {
    if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        sha256sum Dockerfile package.json package-lock.json | sha256sum | awk '{print $1}'
        return
    fi
    {
        git ls-files -z
        git ls-files -z --others --exclude-standard
    } | xargs -0 sha256sum 2>/dev/null | sha256sum | awk '{print $1}'
}
INPUT_HASH=$(compute_input_hash)

echo "🐳 Docker build test"
echo "===================="

# Check if we need to rebuild
if [ -f "$CACHE_FILE" ]; then
    LAST_HASH=$(awk -F: 'NR==1 {print $1}' "$CACHE_FILE")
    LAST_TS=$(awk -F: 'NR==1 {print $2}' "$CACHE_FILE")
    if [ "$INPUT_HASH" = "$LAST_HASH" ]; then
        if docker image inspect "$IMAGE_NAME" &>/dev/null; then
            echo "✅ Build already cached (use 'make clean' to rebuild)"
            exit 0
        fi
        # Image is gone but inputs unchanged — honor grace period.
        case "$LAST_TS" in
            (*[!0-9]*|'') LAST_TS="" ;;
        esac
        NOW=$(date +%s)
        if [ -n "$LAST_TS" ] && [ "$LAST_TS" -le "$NOW" ]; then
            AGE_DAYS=$(( (NOW - LAST_TS) / 86400 ))
            if [ "$AGE_DAYS" -lt "$GRACE_DAYS" ]; then
                echo "✅ Inputs unchanged; last green build was ${AGE_DAYS}d ago (grace period: ${GRACE_DAYS}d). Skipping rebuild."
                exit 0
            fi
        fi
    fi
fi

echo "📦 Building Docker image..."
echo ""

if docker build -t "$IMAGE_NAME" .; then
    echo "${INPUT_HASH}:$(date +%s)" > "$CACHE_FILE"
    echo ""
    echo "✅ Docker build successful!"
    echo ""
    echo "Next steps:"
    echo "  - Push:  git push origin staging"
    echo "  - Clean: docker rmi $IMAGE_NAME"
else
    echo ""
    echo "❌ Docker build failed!"
    exit 1
fi
