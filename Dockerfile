# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Stage 2: Production image
FROM python:3.11-slim
WORKDIR /app

# curl for the Docker HEALTHCHECK; git is needed at build time to install the
# libopenschichtplaner5 dependency from its git+https URL (removed again afterwards
# to keep the image small).
RUN apt-get update && apt-get install -y --no-install-recommends curl git && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --gid 1001 sp5 && \
    useradd --uid 1001 --gid sp5 --shell /bin/bash --create-home sp5

COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt && \
    apt-get purge -y git && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

COPY backend/ ./backend/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Mount point für DB — owned by app user
RUN mkdir -p /app/data /app/logs && chown -R sp5:sp5 /app/data /app/logs

VOLUME ["/app/data"]
ENV SP5_DB_PATH=/app/data

# Drop to non-root
USER sp5

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:8000/api/health || exit 1
CMD ["python", "-m", "uvicorn", "backend.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
