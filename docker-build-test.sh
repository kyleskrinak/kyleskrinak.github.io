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

# Hash all inputs that should invalidate the cache: Dockerfile + lockfiles.
INPUT_HASH=$(cat Dockerfile package.json package-lock.json | md5sum | awk '{print $1}')

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

docker build -t "$IMAGE_NAME" .

if [ $? -eq 0 ]; then
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
