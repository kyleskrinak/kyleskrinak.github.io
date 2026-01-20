#!/bin/bash

# Visual Regression Testing Helper
#
# Usage:
#   ./scripts/visual-test.sh local              # Test local dev
#   ./scripts/visual-test.sh staging            # Test staging
#   ./scripts/visual-test.sh production         # Test production
#   ./scripts/visual-test.sh baseline           # Create/update baselines from local

set -e

ENVIRONMENT=${1:-local}

case $ENVIRONMENT in
  local)
    echo "🧪 Running visual tests against LOCAL (http://localhost:4321)"
    npx playwright test --config=playwright.config.ts
    ;;

  staging)
    echo "🧪 Running visual tests against STAGING (GitHub Pages)"
    PLAYWRIGHT_TEST_BASE_URL="https://kyleskrinak.github.io/astro-blog" npx playwright test --config=playwright.config.ts
    ;;

  production)
    echo "🧪 Running visual tests against PRODUCTION (kyle.skrinak.com)"
    PLAYWRIGHT_TEST_BASE_URL="https://kyle.skrinak.com" npx playwright test --config=playwright.config.ts
    ;;

  baseline)
    echo "📸 Creating/updating baselines from LOCAL dev"
    npx playwright test --config=playwright.config.ts --update-snapshots
    echo "✓ Baselines updated in tests/visual/__screenshots__/"
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
    echo "  ./scripts/visual-test.sh compare            # View HTML report"
    exit 1
    ;;
esac
