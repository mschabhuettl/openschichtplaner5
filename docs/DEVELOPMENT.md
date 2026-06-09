# OpenSchichtplaner5 — Development Setup

This guide gets you up and running for local development.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Backend Setup](#backend-setup)
3. [Frontend Setup](#frontend-setup)
4. [Running Tests](#running-tests)
5. [Working on all three repos](#working-on-all-three-repos)
6. [Common Problems](#common-problems)

---

## Prerequisites

| Tool | Minimum Version | Install |
|------|----------------|---------|
| Python | 3.10+ | [python.org](https://www.python.org/downloads/) |
| Node.js | 20+ | [nodejs.org](https://nodejs.org/) |
| npm | 9+ | bundled with Node.js |
| Git | any | [git-scm.com](https://git-scm.com/) |

You also need access to SP5 `.DBF` database files, or use the dev mode (no real DB required).

---

## Backend Setup

### 1. Clone and enter the repo

```bash
git clone https://github.com/mschabhuettl/openschichtplaner5.git
cd openschichtplaner5/backend
```

### 2. Create a virtual environment

```bash
python -m venv .venv
source .venv/bin/activate       # Linux/macOS
# .venv\Scripts\activate        # Windows
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment

```bash
# Copy example env file
cp .env.example .env
# Edit as needed (SP5_DB_PATH, SECRET_KEY, etc.)
```

For development without real DBF files, enable dev mode:

```bash
export SP5_DEV_MODE=true
export SP5_DB_PATH=/path/to/sp5/Daten  # or a writable temp dir
```

### 5. Start the backend

```bash
SP5_BACKEND_DIR="$(pwd)" uvicorn sp5api.main:app --host 0.0.0.0 --port 8000 --reload
```

(`SP5_BACKEND_DIR` points the installed `sp5api`/`sp5lib` packages at this
`backend/` directory for runtime state and the Alembic config — `start.sh`,
Docker and CI set it automatically.)

> ⚠️ Use `--workers 1` (the default). Multiple workers cause session token issues because sessions are stored in-memory.

The API is now available at:
- **API:** `http://localhost:8000/api/`
- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

---

## Frontend Setup

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Start the dev server

```bash
npm run dev
```

The frontend is available at `http://localhost:5173` and proxies API calls to `http://localhost:8000`.

### 3. Build for production

```bash
npm run build
# Output: frontend/dist/
```

The production build is automatically served by the FastAPI backend (static files).

### 4. Linting

```bash
# TypeScript / ESLint
npm run lint

# Python (ruff)
cd ../backend
ruff check .
```

---

## Running Tests

### Backend (pytest)

The backend test suite lives in the API repo
([openschichtplaner5-api](https://github.com/mschabhuettl/openschichtplaner5-api)):

```bash
cd ../openschichtplaner5-api
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pytest
```

Coverage must be ≥ 70% (enforced in that repo's CI).

### Frontend (Vitest)

```bash
cd frontend

# Run tests once
npm test

# Watch mode (re-runs on file changes)
npm run test:watch

# With coverage
npm test -- --coverage
```

### Run all tests at once (Makefile)

```bash
# From the repo root:
make test
```

### TypeScript type check

```bash
cd frontend
npx tsc --noEmit
```

### Pre-commit hooks

The repo ships with a `.pre-commit-config.yaml`. Install the hooks once:

```bash
pip install pre-commit
pre-commit install
```

After that, linting and basic checks run automatically before every commit. Run manually against all files:

```bash
pre-commit run --all-files
```

---

## Working on all three repos

OpenSchichtplaner5 is split across three repositories:

| Repo | Distribution | Import name |
|---|---|---|
| [openschichtplaner5](https://github.com/mschabhuettl/openschichtplaner5) | the app (frontend + deployment + runtime state) | — |
| [openschichtplaner5-api](https://github.com/mschabhuettl/openschichtplaner5-api) | `openschichtplaner5-api` | `sp5api` |
| [libopenschichtplaner5](https://github.com/mschabhuettl/libopenschichtplaner5) | `libopenschichtplaner5` | `sp5lib` |

The app consumes both packages via `backend/requirements.txt`. To hack on the
library and/or the API while running the app, clone all three as siblings and
install the local clones editable into the app's venv:

```bash
git clone https://github.com/mschabhuettl/openschichtplaner5.git
git clone https://github.com/mschabhuettl/openschichtplaner5-api.git
git clone https://github.com/mschabhuettl/libopenschichtplaner5.git
cd openschichtplaner5
make dev-link   # pip install -e ../libopenschichtplaner5 -e ../openschichtplaner5-api into backend/.venv
make dev        # start the app
```

Edits in either sibling repo are picked up on the next backend restart — no
reinstall needed (editable installs). To go back to the pinned dependencies:
`cd backend && .venv/bin/pip install --force-reinstall -r requirements.txt`.

---

## Project Structure

```
openschichtplaner5/
├── backend/
│   # The REST API (FastAPI app + routers) is the external openschichtplaner5-api
│   # package, listed in requirements.txt and imported as sp5api. Its test suite
│   # lives in that repo. sp5lib (DBF reader/writer + high-level DB access) is the
│   # external libopenschichtplaner5 package, imported as sp5lib.
│   ├── api/                 # Runtime state: api/data (JSON stores), api/uploads
│   ├── data/                # Runtime state: JSON document stores
│   ├── fixtures/            # DBF fixture data (seeds the CI e2e backend)
│   ├── alembic/             # DB migrations (run by sp5lib auto-migrate)
│   └── requirements.txt     # Python dependencies (API + library)
├── .env.example             # Example environment config (repo root, used by start.sh + Docker)
├── frontend/
│   └── src/
│       ├── App.tsx          # Root component: routing, layout, lazy loading
│       ├── api/client.ts    # Typed API client (fetch wrapper)
│       └── pages/           # One component per page (33 pages)
└── docs/                    # Documentation (you are here)
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SP5_DB_PATH` | *(required)* | Absolute path to the directory containing `.DBF` files |
| `SECRET_KEY` | *(required in prod)* | JWT signing key — use `openssl rand -hex 32` |
| `SP5_DEV_MODE` | `false` | `true` enables login without password (dev only!) |
| `TOKEN_EXPIRE_HOURS` | `8` | Session token lifetime in hours |
| `ALLOWED_ORIGINS` | `*` | CORS allowed origins (comma-separated, restrict in prod) |
| `SP5_HSTS` | `false` | Enable HSTS header (only with HTTPS reverse proxy) |
| `DEBUG` | `false` | Enable FastAPI debug mode |
| `LOG_LEVEL` | `INFO` | Log level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |

---

## Common Problems

### Runtime state ends up in `site-packages` (missing `SP5_BACKEND_DIR`)

When starting `uvicorn` by hand, set `SP5_BACKEND_DIR` to the `backend/`
directory — otherwise the installed packages fall back to their own install
location for `data/`, `api/data` and the Alembic config:

```bash
cd backend
SP5_BACKEND_DIR="$(pwd)" uvicorn sp5api.main:app --reload
```

### `401 Unauthorized` on every request (multi-worker issue)

The in-memory session store does not work across multiple workers. Run with a single worker:

```bash
uvicorn sp5api.main:app --workers 1 --reload
```

### Frontend can't reach the backend

Check that `vite.config.ts` has a proxy configured for `/api`:

```ts
// frontend/vite.config.ts
server: {
  proxy: {
    '/api': 'http://localhost:8000',
  }
}
```

### `SP5_DB_PATH` points to an empty directory

The backend will start but most endpoints return empty results or 500 errors. Point `SP5_DB_PATH` to the directory that actually contains your `.DBF` files, or use `SP5_DEV_MODE=true` for development without real data.

### Tests fail: `database not found`

(Backend tests live in the openschichtplaner5-api repo.) Set the `SP5_REAL_DB`
env variable to a directory with DBF files, or rely on the bundled
`tests/fixtures/` DBF files, which are used automatically.

### Port 8000 already in use

```bash
# Find and kill the process using port 8000
lsof -ti :8000 | xargs kill -9
```

### Frontend build fails with TypeScript errors

```bash
cd frontend
npx tsc --noEmit    # shows all type errors
npm run lint        # shows ESLint issues
```

---

## Dev Mode Login

With `SP5_DEV_MODE=true`, a dev token is available:

```bash
curl -s http://localhost:8000/api/dev/mode
# → {"dev_mode": true, "dev_token": "dev-token-..."}
```

Use the returned token as `Authorization: Bearer <dev-token>` for all requests. **Never enable in production.**
