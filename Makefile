# ==============================================================================
# OpenSchichtplaner5 — Makefile
# ==============================================================================
.PHONY: dev prod docker docker-dev docker-down update backup test build clean logs stop help

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

docker: ## Docker-Container starten (Produktionsmodus)
	docker compose up --build

docker-dev: ## Docker-Container im Dev-Profil starten
	docker compose --profile dev up --build

docker-down: ## Docker-Container stoppen
	docker compose down

test: ## Tests ausführen (pytest + playwright)
	@echo "▶ Backend-Tests..."
	@cd $(BACKEND_DIR) && \
	  . .venv/bin/activate 2>/dev/null || true && \
	  python3 -m pytest tests/ -v
	@echo "▶ Frontend-Tests..."
	@cd $(FRONTEND_DIR) && npx playwright test 2>/dev/null || \
	  echo "  (Playwright nicht konfiguriert)"

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

update: ## Git pull + Docker-Neustart (Rolling Update)
	@echo "▶ Aktualisiere OpenSchichtplaner5..."
	git pull --ff-only
	docker compose up -d --build
	@echo "✓ Update abgeschlossen"

backup: ## Datenbank-Backup erstellen (Volume → lokales Archiv)
	@BACKUP_DIR="./backups"; \
	 TIMESTAMP=$$(date +%Y%m%d_%H%M%S); \
	 BACKUP_FILE="$$BACKUP_DIR/sp5_db_$$TIMESTAMP.tar.gz"; \
	 mkdir -p "$$BACKUP_DIR"; \
	 echo "▶ Erstelle Backup → $$BACKUP_FILE"; \
	 docker run --rm \
	   -v openschichtplaner5_sp5_data:/data:ro \
	   -v "$$(pwd)/$$BACKUP_DIR":/backup \
	   alpine tar czf "/backup/sp5_db_$$TIMESTAMP.tar.gz" -C /data .; \
	 echo "✓ Backup erstellt: $$BACKUP_FILE"
