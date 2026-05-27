# OpenSchichtplaner5 — Deployment Guide

Production deployment with integrated nginx reverse proxy, SSL via Let's Encrypt, and Docker Compose.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Configuration](#configuration)
5. [SSL / HTTPS Setup](#ssl--https-setup)
6. [First Steps After Deployment](#first-steps-after-deployment)
7. [Updates](#updates)
8. [Backup & Restore](#backup--restore)
9. [Monitoring & Troubleshooting](#monitoring--troubleshooting)
10. [Production Checklist](#production-checklist)

---

## Architecture

```
                    ┌─────────────┐
  Internet ────────▶│   nginx     │──── Static files (frontend)
   :80/:443        │  (reverse   │
                    │   proxy)    │──── /api/* ──▶ sp5:8000 (uvicorn)
                    └─────────────┘
                          │
                    ┌─────┴─────┐
                    │ sp5       │
                    │ (backend) │
                    │ uvicorn   │
                    └───────────┘
                          │
                    ┌─────┴─────┐
                    │ sp5_data  │  (SQLite/DBF volume)
                    └───────────┘
```

**Services:**
- **nginx** — Reverse proxy, serves frontend static files, SSL termination, security headers, gzip
- **sp5** — Python/uvicorn backend API (not exposed to host)
- **init-frontend** — One-shot container that copies built frontend to shared volume

---

## Prerequisites

- Linux server (Ubuntu 22.04+ recommended)
- Docker Engine ≥ 24 + Docker Compose v2 (`docker compose`)
- A domain name pointing to your server (for HTTPS)
- Access to SP5 `.DBF` database files

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/mschabhuettl/openschichtplaner5.git
cd openschichtplaner5
```

### 2. Create the environment file

```bash
cp .env.example .env
nano .env
```

Set **at minimum** these values:

```env
SP5_DB_PATH=/app/data
SECRET_KEY=<run: openssl rand -hex 32>
ALLOWED_ORIGINS=https://meine-domain.de
SP5_DOMAIN=meine-domain.de
SP5_DEV_MODE=false
DEBUG=false
```

### 3. Mount your DBF database files

Add a bind mount to `docker-compose.prod.yml` in the `sp5` service:

```yaml
volumes:
  - sp5_data:/app/data
  - sp5_logs:/app/logs
  - frontend_dist:/app/frontend/dist:ro
  - /path/to/sp5/Daten:/app/sp5_db/Daten:rw   # ← your DBF files
```

### 4. Start the application

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

The app is now running on `http://your-server:80`.

### 5. Verify

```bash
# Check services
docker compose -f docker-compose.prod.yml ps

# Health check
curl -s http://localhost/api/health

# Logs
docker compose -f docker-compose.prod.yml logs -f
```

---

## Configuration

All configuration is via environment variables in `.env`. See `.env.example` for all available options.

### Key Production Variables

| Variable | Required | Description |
|---|---|---|
| `SECRET_KEY` | ✅ | JWT signing key (`openssl rand -hex 32`) |
| `SP5_DB_PATH` | ✅ | Path to database inside container |
| `ALLOWED_ORIGINS` | ✅ | Allowed CORS origins (your domain) |
| `SP5_DOMAIN` | ✅ | Your domain (for nginx/certbot) |
| `SP5_DEV_MODE` | ✅ | Must be `false` in production |
| `DEBUG` | ✅ | Must be `false` in production |
| `SP5_HSTS` | ⬡ | Set `true` after enabling HTTPS |
| `SP5_HTTP_PORT` | ⬡ | Host HTTP port (default: 80) |
| `SP5_HTTPS_PORT` | ⬡ | Host HTTPS port (default: 443) |
| `LOG_LEVEL` | ⬡ | `INFO` recommended for production |
| `RATE_LIMIT_API` / `RATE_LIMIT_LOGIN` | ⬡ | Per-IP/user rate limits (e.g. `200/minute` / `5/minute`) |
| `BRUTE_FORCE_MAX_ATTEMPTS` / `BRUTE_FORCE_LOCKOUT_MINUTES` | ⬡ | Login lockout tuning |

---

## Scaling & Workers

The backend keeps two pieces of state **in-process** (per uvicorn worker): the
server-side **session store** (for token revocation) and the **rate-limit /
brute-force counters**. There is no shared backing store. This has two
consequences for production:

1. **Set `SECRET_KEY`** (a long random value, e.g. `openssl rand -hex 32`).
   It signs the JWTs. If it is left unset the app falls back to a *random
   per-process* secret — tokens then become invalid on every restart and across
   workers, and the app logs a warning on startup. `start.sh` generates one
   automatically; for Docker/manual deploys set it in `.env`.
2. **Run a single worker** (the default) unless you add a shared store. With
   multiple uvicorn workers (or replicas), sessions and rate-limit counters are
   *not* shared: a token revoked on one worker stays valid on another, and rate
   limits are enforced per-worker. If you need to scale horizontally, terminate
   sessions via short `TOKEN_EXPIRE_HOURS` and put a rate limiter in the reverse
   proxy, or introduce a shared (e.g. Redis) backend first.

For most installations a single worker behind the bundled nginx is the intended,
supported setup and handles typical shift-planning load comfortably.

---

## SSL / HTTPS Setup

### Option A: Let's Encrypt with Certbot (recommended)

#### 1. Start services in HTTP mode first

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

#### 2. Obtain SSL certificate

```bash
# Run certbot against the running nginx
docker run --rm \
  -v openschichtplaner5_ssl_certs:/etc/letsencrypt \
  -v openschichtplaner5_certbot_webroot:/var/www/certbot \
  certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    -d meine-domain.de \
    --email admin@meine-domain.de \
    --agree-tos \
    --no-eff-email
```

#### 3. Enable HTTPS in nginx config

Edit `nginx/nginx.conf`:
1. Uncomment the SSL `server` block and HTTPS `listen` directive
2. Comment out the HTTP `listen 80` in the main block
3. Uncomment `Strict-Transport-Security` and `Content-Security-Policy` headers
4. Replace `meine-domain.de` with your actual domain

#### 4. Update .env

```env
SP5_HSTS=true
ALLOWED_ORIGINS=https://meine-domain.de
```

#### 5. Rebuild and restart

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

#### 6. Set up auto-renewal (crontab)

```bash
# Add to root crontab
0 3 * * * docker run --rm \
  -v openschichtplaner5_ssl_certs:/etc/letsencrypt \
  -v openschichtplaner5_certbot_webroot:/var/www/certbot \
  certbot/certbot renew --quiet \
  && docker compose -f /path/to/openschichtplaner5/docker-compose.prod.yml exec nginx nginx -s reload
```

### Option B: External Reverse Proxy

If you already have a reverse proxy (Traefik, Caddy, nginx on host):

1. Change `SP5_HTTP_PORT` to an unused port (e.g., `8080`)
2. Remove the `443` port mapping from `docker-compose.prod.yml`
3. Point your existing proxy to `localhost:8080`

---

## First Steps After Deployment

### 1. Verify health

```bash
curl -s https://meine-domain.de/api/health
# → {"status": "ok", "db": "connected"}
```

### 2. Change the default admin password

Default credentials: `admin` / `Test1234`

Log in via the web UI and change the password immediately under **Settings → Users**.

Or via API:

```bash
TOKEN=$(curl -s -X POST https://meine-domain.de/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Test1234"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

curl -s -X POST https://meine-domain.de/api/users/1/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"new_password": "MeinSicheresPasswort123!"}'
```

### 3. Set up backups

```bash
# Daily backup at 2 AM
crontab -e
0 2 * * * cd /path/to/openschichtplaner5 && make backup >> /var/log/sp5-backup.log 2>&1
```

---

## Updates

```bash
cd /path/to/openschichtplaner5
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Or with Makefile:

```bash
make update
```

---

## Backup & Restore

### Create backup

```bash
make backup
# → ./backups/sp5_db_<timestamp>.tar.gz
```

### Manual volume backup

```bash
docker run --rm \
  -v openschichtplaner5_sp5_data:/data:ro \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/sp5_data_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .
```

### Restore

```bash
docker compose -f docker-compose.prod.yml down
docker run --rm \
  -v openschichtplaner5_sp5_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/sp5_data_<timestamp>.tar.gz -C /data
docker compose -f docker-compose.prod.yml up -d
```

---

## Monitoring & Troubleshooting

### View logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f nginx
docker compose -f docker-compose.prod.yml logs -f sp5
```

### Health checks

```bash
# Service status
docker compose -f docker-compose.prod.yml ps

# Manual health check
curl -sf http://localhost/api/health && echo "OK" || echo "FAIL"
```

### Common issues

| Problem | Solution |
|---|---|
| nginx returns 502 | Backend not ready yet — check `sp5` logs, wait for healthcheck |
| Frontend shows blank page | Check `init-frontend` ran: `docker compose logs init-frontend` |
| SSL certificate errors | Verify cert paths in nginx.conf match volume mounts |
| Port 80/443 already in use | Change `SP5_HTTP_PORT`/`SP5_HTTPS_PORT` in `.env` |

---

## Production Checklist

- [ ] `SECRET_KEY` set to secure random value (`openssl rand -hex 32`)
- [ ] `DEBUG=false`
- [ ] `SP5_DEV_MODE=false`
- [ ] `ALLOWED_ORIGINS` restricted to your domain only
- [ ] `SP5_HSTS=true` (only after HTTPS is working)
- [ ] Default admin password changed
- [ ] Backend port NOT exposed to host (only via nginx)
- [ ] nginx security headers active
- [ ] SSL certificate installed and auto-renewal configured
- [ ] Automated backup schedule configured
- [ ] Log rotation configured (Docker json-file driver handles this)
- [ ] Firewall allows only 80/443 inbound
- [ ] Resource limits set appropriately for your hardware
