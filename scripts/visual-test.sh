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
