# OpenSchichtplaner5 — Development Setup

This guide gets you up and running for local development.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Backend Setup](#backend-setup)
3. [Frontend Setup](#frontend-setup)
4. [Running Tests](#running-tests)
5. [Common Problems](#common-problems)

---

## Prerequisites

| Tool | Minimum Version | Install |
|------|----------------|---------|
| Python | 3.8+ | [python.org](https://www.python.org/downloads/) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org/) |
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
python -m venv venv
source venv/bin/activate       # Linux/macOS
# venv\Scripts\activate        # Windows
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
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

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

```bash
cd backend
source venv/bin/activate

# Run all tests
python -m pytest tests/ -v

# With coverage report
python -m pytest tests/ --cov=api --cov=sp5lib --cov-report=term-missing

# Single test file
python -m pytest tests/test_smoke.py -v

# Run smoke test directly
python -m pytest test_smoke.py -v
```

Coverage must be ≥ 70% (enforced in CI).

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

## Project Structure

```
openschichtplaner5/
├── backend/
│   ├── api/
│   │   ├── main.py          # FastAPI app setup, middleware, health endpoints
│   │   ├── dependencies.py  # Auth dependencies (require_auth, require_admin…)
│   │   ├── schemas.py       # Shared Pydantic schemas
│   │   └── routers/         # Route handlers (one file per domain)
│   │       ├── auth.py      # /api/auth/*, /api/users/*
│   │       ├── employees.py # /api/employees/*, /api/groups/*
│   │       ├── schedule.py  # /api/schedule/*, /api/absences/*
│   │       ├── reports.py   # /api/export/*, /api/statistics/*, /api/import/*
│   │       └── ...
│   ├── sp5lib/
│   │   ├── dbf_reader.py    # Low-level DBF/FoxPro file reader
│   │   ├── dbf_writer.py    # DBF writer (append / update / delete)
│   │   ├── database.py      # High-level DB access layer (40+ methods)
│   │   └── color_utils.py   # BGR ↔ RGB color conversion
│   ├── tests/               # pytest test suite
│   ├── requirements.txt     # Python dependencies
│   └── .env.example         # Example environment config
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

### `ModuleNotFoundError: No module named 'api'`

Make sure you're running `uvicorn` from inside the `backend/` directory:

```bash
cd backend
uvicorn api.main:app --reload
```

### `401 Unauthorized` on every request (multi-worker issue)

The in-memory session store does not work across multiple workers. Run with a single worker:

```bash
uvicorn api.main:app --workers 1 --reload
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

Set the `SP5_REAL_DB` env variable to a directory with DBF files, or run tests without real DB (unit tests only):

```bash
python -m pytest tests/ -k "not integration"
```

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
