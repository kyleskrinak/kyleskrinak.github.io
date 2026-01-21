#!/bin/bash

# Docker build test script for astro-blog
# Builds the project in a Docker container matching GitHub Actions environment
# Run this before pushing to verify the build works in CI

set -e

IMAGE_NAME="astro-blog:test"
DOCKERFILE_HASH=$(md5sum Dockerfile | awk '{print $1}')
CACHE_FILE=".docker-cache"

echo "🐳 Docker build test"
echo "===================="

# Check if we need to rebuild
if [ -f "$CACHE_FILE" ]; then
    LAST_HASH=$(cat "$CACHE_FILE")
    if [ "$DOCKERFILE_HASH" = "$LAST_HASH" ]; then
        if docker image inspect "$IMAGE_NAME" &>/dev/null; then
            echo "✅ Build already cached (use 'make clean' to rebuild)"
            exit 0
        fi
    fi
fi

echo "📦 Building Docker image..."
echo ""

docker build -t "$IMAGE_NAME" .

if [ $? -eq 0 ]; then
    echo "$DOCKERFILE_HASH" > "$CACHE_FILE"
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
