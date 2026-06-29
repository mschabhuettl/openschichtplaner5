<div align="center">

# 🧸 OpenSchichtplaner5

**Open-source web replacement for Schichtplaner5**

*Reads and writes the original DBF database files directly — no migration needed.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.21.2-brightgreen)](CHANGELOG.md)
[![Tests](https://github.com/mschabhuettl/openschichtplaner5/actions/workflows/test.yml/badge.svg)](https://github.com/mschabhuettl/openschichtplaner5/actions/workflows/test.yml)
[![Docker](https://github.com/mschabhuettl/openschichtplaner5/actions/workflows/docker.yml/badge.svg)](https://github.com/mschabhuettl/openschichtplaner5/actions/workflows/docker.yml)
[![ghcr.io](https://img.shields.io/badge/ghcr.io-image-2496ED?logo=docker&logoColor=white)](https://github.com/mschabhuettl/openschichtplaner5/pkgs/container/openschichtplaner5)
[![GitHub release](https://img.shields.io/github/v/release/mschabhuettl/openschichtplaner5?include_prereleases)](https://github.com/mschabhuettl/openschichtplaner5/releases)
[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3+-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

📖 **[Full documentation, screenshots & guides → GitHub Wiki](https://github.com/mschabhuettl/openschichtplaner5/wiki)**

</div>

---

## What is OpenSchichtplaner5?

OpenSchichtplaner5 is a modern, browser-based shift planning application — developed as a fully-featured open-source replacement for the proprietary Windows software **Schichtplaner5**.

The key differentiator: OpenSchichtplaner5 reads and writes the **original `.DBF` database files** directly in FoxPro format. No data migration is required — both programs can run simultaneously on the same data.

<table>
  <tr>
    <td><img src="docs/screenshots/dashboard.png" alt="Dashboard" width="480"/><br/><sub><b>Dashboard with Live Charts & Widgets</b></sub></td>
    <td><img src="docs/screenshots/dienstplan.png" alt="Schedule" width="480"/><br/><sub><b>Schedule — Monthly View</b></sub></td>
  </tr>
</table>

> 🖼️ More screenshots and per-feature documentation: **[GitHub Wiki](https://github.com/mschabhuettl/openschichtplaner5/wiki)**

---

## Features

- 📅 **Scheduling** — monthly/weekly/calendar views, drag & drop, undo/redo, multi-entry cells with conflict dialog, staffing traffic light, templates, auto-planner, shift cycles & recurring shifts
- 🗓️ **The four original SP5 views** — Dienstplan, Einsatzplan (special shifts & deviations), Jahresübersicht (12×31 day grid), Personaltabelle (free evaluation period)
- 👥 **Employees** — full CRUD, groups, skills, availability, contract hours, CSV bulk import, comparison view, qualification matrix
- 🏖️ **Leave management** — requests & approval workflow, entitlements, partial-day absences, year-end close, cutoff-date forfeiture with dry-run preview, annual timeline
- 🔄 **Self-service** — shift preferences, swap exchange, personal calendar, iCal feed, profile management
- 📊 **Analytics & reports** — dashboard with live charts, statistics over free date ranges, 20+ report types, CSV/XLSX export, print stylesheets, scheduled email exports
- ⚖️ **Work-time rules** — configurable rule engine (max hours/day, minimum rest, max consecutive days) with violation highlighting
- 🔒 **Security** — role-based access plus fine-grained per-user permissions, 2FA (TOTP), bcrypt, JWT, rate limiting, audit log
- 🔔 **Notifications** — real-time updates (SSE), email (SMTP), in-app notification center
- 🐳 **Operations** — Docker deployment, CI/CD, backup/restore, health dashboard, SQLite (default) or PostgreSQL backend
- 📱 **UX** — dark mode, i18n (de/en), mobile-responsive, keyboard navigation, global search (`Ctrl+K`), PWA

> Full feature details: [GitHub Wiki](https://github.com/mschabhuettl/openschichtplaner5/wiki) · [CHANGELOG.md](CHANGELOG.md)

---

## Compatibility

| Property | Original SP5 | OpenSchichtplaner5 |
|----------|:-----------:|:-----------------:|
| Operating System | Windows only | 🌐 Cross-platform |
| Interface | Desktop app | 🖥️ Modern browser |
| Database Format | DBF/FoxPro | ✅ DBF/FoxPro (compatible) |
| Parallel Operation | — | ✅ Both run simultaneously |
| License | Proprietary | ✅ Open Source (MIT) |

> 💡 OpenSchichtplaner5 and the original Schichtplaner5 access **the same database files**. No export, no import, no migration.

---

## Installation

### 🐳 Docker (recommended)

Images are built on every release and published to the GitHub Container Registry:

```bash
docker pull ghcr.io/mschabhuettl/openschichtplaner5:latest   # or :1.3.0
```

The image serves SPA + API from a single container on port 8000. Mount the
directory with the Schichtplaner5 `.DBF` files to `/app/data` and set a
`SECRET_KEY` (everything else has sane defaults, see [`.env.example`](.env.example)):

```bash
docker run -d --name openschichtplaner5 -p 8000:8000 \
  -v /path/to/SP5/Daten:/app/data \
  -e SECRET_KEY=$(openssl rand -hex 32) \
  ghcr.io/mschabhuettl/openschichtplaner5:latest

curl http://localhost:8000/api/health   # → {"status":"healthy",...}
```

Or build locally instead of pulling (build args `LIB_SOURCE` / `API_SOURCE`
default to the PyPI pins of the [library](https://github.com/mschabhuettl/libopenschichtplaner5)
and the [API package](https://github.com/mschabhuettl/openschichtplaner5-api);
override with any pip requirement, e.g. `git+https://…@main`):

```bash
docker build -t openschichtplaner5 .
```

With Docker Compose (configuration via `.env` in the repo root):

```bash
git clone https://github.com/mschabhuettl/openschichtplaner5.git
cd openschichtplaner5
cp .env.example .env && nano .env   # set SP5_DB_PATH + SECRET_KEY!
make prod                           # docker compose up -d --build
```

For the production setup with nginx reverse proxy, SSL/Let's Encrypt, backups
and the hardening checklist see **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.
A three-service stack (nginx-served SPA + API container + optional PostgreSQL)
is available via `docker-compose.stack.yml`.

### Local without Docker

Prerequisites: Python 3.12+, Node.js 20+, access to the SP5 `.DBF` files.

```bash
bash start.sh          # creates .env + venv, builds the frontend, starts on :8000
bash start.sh --stop   # stop the backend
```

For running backend (`uvicorn sp5api.main:app`) and frontend dev server
(`npm run dev`) separately, the `make` targets (`make help`) and three-repo
co-development via `make dev-link`, see **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)**.

> ⚠️ Use a **single** uvicorn worker: sessions are stored in-memory and are not
> shared between workers (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)).

---

## User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access: all master data, user management, backup, import, settings |
| **Planner** | Shift planning (schedule, absences, notes, handovers, preferences) + read access to all master data |
| **Reader** | Read-only access — all write operations are blocked (403) |

Roles are enforced in the backend (HTTP 403) and the frontend (controls hidden);
fine-grained per-user permissions additionally gate individual planning actions.
Demo users `admin` / `planer` / `leser` (password `Test1234` each) are seeded
automatically in dev mode (and whenever `SP5_SEED_DEMO_USERS=1`). Production
deployments keep this off and use the accounts from their own `5USER` table —
those log in with their existing password (including accounts created by the
original Schichtplaner5, whose passwords may be empty or short).

---

## Project Structure

```
openschichtplaner5/
├── backend/             # Resource root for the two external Python packages:
│                        #   API  → openschichtplaner5-api  (import: sp5api)
│                        #   Lib  → libopenschichtplaner5   (import: sp5lib)
│                        # holds runtime state, DBF fixtures, Alembic migrations
├── frontend/            # React SPA — 77 pages, typed API client, vitest + Playwright
├── nginx/               # Production reverse-proxy image
└── docs/                # API, deployment, development, PostgreSQL, architecture
```

---

## Tech Stack

| Area | Technology |
|------|------------|
| Backend | Python, FastAPI, Uvicorn ([API repo](https://github.com/mschabhuettl/openschichtplaner5-api)) |
| Database | DBF/FoxPro (direct) + SQLite (default) or PostgreSQL ([library repo](https://github.com/mschabhuettl/libopenschichtplaner5)) |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Recharts |
| API | REST (`/api/v1/`), 300+ endpoints, OpenAPI/Swagger at `/api/v1/docs` |
| Integration | SMTP email, iCal feed, SSE real-time updates, webhooks |
| Testing | vitest + Playwright (frontend/E2E); backend pytest lives in the [API repo](https://github.com/mschabhuettl/openschichtplaner5-api) |

---

## Documentation

📖 **[GitHub Wiki](https://github.com/mschabhuettl/openschichtplaner5/wiki)** — full documentation: feature guides, screenshots, FAQ

In-repo: [API reference](docs/API.md) · [Deployment](docs/DEPLOYMENT.md) · [Development](docs/DEVELOPMENT.md) · [PostgreSQL](docs/POSTGRESQL.md) · [Architecture](docs/architecture.md)

---

## License

MIT © [mschabhuettl](https://github.com/mschabhuettl)
