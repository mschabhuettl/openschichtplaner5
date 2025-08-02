#!/bin/bash
# Environment setup script for OpenSchichtplaner5

set -e  # Exit on any error

echo "🚀 Setting up OpenSchichtplaner5 development environment..."
echo "=========================================================="

# Check if Python 3.8+ is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or later."
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
echo "✅ Found Python $PYTHON_VERSION"

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv .venv
else
    echo "✅ Virtual environment already exists"
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source .venv/bin/activate

# Upgrade pip
echo "⬆️  Upgrading pip..."
pip install --upgrade pip

# Install requirements
if [ -f "requirements.txt" ]; then
    echo "📋 Installing dependencies from requirements.txt..."
    pip install -r requirements.txt
else
    echo "❌ requirements.txt not found!"
    exit 1
fi

# Initialize submodules if needed
if [ -f ".gitmodules" ]; then
    echo "🔄 Initializing git submodules..."
    git submodule update --init --recursive
fi

echo ""
echo "✅ Environment setup complete!"
echo ""
echo "🎯 Next steps:"
echo "  1. Activate the environment: source .venv/bin/activate"
echo "  2. Test installation: python test_installation.py"
echo "  3. Start web server: ./start_webserver.sh"
echo "  4. Open http://localhost:8080 in your browser"
echo ""
echo "💡 Tip: Run './start_webserver.sh' to start the application"