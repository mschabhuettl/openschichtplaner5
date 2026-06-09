# OpenSchichtplaner5 — Agent Guide

Open-source, browser-based **shift-planning** app — a drop-in replacement for the proprietary Windows tool *Schichtplaner5*. Its defining feature: it reads **and writes the original `.DBF` (FoxPro) database files directly**, so both programs can run on the same data without migration. Version 1.1.0, MIT.

## Architecture

Three repos; this one is the app shell (frontend + deployment + runtime state):

- **REST API** = external package [`openschichtplaner5-api`](https://github.com/mschabhuettl/openschichtplaner5-api), importable as **`sp5api`** (`main.py` ASGI entrypoint `sp5api.main:app`, `routers/` one module per domain, `schemas.py`, `dependencies.py`, …). Its pytest suite lives in that repo. Develop locally via `make dev-link`.
- **Core library** = external package [`libopenschichtplaner5`](https://github.com/mschabhuettl/libopenschichtplaner5), importable as **`sp5lib`** (DBF bridge, DB abstraction, ORM/sync, email, auto-migrate).
- **`backend/`** — no Python app code anymore; holds what the packages resolve via `SP5_BACKEND_DIR`:
  - `alembic/` — DB migrations (run by sp5lib auto-migrate). `data/` + `api/data` + `api/uploads` — JSON-backed runtime state. `fixtures/` — DBF fixture data (CI e2e seed). `requirements.txt` — declares both packages (PyPI: `openschichtplaner5-api`, `libopenschichtplaner5`).
  - **Dual DB backend:** SQLite (default/dev) or PostgreSQL (prod, via `psycopg2`); `db_factory.py` selects.
  - **Auth/security:** bcrypt password hashing, 2FA, JWT tokens, login rate-limiting and brute-force lockout.
- **`frontend/`** — React 18 + TypeScript 5 + Vite + Tailwind, with `react-router-dom` and `recharts`.
  - Unit tests: **vitest**. E2E: **Playwright** in `frontend/e2e/`. `build` runs `tsc -b && vite build` then injects SRI hashes.
- **Docker:** `docker-compose.yml` (dev/default), `docker-compose.prod.yml` (prod, localhost-only — put a reverse proxy in front), `Dockerfile`.

## Dev commands (run from repo root via `make`)

| Command | What it does |
|---|---|
| `make dev` | Local run via `start.sh` → backend + frontend on `:8000` |
| `make stop` | Stop the local backend (`start.sh --stop`) |
| `make test` | Frontend `vitest` + Playwright e2e (backend pytest lives in the API repo) |
| `make lint` | `ruff check` + `mypy` (backend) + `eslint` (frontend) |
| `make dev-link` | Editable installs of `../libopenschichtplaner5` + `../openschichtplaner5-api` into `backend/.venv` |
| `make build` | Build the frontend bundle |
| `make logs` | `tail -f` the backend log |
| `make docker` / `make docker-dev` / `make prod` / `make prod-secure` | Docker variants |
| `make backup` | Snapshot the DB volume to `./backups` |

Frontend-only (in `frontend/`): `npm run dev`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm run build`.
Backend tests: in the API repo — `cd ../openschichtplaner5-api && pytest` (pytest `asyncio_mode = auto`).

## Conventions

- **Python:** ruff (target `py312`, line-length 100, rules `E,W,F,I,B,UP`) + ruff-format. Pre-commit runs ruff `--fix` + format on `backend/` only (now just `scripts/` + `alembic/`). API/library code follows the ruff config in its own repo.
- **Frontend:** ESLint flat config (`frontend/eslint.config.js`); TypeScript strict build via `tsc -b`.
- **Pre-commit hooks** are configured (`.pre-commit-config.yaml`) — install with `pre-commit install`.
- **Commits:** Conventional Commits (`fix:`, `fix(frontend):`, `feat:`, …).
- **CI:** GitHub Actions `test.yml` and `docker.yml` run on PRs — make sure tests + Docker build stay green.

## Setup gotchas

- **`.env` lives at the repo root** (next to `start.sh`, also consumed by Docker). Copy `.env.example` → `.env`; key vars: `SECRET_KEY`, `ALLOWED_ORIGINS`, `HOST`, `PORT`, `DEBUG`, `TOKEN_EXPIRE_HOURS`, rate-limit + brute-force settings, logging, session limits. The frontend has its own `frontend/.env.example`.
- **Virtualenv:** standardized on `backend/.venv` — `start.sh` creates/uses it and the `make test`/`make lint` targets activate the same path. (CI installs deps directly and doesn't use a venv.)
- The DBF read/write path means data-shape assumptions come from FoxPro files — `dbf_reader`/`dbf_writer` live in the library repo; touch them there.
- `SP5_BACKEND_DIR` is the resource-root contract between the app and the `sp5api`/`sp5lib` packages — start.sh, Dockerfile and CI set it to `backend/`. The built SPA is found via `SP5_FRONTEND_DIST` (default `SP5_BACKEND_DIR/../frontend/dist`).

## Working autonomously here

Permissions are bypassed in this environment, so no approval prompts will interrupt you. Good loop: branch off `main` → implement → `make lint` + `make test` → conventional commit → push → open a PR with `gh`. GitHub auth (gh/SSH/PAT) is set up system-wide. Ask the human only for genuine product decisions or blockers.
