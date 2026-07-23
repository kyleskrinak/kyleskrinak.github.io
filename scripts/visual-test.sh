#!/bin/bash

# Visual Regression Testing Helper
#
# Usage:
#   ./scripts/visual-test.sh local              # Test local dev
#   ./scripts/visual-test.sh staging            # Test staging
#   ./scripts/visual-test.sh production         # Test production
#   ./scripts/visual-test.sh baseline           # Create/update baselines from local
#   ./scripts/visual-test.sh docker             # Test against a container matching CI's OS/fonts
#   ./scripts/visual-test.sh docker-baseline    # Create/update baselines from that container
#
# Why docker/docker-baseline: pr-visual-check.yml runs on ubuntu-latest, whose font
# stack renders slightly taller than macOS. Baselines committed from a bare `npm run
# test:visual:baseline` on macOS will consistently fail CI's height comparison even
# with no real visual change. These modes run the same test through the official
# Playwright Docker image (matched to the installed @playwright/test version, on the
# Ubuntu codename CI currently uses) so committed baselines are pixel-consistent with CI.

set -e

ENVIRONMENT=${1:-local}

# Ubuntu codename backing GitHub's `ubuntu-latest` runner (see .github/workflows/pr-visual-check.yml).
# Update this if CI's runs-on target changes (e.g. a future ubuntu-latest bump).
DOCKER_UBUNTU_CODENAME="noble"

run_in_docker() {
  local update_flag="$1"

  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is not installed. Install Docker Desktop and retry." >&2
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    echo "Docker is not running. Start Docker and retry." >&2
    exit 1
  fi

  local playwright_version
  playwright_version=$(node -p "require('./node_modules/@playwright/test/package.json').version" 2>/dev/null) || {
    echo "Could not read @playwright/test version from node_modules. Run 'npm ci' first." >&2
    exit 1
  }

  local image="mcr.microsoft.com/playwright:v${playwright_version}-${DOCKER_UBUNTU_CODENAME}"
  echo "🐳 Running visual tests in Docker (${image}) — fonts/rendering match the CI runner"

  # -v /app/node_modules shadows the bind-mounted host node_modules with a container-only
  # volume, so `npm ci` installs Linux-native binaries (e.g. sharp) without touching the
  # host's macOS node_modules. CI=true mirrors playwright.config.ts's CI branch (workers=1,
  # retries=2, list reporter) for output parity with the actual gate.
  docker run --rm \
    -v "$(pwd)":/app \
    -v /app/node_modules \
    -w /app \
    -e CI=true \
    "$image" \
    bash -c "npm ci && npm run test:visual${update_flag}"
}

case $ENVIRONMENT in
  local)
    echo "🧪 Running visual tests against LOCAL (http://localhost:4321)"
    npm run test:visual
    ;;

  staging)
    echo "🧪 Running visual tests against STAGING (GitHub Pages)"
    PLAYWRIGHT_TEST_BASE_URL="https://kyleskrinak.github.io" npm run test:visual
    ;;

  production)
    echo "🧪 Running visual tests against PRODUCTION (kyle.skrinak.com)"
    PLAYWRIGHT_TEST_BASE_URL="https://kyle.skrinak.com" npm run test:visual
    ;;

  baseline)
    echo "📸 Creating/updating baselines from LOCAL dev"
    npm run test:visual -- --update-snapshots
    echo "✓ Baselines updated in tests/visual/visual-regression.spec.ts-snapshots/"
    ;;

  docker)
    run_in_docker ""
    ;;

  docker-baseline)
    echo "📸 Creating/updating baselines via Docker (Ubuntu, matches CI)"
    run_in_docker " -- --update-snapshots"
    echo "✓ Baselines updated in tests/visual/visual-regression.spec.ts-snapshots/ (Ubuntu-rendered)"
    ;;

  compare)
    echo "📊 Opening HTML report of last test run"
    npx playwright show-report
    ;;

  *)
    echo "Unknown environment: $ENVIRONMENT"
    echo ""
    echo "Usage:"
    echo "  ./scripts/visual-test.sh local              # Test local dev"
    echo "  ./scripts/visual-test.sh staging            # Test staging (GitHub Pages)"
    echo "  ./scripts/visual-test.sh production         # Test production (kyle.skrinak.com)"
    echo "  ./scripts/visual-test.sh baseline           # Create/update baselines"
    echo "  ./scripts/visual-test.sh docker             # Test in a container matching CI's OS/fonts"
    echo "  ./scripts/visual-test.sh docker-baseline    # Create/update baselines from that container"
    echo "  ./scripts/visual-test.sh compare            # View HTML report"
    exit 1
    ;;
esac
