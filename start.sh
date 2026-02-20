#!/bin/bash
# OpenSchichtplaner5 - Start script

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export SP5_DB_PATH="${SP5_DB_PATH:-$SCRIPT_DIR/../sp5_db/Daten}"

echo "🦞 OpenSchichtplaner5"
echo "DB: $SP5_DB_PATH"
echo ""

# Start backend
echo "Starting API backend on :8000..."
cd "$SCRIPT_DIR/backend"
~/.local/bin/python3 -m uvicorn api.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

sleep 2

# Start frontend
echo "Starting frontend on :5173..."
cd "$SCRIPT_DIR/frontend"
npm run dev -- --host &
FRONTEND_PID=$!

echo ""
echo "✅ Running!"
echo "   API:      http://localhost:8000"
echo "   Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
