# ==============================================================================
# OpenSchichtplaner5 — Makefile
# ==============================================================================
.PHONY: dev dev-link prod docker docker-down update backup test test-e2e lint build clean logs stop help

SHELL := /bin/bash
BACKEND_DIR := backend
FRONTEND_DIR := frontend

# Farben
CYAN  := \033[0;36m
RESET := \033[0m
BOLD  := \033[1m

help: ## Diese Hilfe anzeigen
	@echo -e "$(BOLD)OpenSchichtplaner5 — verfügbare Ziele:$(RESET)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-15s$(RESET) %s\n", $$1, $$2}'

dev: ## Lokaler Start via start.sh
	@bash start.sh

dev-link: ## Library + API aus lokalen Schwester-Clones editierbar installieren
	@test -d ../libopenschichtplaner5 || { echo "✗ ../libopenschichtplaner5 fehlt (git clone https://github.com/mschabhuettl/libopenschichtplaner5.git)"; exit 1; }
	@test -d ../openschichtplaner5-api || { echo "✗ ../openschichtplaner5-api fehlt (git clone https://github.com/mschabhuettl/openschichtplaner5-api.git)"; exit 1; }
	@cd $(BACKEND_DIR) && \
	  { [ -d .venv ] || python3 -m venv .venv; } && \
	  . .venv/bin/activate && \
	  pip install -q -r requirements.txt && \
	  pip install -q -e "../../libopenschichtplaner5[postgres]" -e ../../openschichtplaner5-api && \
	  echo "✓ libopenschichtplaner5 + openschichtplaner5-api editierbar aus ../ installiert — Änderungen dort wirken ohne Reinstall"

docker: ## Docker-Container starten (Produktionsmodus)
	docker compose up --build

docker-down: ## Docker-Container stoppen
	docker compose down

test: ## Frontend-Unit-Tests (vitest; Backend-Tests im API-Repo, E2E: make test-e2e)
	@echo "▶ Backend-Tests laufen im API-Repo (openschichtplaner5-api): dort 'pytest'"
	@echo "▶ Frontend-Unit-Tests (vitest)..."
	@cd $(FRONTEND_DIR) && npx vitest run

test-e2e: ## Frontend-E2E-Tests (playwright; erwartet laufende App auf :5173)
	@cd $(FRONTEND_DIR) && npx playwright test

# mypy entfällt bewusst: dieses Repo enthält keinen eigenen Python-App-Code mehr
# (nur Hilfsskripte + Alembic-Wiring); die typgeprüften Pakete sp5api/sp5lib laufen
# mypy in ihren eigenen Repos. Das frühere Ziel prüfte nur das *installierte*
# sp5api-Paket — doppelt und irreführend.
lint: ## Code-Qualität prüfen (ruff + eslint) — schlägt bei Befunden fehl
	@echo "▶ ruff (Python-Skripte im Repo, wie CI vom Repo-Root)..."
	@RUFF="$(BACKEND_DIR)/.venv/bin/ruff"; \
	  [ -x "$$RUFF" ] || RUFF=ruff; \
	  "$$RUFF" check .
	@echo "▶ eslint (Frontend)..."
	@cd $(FRONTEND_DIR) && npx eslint src/
	@echo "✓ Lint abgeschlossen"

build: ## Frontend-Bundle bauen
	@cd $(FRONTEND_DIR) && npm install && npm run build
	@echo "✓ Frontend gebaut"

clean: ## Build-Artefakte und Cache bereinigen
	@echo "Bereinige..."
	@find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@rm -rf $(FRONTEND_DIR)/dist
	@rm -rf $(FRONTEND_DIR)/node_modules/.cache
	@rm -f /tmp/sp5-backend.pid
	@echo "✓ Bereinigt"

logs: ## Backend-Logs anzeigen (tail -f)
	@LOG_FILE=$$(grep '^LOG_FILE=' $(BACKEND_DIR)/.env 2>/dev/null | cut -d= -f2); \
	  LOG_FILE=$${LOG_FILE:-/tmp/sp5-api.log}; \
	  echo "Zeige $$LOG_FILE"; \
	  tail -f "$$LOG_FILE"

stop: ## Laufendes Backend stoppen
	@bash start.sh --stop

prod: ## Docker-Container im Produktionsmodus starten (detached)
	@echo "▶ Starte OpenSchichtplaner5 im Produktionsmodus..."
	docker compose up -d --build
	@echo "✓ Läuft auf http://localhost:8000"

prod-secure: ## Docker-Container mit expliziter Prod-Compose starten (empfohlen für Server)
	@echo "▶ Starte OpenSchichtplaner5 mit docker-compose.prod.yml..."
	docker compose -f docker-compose.prod.yml up -d --build
	@echo "✓ Läuft auf http://127.0.0.1:8000 (nur localhost — Reverse-Proxy vorschalten!)"

update: ## Git pull + Docker-Neustart (Rolling Update)
	@echo "▶ Aktualisiere OpenSchichtplaner5..."
	git pull --ff-only
	docker compose up -d --build
	@echo "✓ Update abgeschlossen"

backup: ## Backup erstellen (DB- + State-Volumes → lokale Archive)
	@BACKUP_DIR="./backups"; \
	 TIMESTAMP=$$(date +%Y%m%d_%H%M%S); \
	 mkdir -p "$$BACKUP_DIR"; \
	 for VOL in sp5_data sp5_state sp5_api_state; do \
	   FILE="$$BACKUP_DIR/$${VOL}_$$TIMESTAMP.tar.gz"; \
	   echo "▶ Erstelle Backup → $$FILE"; \
	   docker run --rm \
	     -v openschichtplaner5_$$VOL:/data:ro \
	     -v "$$(pwd)/$$BACKUP_DIR":/backup \
	     alpine tar czf "/backup/$${VOL}_$$TIMESTAMP.tar.gz" -C /data . \
	     || echo "  (Volume openschichtplaner5_$$VOL existiert noch nicht — übersprungen)"; \
	 done; \
	 echo "✓ Backups erstellt in $$BACKUP_DIR"
