.PHONY: build docker-test local-test test push clean help

help:
	@echo "Available commands:"
	@echo "  make local-test      - Build locally with npm (quick feedback)"
	@echo "  make docker-test     - Build in Docker (matches GitHub Actions environment)"
	@echo "  make test            - Run both local and Docker tests"
	@echo "  make push            - Test both then push to GitHub"
	@echo "  make clean           - Remove Docker image"
	@echo ""
	@echo "Quick start:"
	@echo "  make test            - Verify everything works"
	@echo "  make push            - Deploy with full testing"

local-test:
	@echo "🏗️  Running local build test..."
	npm run build:ci

docker-test:
	@echo "🐳 Running Docker build test..."
	./docker-build-test.sh

test: local-test docker-test
	@echo ""
	@echo "✅ All tests passed!"

push: test
	@echo ""
	@echo "📤 Pushing to GitHub..."
	git push origin staging

clean:
	@echo "🧹 Cleaning up Docker image..."
	docker rmi astro-blog:test 2>/dev/null || true
	@echo "✅ Cleanup complete"
