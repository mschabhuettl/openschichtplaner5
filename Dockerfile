# ==============================================================================
# OpenSchichtplaner5 — Multi-Stage-Build
#
#   frontend-build   Node baut frontend/dist
#   backend-build    venv mit openschichtplaner5-api + libopenschichtplaner5
#   frontend-static  (nur für docker-compose.stack.yml) nginx mit der SPA,
#                    proxied /api → Service "api"; via --target frontend-static
#   <final>          Produktions-Image: slim Python-Runtime, non-root,
#                    served SPA + API aus einem Container
#
# Build-Args (Default: PyPI-Pins für reproduzierbare Builds; jedes
# pip-Requirement ist als Override erlaubt, z. B. git+https://…@main):
#   LIB_SOURCE  Default libopenschichtplaner5[postgres]==1.24.0 (PyPI-Pin)
#   API_SOURCE  Default openschichtplaner5-api==1.22.0 (PyPI-Pin)
# ==============================================================================

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Stage 2: Build Backend-venv (git nur hier, nie im Runtime-Image)
FROM python:3.12-slim AS backend-build
RUN apt-get update && apt-get install -y --no-install-recommends git && \
    rm -rf /var/lib/apt/lists/*
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

ARG LIB_SOURCE="libopenschichtplaner5[postgres]==1.24.0"
ARG API_SOURCE="openschichtplaner5-api==1.22.0"

# Library + API aus den Build-Args (statt veraltetem PyPI-Stand); danach die
# restlichen requirements — deren lib/api-Constraints sind bereits erfüllt,
# ruff (reines Lint-Tool) bleibt aus dem Runtime-venv draußen.
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir "${LIB_SOURCE}" "${API_SOURCE}" && \
    grep -v '^ruff' /tmp/requirements.txt | pip install --no-cache-dir -r /dev/stdin

# Stage 3 (optional, nur Stack): nginx served die SPA, /api geht an Service "api"
FROM nginx:1.27-alpine AS frontend-static
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/stack.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
# 127.0.0.1 statt localhost: busybox-wget löst localhost nach ::1 auf,
# nginx lauscht aber nur auf IPv4
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

# Stage 4 (Default-Target): Produktions-Image — SPA + API aus einem Container
FROM python:3.12-slim
WORKDIR /app

# curl for the Docker HEALTHCHECK; gosu for the privilege-drop in the entrypoint
RUN apt-get update && apt-get install -y --no-install-recommends curl gosu && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --gid 1001 sp5 && \
    useradd --uid 1001 --gid sp5 --shell /bin/bash --create-home sp5

COPY --from=backend-build /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY backend/ ./backend/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
# Release-Notes für „Was ist neu?" — die API liest CHANGELOG.md aus
# SP5_BACKEND_DIR/.. (= /app); ohne diese Datei bliebe die Seite leer.
COPY CHANGELOG.md ./CHANGELOG.md

# Mount point für DB — owned by app user. Ebenso der mutable Laufzeit-State
# unter SP5_BACKEND_DIR (data/, api/data + api/uploads + api/*.json,
# backups/ für Auto-Migrate) — die Compose-Dateien mounten dafür Named
# Volumes, die beim ersten Start mit diesen (sp5-owned) Seeds befüllt werden.
RUN mkdir -p /app/data /app/logs /app/sp5_db /app/backend/backups && \
    chown -R sp5:sp5 /app/data /app/logs /app/sp5_db /app/backend/data /app/backend/api /app/backend/backups

VOLUME ["/app/data"]
ENV SP5_DB_PATH=/app/data
# Ressourcen-Root für sp5api + sp5lib (data/, api/data, alembic); frontend dist
# liegt am Default-Ort SP5_BACKEND_DIR/../frontend/dist = /app/frontend/dist
ENV SP5_BACKEND_DIR=/app/backend \
    # Auto-Backups in das beschreibbare State-Volume (sonst /app/data/../backups
    # = /app/backups auf der read-only rootfs).
    SP5_BACKUP_DIR=/app/backend/backups

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Kein festes `USER sp5`: der Container startet als root, damit der Entrypoint die
# Schreibrechte am gemounteten Daten-Verzeichnis angleichen kann, und lässt die App
# danach via gosu als dessen Eigentümer (sonst uid 1001) laufen. `--user` umgeht
# den root-Schritt (dann ist der Aufrufer für die Schreibrechte verantwortlich).

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:8000/api/health || exit 1
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["python", "-m", "uvicorn", "sp5api.main:app", "--host", "0.0.0.0", "--port", "8000"]
