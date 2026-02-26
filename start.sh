#!/bin/bash
# OpenSchichtplaner5 — Startscript
# Startet Backend + Frontend auf http://localhost:8000

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$REPO_DIR/backend"
FRONTEND_DIR="$REPO_DIR/frontend"
DB_PATH="${SP5_DB_PATH:-$REPO_DIR/../sp5_db/Daten}"

echo "🧸 OpenSchichtplaner5"
echo "========================"

# 1. Frontend bauen (falls dist/ fehlt oder veraltet)
if [ ! -f "$FRONTEND_DIR/dist/index.html" ]; then
  echo "📦 Frontend wird gebaut..."
  cd "$FRONTEND_DIR"
  npm install --silent
  npm run build --silent
  echo "✓ Frontend gebaut"
fi

# 2. Backend starten
echo "🚀 Starte Backend auf http://localhost:8000 ..."
cd "$BACKEND_DIR"

SP5_DB_PATH="$DB_PATH" \
  python3 -m uvicorn api.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload

# Browser öffnen (optional, auskommentiert)
# sleep 2 && xdg-open http://localhost:8000 2>/dev/null || open http://localhost:8000 2>/dev/null || true
