#!/bin/bash

# Setup script for astro-blog development environment
# Installs dependencies and configures development tools

set -e

echo "📦 Setting up astro-blog development environment..."
echo ""

# Check for required tools
echo "✓ Checking for required tools..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 20 or later."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install npm."
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker Desktop."
    exit 1
fi

echo "✅ All required tools found"
echo "   - Node.js: $(node --version)"
echo "   - npm: $(npm --version)"
echo "   - Docker: $(docker --version)"
echo ""

# Install dependencies
echo "📥 Installing npm dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Verify Docker setup
echo "🐳 Testing Docker setup..."
if docker run hello-world > /dev/null 2>&1; then
    echo "✅ Docker is working"
else
    echo "⚠️  Docker daemon may not be running. Please start Docker Desktop."
fi
echo ""

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Review the README.md for development workflow"
echo "  2. Run 'make help' to see available commands"
echo "  3. Run 'make test' to verify everything works"
echo ""
echo "Happy coding! 🚀"
