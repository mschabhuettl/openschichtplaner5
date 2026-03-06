# OpenSchichtplaner5 — Deployment Guide

This guide covers production deployment with Docker Compose, Nginx reverse proxy, SSL via Let's Encrypt, and first-steps after setup.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Docker Compose (Production)](#docker-compose-production)
3. [Nginx Reverse Proxy](#nginx-reverse-proxy)
4. [SSL with Let's Encrypt](#ssl-with-lets-encrypt)
5. [First Steps After Deployment](#first-steps-after-deployment)
6. [Updates](#updates)
7. [Backup & Restore](#backup--restore)
8. [Production Checklist](#production-checklist)

---

## Prerequisites

- A Linux server (Ubuntu 22.04+ recommended)
- Docker Engine ≥ 24 + Docker Compose v2 (`docker compose`)
- A domain name pointing to your server (for TLS)
- Access to the SP5 `.DBF` database files

---

## Docker Compose (Production)

### 1. Clone the repository

```bash
git clone https://github.com/mschabhuettl/openschichtplaner5.git
cd openschichtplaner5
```

### 2. Create the environment file

```bash
cp backend/.env.example .env
nano .env
```

Set **at minimum** these values:

```env
# Path to your SP5 .DBF files inside the container
# Mount your host directory to /app/sp5_db/Daten via volumes (see step 3)
SP5_DB_PATH=/app/sp5_db/Daten

# Generate a secure random key:  openssl rand -hex 32
SECRET_KEY=<your-secret-key-here>

# Restrict to your own domain (no trailing slash)
ALLOWED_ORIGINS=https://meine-domain.de

# Security settings
SP5_HSTS=true          # Only enable with HTTPS/reverse-proxy!
SP5_DEV_MODE=false     # NEVER true in production
DEBUG=false
LOG_LEVEL=INFO
```

### 3. Mount your DBF database files

Edit `docker-compose.prod.yml` to add a bind mount for your SP5 data directory:

```yaml
volumes:
  - sp5_data:/app/data
  - sp5_logs:/app/logs
  - /pfad/zu/sp5/Daten:/app/sp5_db/Daten:rw   # ← add this line
```

Replace `/pfad/zu/sp5/Daten` with the actual path on your host system.

### 4. Start the application

```bash
# Production start (builds image, runs detached)
docker compose -f docker-compose.prod.yml up -d --build

# Check status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

Or use the Makefile shortcuts:

```bash
make prod        # Start production containers (detached)
make logs        # Follow live logs
make docker-down # Stop containers
```

The application is now running on `http://127.0.0.1:8000` (bound to localhost only).

---

## Nginx Reverse Proxy

Install Nginx:

```bash
sudo apt install nginx
```

Create a configuration file:

```bash
sudo nano /etc/nginx/sites-available/openschichtplaner5
```

Paste the following (replace `meine-domain.de` with your domain):

```nginx
server {
    listen 443 ssl http2;
    server_name meine-domain.de;

    ssl_certificate     /etc/letsencrypt/live/meine-domain.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/meine-domain.de/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 1d;

    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options           "SAMEORIGIN"                                   always;
    add_header X-Content-Type-Options    "nosniff"                                      always;
    add_header X-XSS-Protection          "1; mode=block"                                always;
    add_header Referrer-Policy           "strict-origin-when-cross-origin"              always;
    add_header Permissions-Policy        "camera=(), microphone=(), geolocation=()"     always;
    add_header Content-Security-Policy   "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; frame-ancestors 'none';" always;

    # Main application
    location / {
        proxy_pass         http://127.0.0.1:8000;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_buffering    off;
    }

    # SSE (Server-Sent Events) — disable buffering and caching
    location /api/sse {
        proxy_pass              http://127.0.0.1:8000;
        proxy_set_header        Host              $host;
        proxy_set_header        X-Forwarded-Proto $scheme;
        proxy_read_timeout      3600s;
        proxy_buffering         off;
        proxy_cache             off;
        chunked_transfer_encoding on;
    }
}

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name meine-domain.de;
    return 301 https://$host$request_uri;
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/openschichtplaner5 /etc/nginx/sites-enabled/
sudo nginx -t        # test config
sudo systemctl reload nginx
```

---

## SSL with Let's Encrypt

Install Certbot:

```bash
sudo apt install certbot python3-certbot-nginx
```

Obtain a certificate (Nginx plugin handles config automatically):

```bash
sudo certbot --nginx -d meine-domain.de
```

Test auto-renewal:

```bash
sudo certbot renew --dry-run
```

Certificates renew automatically via a systemd timer or cron job installed by Certbot.

---

## First Steps After Deployment

### 1. Verify the application is running

```bash
curl -s https://meine-domain.de/api/health
# → {"status": "ok", "db": "connected"}
```

### 2. Change the default admin password

Log in with the default credentials:
- Username: `admin`
- Password: `Test1234`

Then immediately change the password via **Settings → Users** in the web UI, or via the API:

```bash
# First, log in and save your token
export TOKEN=$(curl -s -X POST https://meine-domain.de/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Test1234"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# Change the admin password (user ID 1)
curl -s -X POST https://meine-domain.de/api/users/1/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"new_password": "MeinSicheresPasswort123!"}'
```

### 3. Create additional users

```bash
curl -s -X POST https://meine-domain.de/api/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "NAME": "planer1",
    "PASSWORD": "SicheresPasswort456!",
    "ROLE": "planer"
  }'
```

### 4. Set up regular backups

```bash
# Add to crontab (daily at 2 AM)
crontab -e
# 0 2 * * * cd /pfad/zu/openschichtplaner5 && make backup >> /var/log/sp5-backup.log 2>&1
```

---

## Updates

```bash
# Pull latest code and restart (one step)
make update

# Or manually:
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Backup & Restore

### Create a backup

```bash
make backup
# Creates: ./backups/sp5_db_<timestamp>.tar.gz
```

### Restore from backup

```bash
docker run --rm \
  -v openschichtplaner5_sp5_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/sp5_db_<timestamp>.tar.gz -C /data
```

---

## Production Checklist

- [ ] `SECRET_KEY` set to a secure random value (`openssl rand -hex 32`)
- [ ] `DEBUG=false`
- [ ] `SP5_DEV_MODE=false`
- [ ] `ALLOWED_ORIGINS` restricted to your domain
- [ ] `SP5_HSTS=true` (only with HTTPS/reverse-proxy)
- [ ] Default admin password changed
- [ ] Port 8000 only accessible on localhost (via `docker-compose.prod.yml`)
- [ ] Nginx security headers configured
- [ ] SSL certificate installed and auto-renewal tested
- [ ] Automated backup schedule configured
- [ ] Logs monitored (`./logs/` or `docker compose logs`)
