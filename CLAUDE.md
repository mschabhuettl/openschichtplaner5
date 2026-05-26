# OpenSchichtplaner5 — Agent Guide

Open-source, browser-based **shift-planning** app — a drop-in replacement for the proprietary Windows tool *Schichtplaner5*. Its defining feature: it reads **and writes the original `.DBF` (FoxPro) database files directly**, so both programs can run on the same data without migration. Version 1.1.0, MIT.

## Architecture

Monorepo with two halves plus Docker orchestration:

- **`backend/`** — FastAPI + SQLAlchemy 2.0 + Alembic, serves the app on `http://localhost:8000`.
  - `api/` — FastAPI app: `main.py` (entrypoint, mounts routers + built frontend), `routers/` (one module per domain: `auth`, `employees`, `absences`, `schedule`, `reports`, `notifications`, `availability`, `overtime`, `qualification_matrix`, `recurring_shifts`, `ical`, `webhooks`, …), `schemas.py` (Pydantic), `dependencies.py`, `cache.py`, `rate_limit_store.py`.
  - `sp5lib/` — core library: `dbf_reader.py` / `dbf_writer.py` (the DBF bridge), `database.py` / `pg_database.py` / `sqlite_adapter.py` / `db_factory.py` (DB abstraction), `orm/` (`models.py` for SQLite, `models_pg.py` for Postgres, `repository.py`, `sync.py`), `email_service.py`, `auto_migrate.py`.
  - `alembic/` — DB migrations. `data/` — JSON-backed settings (skills, wishes, comments, notification settings).
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
| `make test` | Backend `pytest` + frontend `vitest` + Playwright e2e |
| `make lint` | `ruff check` + `mypy` (backend) + `eslint` (frontend) |
| `make build` | Build the frontend bundle |
| `make logs` | `tail -f` the backend log |
| `make docker` / `make docker-dev` / `make prod` / `make prod-secure` | Docker variants |
| `make backup` | Snapshot the DB volume to `./backups` |

Frontend-only (in `frontend/`): `npm run dev`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm run build`.
Backend tests directly: `cd backend && python3 -m pytest tests/ -v` (pytest `asyncio_mode = auto`).

## Conventions

- **Python:** ruff (target `py312`, line-length 100, rules `E,W,F,I,B,UP`) + ruff-format. Pre-commit runs ruff `--fix` + format on `backend/` only. Respect the existing per-file ignores in `pyproject.toml` — don't "fix" `E712` in SQLAlchemy `WHERE` clauses or `B008` in FastAPI `Depends`.
- **Frontend:** ESLint flat config (`frontend/eslint.config.js`); TypeScript strict build via `tsc -b`.
- **Pre-commit hooks** are configured (`.pre-commit-config.yaml`) — install with `pre-commit install`.
- **Commits:** Conventional Commits (`fix:`, `fix(frontend):`, `feat:`, …).
- **CI:** GitHub Actions `test.yml` and `docker.yml` run on PRs — make sure tests + Docker build stay green.

## Setup gotchas

- **`.env` lives at the repo root** (next to `start.sh`, also consumed by Docker). Copy `.env.example` → `.env`; key vars: `SECRET_KEY`, `ALLOWED_ORIGINS`, `HOST`, `PORT`, `DEBUG`, `TOKEN_EXPIRE_HOURS`, rate-limit + brute-force settings, logging, session limits. The frontend has its own `frontend/.env.example`.
- **Virtualenv:** standardized on `backend/.venv` — `start.sh` creates/uses it and the `make test`/`make lint` targets activate the same path. (CI installs deps directly and doesn't use a venv.)
- The DBF read/write path means data-shape assumptions come from FoxPro files — touch `dbf_reader`/`dbf_writer` carefully and keep SQLite (`models.py`) and Postgres (`models_pg.py`) models in sync.

## Working autonomously here

Permissions are bypassed in this environment, so no approval prompts will interrupt you. Good loop: branch off `main` → implement → `make lint` + `make test` → conventional commit → push → open a PR with `gh`. GitHub auth (gh/SSH/PAT) is set up system-wide. Ask the human only for genuine product decisions or blockers.
