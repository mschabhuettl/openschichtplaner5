#!/bin/bash
# Start script for OpenSchichtplaner5 Web Server

# Configuration
DBF_DIR="/path/to/dbf"
HOST="0.0.0.0"
PORT="8080"
WORKERS="1"

# Kill any existing OpenSchichtplaner5 processes
echo "🔧 Stopping existing OpenSchichtplaner5 processes..."
pkill -f "openschichtplaner5_webserver/main.py" 2>/dev/null || true
pkill -f "main.py.*--port.*$PORT" 2>/dev/null || true

# Wait a moment for processes to shut down
sleep 2

# Check if port is still in use and kill forcefully if needed
if lsof -ti:$PORT >/dev/null 2>&1; then
    echo "⚠️  Port $PORT still in use, killing processes forcefully..."
    lsof -ti:$PORT | xargs -r kill -9 2>/dev/null || true
    sleep 1
fi

# Change to webserver directory
cd "$(dirname "$0")/openschichtplaner5-webserver"

# Activate virtual environment if it exists
if [ -f "../.venv/bin/activate" ]; then
    source "../.venv/bin/activate"
    echo "Virtual environment activated"
fi

echo "Starting OpenSchichtplaner5 Web Server..."
echo "DBF Directory: $DBF_DIR"
echo ""
echo "🌐 Frontend Dashboard: http://localhost:$PORT"
echo "📊 Advanced Analytics: http://localhost:$PORT (Analytics Tab)"
echo "🔄 Fallback Simple UI: http://localhost:$PORT/simple"
echo "📚 API Documentation: http://localhost:$PORT/api/docs"
echo "🔧 API Endpoints: http://localhost:$PORT/api"
echo "❤️  Health Check: http://localhost:$PORT/health"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

python src/openschichtplaner5_webserver/main.py \
    --dir "$DBF_DIR" \
    --host "$HOST" \
    --port "$PORT" \
    --workers "$WORKERS"