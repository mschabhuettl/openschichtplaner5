#!/usr/bin/env bash
# ==============================================================================
# OpenSchichtplaner5 — Startscript
# Startet Backend + Frontend auf http://localhost:8000
# ==============================================================================
set -euo pipefail

# ------------------------------------------------------------------------------
# ANSI-Farben
# ------------------------------------------------------------------------------
if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; CYAN=''; BOLD=''; RESET=''
fi

info()    { echo -e "${CYAN}ℹ${RESET}  $*"; }
success() { echo -e "${GREEN}✓${RESET}  $*"; }
warn()    { echo -e "${YELLOW}⚠${RESET}  $*"; }
error()   { echo -e "${RED}✗${RESET}  $*" >&2; }
header()  { echo -e "\n${BOLD}${BLUE}$*${RESET}"; }

# ------------------------------------------------------------------------------
# Pfade
# ------------------------------------------------------------------------------
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$REPO_DIR/backend"
FRONTEND_DIR="$REPO_DIR/frontend"
# .env im Root-Verzeichnis (neben start.sh) — wird auch von Docker genutzt
ENV_FILE="$REPO_DIR/.env"
ENV_EXAMPLE="$REPO_DIR/.env.example"
VENV_DIR="$BACKEND_DIR/.venv"
REQUIREMENTS="$BACKEND_DIR/requirements.txt"
PID_FILE="/tmp/sp5-backend.pid"

# ------------------------------------------------------------------------------
# Hilfe
# ------------------------------------------------------------------------------
usage() {
  cat <<EOF
${BOLD}OpenSchichtplaner5 — Startscript${RESET}

Verwendung:
  $0 [OPTIONEN]

Optionen:
  --help        Diese Hilfe anzeigen
  --no-browser  Browser nach dem Start NICHT öffnen
  --build       Frontend immer neu bauen (auch wenn aktuell)
  --stop        Laufendes Backend stoppen (via PID-Datei)

Beispiel:
  $0                  # Normaler Start
  $0 --no-browser     # Ohne automatischen Browser-Open
  $0 --build          # Mit erzwungenem Frontend-Rebuild
EOF
  exit 0
}

# ------------------------------------------------------------------------------
# Argumente parsen
# ------------------------------------------------------------------------------
OPEN_BROWSER=true
FORCE_BUILD=false
STOP_MODE=false

for arg in "$@"; do
  case "$arg" in
    --help)       usage ;;
    --no-browser) OPEN_BROWSER=false ;;
    --build)      FORCE_BUILD=true ;;
    --stop)       STOP_MODE=true ;;
    *)            warn "Unbekannte Option: $arg"; usage ;;
  esac
done

# ------------------------------------------------------------------------------
# Stop-Modus
# ------------------------------------------------------------------------------
if $STOP_MODE; then
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
      kill "$PID"
      rm -f "$PID_FILE"
      success "Backend (PID $PID) gestoppt."
    else
      warn "PID $PID läuft nicht mehr."
      rm -f "$PID_FILE"
    fi
  else
    warn "Keine PID-Datei gefunden — Backend läuft möglicherweise nicht."
  fi
  exit 0
fi

# ------------------------------------------------------------------------------
# Trap — sauberes Beenden
# ------------------------------------------------------------------------------
cleanup() {
  echo ""
  warn "Unterbrochen — fahre herunter..."
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    kill "$PID" 2>/dev/null || true
    rm -f "$PID_FILE"
  fi
  exit 0
}
trap cleanup INT TERM

# ------------------------------------------------------------------------------
# Header
# ------------------------------------------------------------------------------
echo -e "${BOLD}${BLUE}"
echo "  ╔═══════════════════════════════════╗"
echo "  ║      OpenSchichtplaner5 🧩         ║"
echo "  ╚═══════════════════════════════════╝"
echo -e "${RESET}"

# ------------------------------------------------------------------------------
# 1. Abhängigkeiten prüfen
# ------------------------------------------------------------------------------
header "1/5  Abhängigkeiten prüfen"

check_dep() {
  if command -v "$1" &>/dev/null; then
    success "$1 gefunden ($(command -v "$1"))"
  else
    error "$1 nicht gefunden — bitte installieren!"
    exit 1
  fi
}

check_dep python3
check_dep pip3 2>/dev/null || check_dep pip
check_dep node
check_dep npm

# ------------------------------------------------------------------------------
# 2. .env-Datei anlegen / SECRET_KEY generieren
# ------------------------------------------------------------------------------
header "2/5  Konfiguration"

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$ENV_EXAMPLE" ]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    success ".env aus .env.example erstellt"
  else
    error ".env.example nicht gefunden — Abbruch."
    exit 1
  fi
else
  info ".env bereits vorhanden"
fi

# SECRET_KEY automatisch generieren wenn noch Platzhalter
if grep -q "^SECRET_KEY=change-me" "$ENV_FILE"; then
  NEW_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
  # Plattformunabhängig (macOS + Linux)
  sed -i.bak "s|^SECRET_KEY=.*|SECRET_KEY=$NEW_KEY|" "$ENV_FILE" && rm -f "${ENV_FILE}.bak"
  success "SECRET_KEY automatisch generiert und in .env gespeichert"
fi

# ENV-Variablen laden
# shellcheck source=/dev/null
set -a
source "$ENV_FILE"
set +a

# Defaults setzen falls in .env nicht gesetzt
PORT="${PORT:-8000}"
HOST="${HOST:-0.0.0.0}"
DEBUG="${DEBUG:-false}"
SP5_DB_PATH="${SP5_DB_PATH:-$REPO_DIR/../sp5_db/Daten}"

info "Port:  $PORT"
info "Host:  $HOST"
info "Debug: $DEBUG"
info "DB:    $SP5_DB_PATH"

# ------------------------------------------------------------------------------
# 3. Python venv erstellen / aktivieren
# ------------------------------------------------------------------------------
header "3/5  Python-Umgebung"

if [ ! -d "$VENV_DIR" ]; then
  info "Erstelle virtuelle Umgebung in $VENV_DIR ..."
  python3 -m venv "$VENV_DIR"
  success "venv erstellt"
fi

# shellcheck source=/dev/null
source "$VENV_DIR/bin/activate"
success "venv aktiviert"

# requirements.txt installieren wenn nötig oder veraltet
if [ -f "$REQUIREMENTS" ]; then
  NEEDS_INSTALL=false
  if [ ! -f "$VENV_DIR/.requirements_installed" ]; then
    NEEDS_INSTALL=true
  elif [ "$REQUIREMENTS" -nt "$VENV_DIR/.requirements_installed" ]; then
    NEEDS_INSTALL=true
    info "requirements.txt hat sich geändert — reinstalliere..."
  fi

  if $NEEDS_INSTALL; then
    info "Installiere Python-Abhängigkeiten..."
    pip install -q -r "$REQUIREMENTS"
    touch "$VENV_DIR/.requirements_installed"
    success "Abhängigkeiten installiert"
  else
    info "Python-Abhängigkeiten aktuell"
  fi
fi

# ------------------------------------------------------------------------------
# 4. Frontend bauen
# ------------------------------------------------------------------------------
header "4/5  Frontend"

FRONTEND_DIST="$FRONTEND_DIR/dist/index.html"
NEEDS_BUILD=false

if $FORCE_BUILD; then
  NEEDS_BUILD=true
  info "Frontend-Rebuild erzwungen (--build)"
elif [ ! -f "$FRONTEND_DIST" ]; then
  NEEDS_BUILD=true
  info "Frontend dist/ nicht vorhanden — wird gebaut"
else
  # Prüfen ob Quelldateien neuer als dist/ sind
  LATEST_SRC=$(find "$FRONTEND_DIR/src" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.vue" -o -name "*.js" -o -name "*.css" \) -newer "$FRONTEND_DIST" 2>/dev/null | head -1)
  if [ -n "$LATEST_SRC" ]; then
    NEEDS_BUILD=true
    info "Quelldateien geändert — Frontend wird neu gebaut"
  fi
fi

if $NEEDS_BUILD; then
  cd "$FRONTEND_DIR"
  info "Installiere npm-Abhängigkeiten..."
  npm install --silent
  info "Baue Frontend..."
  npm run build --silent
  success "Frontend gebaut → $FRONTEND_DIST"
  cd "$REPO_DIR"
else
  success "Frontend ist aktuell"
fi

# ------------------------------------------------------------------------------
# 5. Backend starten
# ------------------------------------------------------------------------------
header "5/5  Backend starten"

cd "$BACKEND_DIR"

UVICORN_ARGS=(
  "--host" "$HOST"
  "--port" "$PORT"
)

# --reload nur im Debug-Modus
if [ "$DEBUG" = "true" ] || [ "$DEBUG" = "1" ]; then
  UVICORN_ARGS+=("--reload")
  warn "Debug-Modus aktiv — Auto-Reload aktiviert"
fi

echo ""
echo -e "${GREEN}${BOLD}🚀 OpenSchichtplaner5 startet...${RESET}"
echo -e "   URL: ${CYAN}http://localhost:${PORT}${RESET}"
echo -e "   Stoppen: ${YELLOW}Strg+C${RESET}"
echo ""

# Browser öffnen (nach kurzem Delay im Hintergrund)
if $OPEN_BROWSER; then
  (
    sleep 3
    URL="http://localhost:${PORT}"
    if command -v xdg-open &>/dev/null; then
      xdg-open "$URL" 2>/dev/null
    elif command -v open &>/dev/null; then
      open "$URL" 2>/dev/null
    fi
  ) &
fi

# Backend starten (PID speichern für cleanup)
python3 -m uvicorn api.main:app "${UVICORN_ARGS[@]}" &
BACKEND_PID=$!
echo $BACKEND_PID > "$PID_FILE"

# Auf Backend warten (damit trap greift)
wait $BACKEND_PID
