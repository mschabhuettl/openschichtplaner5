# ADR 0001 — Extracting `backend/api` into a standalone `openschichtplaner5-api` package

- **Status:** Accepted (umgesetzt; die App konsumiert das extrahierte Paket)
- **Date:** 2026-05-27
- **Epic:** API-Extraktion (`openschichtplaner5-api`), Phase **P1** (analysis + config contract); die Folgephasen P2–P5 (Repo-Split, Refactoring, Release, App-Umstellung) sind in §3 skizziert und inzwischen umgesetzt.
- **Scope:** Docs-only. No application code changes in this phase.

---

## Context

The REST/auth layer under `backend/api` (FastAPI app, routers, schemas, dependencies,
cache, rate-limit, DB wiring) is general-purpose: it speaks to `libopenschichtplaner5`
(the `sp5lib` import name, consumed from PyPI — `backend/requirements.txt:31`
`libopenschichtplaner5[postgres]>=1.4.0`) and could be reused by third-party projects
the same way the library already is. The goal of the epic is to lift it into its own repo
/ PyPI distribution `openschichtplaner5-api` that depends only on `libopenschichtplaner5`,
is **app-agnostic and configurable** (no mounted frontend, no app `.env` direct reads),
and is then re-consumed by this app (which keeps only wiring + frontend + deployment).

Before any code moves, P1 must (a) map exactly how `backend/api` is coupled to *this*
app's environment and (b) propose a configuration contract — a `Settings` object plus a
`create_app(config)` factory — that lets the API run standalone or multi-tenant.

The analysis below cites real symbols and `path:line` references verified against the
current tree (branch `docs/api-extraction-adr-p1`, off `origin/main`).

---

## Decision

### 1. Coupling inventory (evidence-based)

#### 1a. App `.env` / `os.environ` direct reads

The API reads environment variables directly at **module import time** (values are frozen
into module-level constants), scattered across several files rather than through one config
object:

| Variable | Where read | Purpose |
|---|---|---|
| `SP5_BACKEND_DIR` | `api/main.py:16` (`os.environ.setdefault`) | Tells `sp5lib` where the app's `backend/` root is (for `backend/data`, `backend/api/data`, alembic) when installed standalone |
| `SP5_DB_PATH` | `api/main.py:130`; also `api/main.py:1138`, `api/routers/admin.py:160`, `api/routers/admin.py:600` | DBF data directory |
| `ALLOWED_ORIGINS` | `api/main.py:137` | CORS origins (split on comma; falls back to `localhost:5173/8000`) |
| `CSP_REPORT_ONLY` | `api/main.py:401` | CSP report-only toggle |
| `SP5_HSTS` | `api/main.py:455` | Emit HSTS header |
| `SP5_DEV_MODE` | `api/main.py:123`, `api/dependencies.py:152`, `api/routers/auth.py:63` | Dev bypass token |
| `SP5_JWT_SECRET` | `api/dependencies.py:119` (else random `token_hex(64)`) | JWT signing secret |
| `TOKEN_EXPIRE_HOURS` | `api/dependencies.py:128` | Session/JWT lifetime |
| `MAX_SESSIONS_PER_USER` | `api/dependencies.py:131` | Concurrent-session cap |
| `SP5_LOG_FORMAT` / `SP5_LOG_LEVEL` | `api/dependencies.py:71`, `:82` | Logging config (also fixes log file to `/tmp/sp5-api.log`, `:74`) |
| `SP5_AUDIT_LOG` | `api/dependencies.py:361` (default `/tmp/sp5-audit.json`) | Audit JSONL path |
| `SP5_RATE_LIMIT_LOG` | `api/rate_limit_store.py:13` | Rate-limit event JSONL path |
| `SP5_PW_MIN_LENGTH`, `SP5_PW_REQUIRE_UPPER`, `SP5_PW_REQUIRE_DIGIT` | `api/routers/auth.py:31`, `:32`, `:37` | Password policy |

`api/main.py:10,89` calls `load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))`
— i.e. the API package itself loads the **app's** `.env` from a fixed relative location.
This is the clearest app-coupling: an app-agnostic package must not load a `.env` for the
host, let alone assume its location.

Note the `.env` surface includes more keys consumed elsewhere (e.g. `SECRET_KEY`, `HOST`,
`PORT`, `DEBUG`, `RATE_LIMIT_*`, `BRUTE_FORCE_*` per `.env.example`), but those listed above
are the ones read **inside `api/`**.

#### 1b. Mounted frontend / static files

`api/main.py` directly serves this app's React bundle — pure app coupling:

- `api/main.py:1085-1094` — `GET /` returns `FileResponse(frontend/dist/index.html)`.
- `api/main.py:1715-1717` — `_FRONTEND_DIST` computed `__file__`-relative as
  `../../frontend/dist`.
- `api/main.py:1719-1724` — `app.mount("/assets", StaticFiles(directory=.../dist/assets))`.
- `api/main.py:1726-1735` — catch-all `GET /{full_path:path}` SPA fallback returning
  `index.html`, with a guard that re-raises 404 for `api/*` paths.

This must become **opt-in** (default off) in the extracted package — a third-party API
consumer has no `frontend/dist`.

#### 1c. Filesystem / path assumptions (`__file__`-relative)

Many modules locate JSON-backed settings and other files relative to their own `__file__`,
hard-wiring this repo's directory layout (`api/`, `backend/data`, `backend/api/data`, repo
root):

- `api/main.py:16` — `SP5_BACKEND_DIR` = `dirname(dirname(__file__))` (= `backend/`).
- `api/main.py:92` — `sys.path.insert(0, backend_dir)` (so `import api.*` and `import sp5lib`
  resolve) — an app bootstrap concern that should not live in the library.
- `api/main.py:132` — default `SP5_DB_PATH` = `../../../sp5_db/Daten`.
- `api/rate_limit_store.py:15` — `../data/rate_limit_events.jsonl`.
- `api/routers/notifications.py:21` — `../notifications.json`.
- `api/routers/notification_settings.py:18` — `../../data/notification_settings.json`.
- `api/routers/admin.py:701` — `../../data/frontend_errors.json`.
- `api/routers/webhooks.py:22` — `../../data/webhooks.json`.
- `api/routers/availability.py:21`, `recurring_shifts.py:23`, `master_data.py:754` —
  `../data` (`backend/api/data`).
- `api/routers/scheduled_reports.py:49`, `work_time_rules.py:31`, `export_scheduler.py:35` —
  `Path(__file__).parent.parent.parent / "data"` (= `backend/data`).
- `api/routers/employees.py:422` — photo uploads under `../uploads/photos`.
- `api/routers/absences.py:478` — `../absence_status.json`.
- `api/routers/misc.py:1449` — `CHANGELOG.md` at `parents[3]` (repo root).
- `api/dependencies.py:74` — log file hard-coded `/tmp/sp5-api.log`.

There are **two distinct data dirs** in play (`backend/data` and `backend/api/data`), both
resolved by walking up `__file__`. In a standalone package these become a single injected
**data directory**.

#### 1d. Global mutable state (process-wide, not per-app)

State lives as **module globals**, bound by reference into routers at import time — so it is
shared by every `FastAPI()` instance in the process and cannot be isolated per app/tenant:

- `api/dependencies.py:125` — `_sessions: dict[str, dict] = {}` (the central session store;
  also enables JWT revocation). `auth.py` imports it by reference
  (`api/routers/auth.py:11-19` `from ..dependencies import (... _sessions ...)`), and
  `main.py` re-exports it (`api/main.py:108-119`) so tests do `from api.main import _sessions`.
  Read/written in `main.py` middlewares (`:529`, `:590`, `:645`, `:654`, `:757`) and in
  `auth.py` login/logout (`:523-528`, `:583-598`).
- `api/dependencies.py:134` — `_failed_logins: dict[str, list] = {}` (brute-force tracking),
  also imported by reference into `auth.py:461-512`.
- `api/dependencies.py:114` — `limiter = Limiter(...)`, wired via `app.state.limiter`
  (`api/main.py:289`).
- `api/dependencies.py:119` — `_JWT_SECRET` frozen at import (random per process if unset →
  tokens invalidated on restart / not shareable across workers).
- `api/main.py:86` — `_metrics = _Metrics()` module-global in-memory metrics.
- `api/cache.py:11-12` — module-global `_store` TTL cache (`get/put/invalidate/clear`).
- `api/rate_limit_store.py` — module-global JSONL file writer (`_RATE_LIMIT_LOG`, `_lock`).

These globals are explicitly flagged in-code as not multi-worker-safe
(`api/dependencies.py:122-123`). For an extractable, possibly multi-tenant package they must
be **encapsulated on `app.state`** (one set per `create_app`).

#### 1e. DB wiring & `sp5lib` coupling

- `api/dependencies.py:298-311` — `get_db()` selects backend via
  `sp5lib.db_config.is_postgresql()`: Postgres → `sp5lib.db_factory.get_database()`; else
  `SP5Database(api.main.DB_PATH)`. The DBF branch reaches back into `api.main.DB_PATH`
  (`api/dependencies.py:310-311` `import api.main as _main; return SP5Database(_main.DB_PATH)`)
  — a circular `dependencies → main` import purely to read the configured path.
- `api/main.py:1121-1146` (migration status), `:218-220` (startup auto-migration via
  `sp5lib.auto_migrate.run_startup_migration`) and `dashboard` routes import `sp5lib`
  freely. Coupling to `sp5lib` is **intended** (it's the declared dependency); coupling to
  `api.main.DB_PATH` is **accidental** and is the thing to remove.
- The hard package name `api` is assumed by absolute imports:
  `api/dependencies.py:310`, `api/routers/orm_mirror.py:42,59`,
  `api/routers/companies.py:26`, `api/main.py:297`, `api/routers/admin.py:787`
  (`import api.main` / `from api.rate_limit_store import ...`). Renaming the package to
  `openschichtplaner5_api` requires switching these to relative imports.

#### 1f. Router registration & `/api/v1` → `/api` versioning middleware

- `api/main.py:780-835` — routers are imported and `include_router`-ed in a **fixed order**,
  with comments marking ordering that matters for path precedence (e.g.
  `qualification_matrix` before `employees`, `schedule_comments`/`schedule_pdf` before
  `schedule`). All routers decorate their paths with the literal `/api/...` prefix.
- `api/main.py:670-696` — `api_versioning_middleware` rewrites `request.scope["path"]` from
  `/api/v1/...` to `/api/...` (stripping the 7-char `/api/v1` prefix, `:683`) and adds
  `Deprecation`/`Sunset`/`Link` headers on unversioned `/api/` responses. Docs paths are
  excluded (`:680`). This in-place scope mutation is clever but fragile and bakes the
  `/api` mount prefix into the package.
- Other cross-cutting middleware likewise assumes the `/api/` prefix and a fixed public-path
  set: `auth_middleware` (`:619-662`, `_PUBLIC_PATHS` `:553-563`), `cache_control_middleware`
  (`:373-398`, hard-coded `_CACHEABLE_PREFIXES`), `request_logging_middleware`
  (`:566-616`), `security_headers_middleware` (`:462-467`), `ChangelogMiddleware`
  (`:704-775`). The DEV-mode token is injected into `_sessions` at import (`:123-127`).

---

### 2. Proposed configuration contract

#### 2a. `Settings` object

A single, explicit, immutable config (e.g. a `pydantic.BaseModel` / dataclass). The package
must **not** call `load_dotenv` or read `os.environ` directly; the *host app* may build
`Settings` from env, but the package only consumes the object. Proposed fields (grouped by
the couplings above):

```text
class ApiSettings:
    # --- Database (1e) ---
    db_backend: "dbf" | "postgresql" = "dbf"
    db_path: str | None                 # DBF data dir (replaces api.main.DB_PATH / SP5_DB_PATH)
    database_url: str | None            # Postgres DSN (replaces sp5lib.db_config lookup)
    backend_dir: str | None             # replaces SP5_BACKEND_DIR (passed through to sp5lib)

    # --- CORS / security headers (1a) ---
    allowed_origins: list[str] = ["http://localhost:5173", "http://localhost:8000"]
    csp_report_only: bool = False
    hsts: bool = False

    # --- Auth / sessions (1a, 1d) ---
    jwt_secret: str                      # REQUIRED in prod (no silent random default)
    token_expire_hours: float = 8.0
    max_sessions_per_user: int = 10
    dev_mode: bool = False
    pw_min_length: int = 8
    pw_require_upper: bool = True
    pw_require_digit: bool = True

    # --- Frontend mount (1b) — OFF by default ---
    serve_frontend: bool = False
    frontend_dist: str | None = None     # required iff serve_frontend

    # --- Paths / data (1c) ---
    data_dir: str                        # single injected dir; replaces backend/data + api/data walking
    log_file: str | None = None          # replaces hard-coded /tmp/sp5-api.log
    log_format: "json" | "text" = "json"
    log_level: str = "INFO"
    audit_log_file: str | None = None
    rate_limit_log_file: str | None = None

    # --- Rate limiting / versioning (1f) ---
    api_prefix: str = "/api"             # makes the /api mount injectable
    enable_versioning: bool = True       # /api/v1 -> /api rewrite + deprecation headers
    default_rate_limit: str = "100/minute"
    login_rate_limit: str = "5/minute"
```

#### 2b. `create_app(config: ApiSettings) -> FastAPI` application factory

Replace the module-level `app = FastAPI(...)` (`api/main.py:266`) with a factory that:

1. Builds the `FastAPI` instance (title/version/docs URLs derived from `config.api_prefix`).
2. Instantiates **per-app state** instead of module globals and stores it on `app.state`:
   `app.state.sessions` (was `_sessions`), `app.state.failed_logins`, `app.state.metrics`,
   `app.state.cache`, `app.state.rate_limit_store`, `app.state.limiter`,
   `app.state.settings`. Dependencies/middleware read these via `request.app.state` instead
   of importing module globals — so two `create_app` calls (multi-tenant) no longer share a
   session store.
3. Wires `get_db` as a FastAPI dependency that closes over `config` (no `import api.main` to
   reach `DB_PATH`; no `os.environ["SP5_DB_PATH"]`).
4. Registers routers under `config.api_prefix` (routers stop hard-coding `/api`; use a shared
   `APIRouter(prefix=...)` or `include_router(..., prefix=config.api_prefix)`), preserving
   today's documented ordering (`api/main.py:810-835`).
5. Adds the versioning middleware only if `config.enable_versioning`.
6. Mounts the SPA only if `config.serve_frontend` (default off), using
   `config.frontend_dist`.
7. Reads all knobs from `config`, never from `os.environ`/`load_dotenv`.

The host app's wiring shrinks to roughly:

```python
# backend/api_app.py (stays in THIS repo after P5)
from openschichtplaner5_api import create_app, ApiSettings
settings = ApiSettings.from_env()          # app owns env/.env loading
settings.serve_frontend = True
settings.frontend_dist = ".../frontend/dist"
app = create_app(settings)
```

#### 2c. Target package layout for `openschichtplaner5-api`

```text
openschichtplaner5-api/
  pyproject.toml          # dist=openschichtplaner5-api, dep=libopenschichtplaner5
  src/openschichtplaner5_api/
    __init__.py           # exports create_app, ApiSettings
    app.py                # create_app(config) factory  (was main.py wiring)
    settings.py           # ApiSettings
    state.py              # AppState dataclass put on app.state (sessions/metrics/cache/...)
    dependencies.py       # get_db, auth deps — read request.app.state, not module globals
    security.py           # JWT, password policy, session helpers
    cache.py              # cache bound to app.state (instance, not module global)
    rate_limit_store.py
    schemas.py
    types.py
    middleware/           # auth, versioning, logging, security-headers, changelog, cache-control
    routers/              # absences, admin, auth, ... (prefix injected, not literal /api)
    frontend.py           # optional SPA mount (gated by settings.serve_frontend)
  tests/                  # the package's own suite (P3)
```

---

### 3. Migration outline (P2 – P5) and risks

- **P2 — Repo bootstrap.** `gh repo create mschabhuettl/openschichtplaner5-api` (MIT).
  `pyproject` (dist `openschichtplaner5-api`, dep `libopenschichtplaner5`), README, LICENSE,
  CI mirroring the lib (ruff + pytest matrix + PyPI Trusted Publishing). Prefer
  `git subtree split` / `git filter-repo` to carry `backend/api` history. *No behavioural
  change* — verbatim copy.
- **P3 — App-agnostic refactor.** Introduce `ApiSettings` + `create_app(config)`; move every
  `os.environ`/`load_dotenv` read (1a) behind `Settings`; make the frontend mount opt-in and
  off by default (1b); inject `data_dir`/paths (1c); move globals onto `app.state` (1d);
  drop `import api.main as _main` in favour of config/DI (1e); inject `api_prefix` and gate
  versioning (1f); switch absolute `api.*` imports to relative. Package's own tests green.
- **P4 — First release.** Tag + PyPI publish (Trusted Publishing). Smoke test: a minimal
  third-party app builds an `ApiSettings` and calls `create_app` with `serve_frontend=False`.
- **P5 — App switchover.** `backend/` consumes `openschichtplaner5-api>=…`; delete the local
  `api/` copy; keep only wiring (`create_app` call with frontend on), the frontend, and
  deployment. `make test` / CI stay green; well-documented PR.

**Key risks**

- **Global `_sessions` (and `_failed_logins`, `_metrics`, `cache`).** The single highest-risk
  item: it is imported *by reference* across modules (`api/routers/auth.py:11-19`,
  re-exported at `api/main.py:108-119`) and the test-suite reaches in via
  `from api.main import _sessions` and patches `api.main.DB_PATH` directly
  (`backend/tests/conftest.py:76-84`). Moving it to `app.state` touches auth, every
  middleware, and the test harness at once — must be done atomically with test updates.
- **Versioning middleware (`api/main.py:670-696`).** Rewrites `request.scope["path"]`
  in place and assumes the literal `/api` / `/api/v1` prefixes; making `api_prefix`
  configurable means rederiving the rewrite, the `_PUBLIC_PATHS` set (`:553-563`), the
  `_CACHEABLE_PREFIXES` (`:380-387`), and the docs-path exclusions from `config`.
- **Path assumptions (1c) & `SP5_BACKEND_DIR`.** `sp5lib` itself uses `SP5_BACKEND_DIR` to
  find `backend/data`/`backend/api/data`/alembic (`api/main.py:12-18`,
  `backend/tests/conftest.py:22-23`); the API package must pass an injected `backend_dir`
  through to the lib rather than computing it from its own `__file__`. The two data dirs
  must be reconciled into one injected `data_dir`.
- **`import api.main` circular reach for `DB_PATH`** (`api/dependencies.py:310-311`) and the
  absolute `api.*` import names — mechanical but must all flip to config/DI + relative
  imports, or the renamed package will not import.
- **Behavioural parity / CI green throughout.** Each phase is its own PR and the app CI must
  stay green between them; the `git subtree`/`filter-repo` split (P2) and the eventual
  removal of `backend/api` (P5) are the moments most likely to break imports or tests.

---

## Consequences

**Positive**

- A reusable `openschichtplaner5-api` package usable by third-party projects, mirroring the
  existing reuse of `libopenschichtplaner5`.
- One explicit `Settings` contract instead of ~20 scattered `os.environ` reads; easier to
  document, test, and audit.
- Per-app state on `app.state` enables multiple apps/tenants in one process and removes the
  documented multi-worker hazard (`api/dependencies.py:122-123`).
- This app's `backend/` shrinks to wiring + frontend + deployment.

**Negative / costs**

- Large, cross-cutting refactor of session/global handling with real regression risk
  (mitigated by phasing and keeping CI green per PR).
- A second repo + release pipeline to maintain, and a version-compatibility surface between
  app and package (as already exists for the lib).
- Short-term import churn (relative imports, `app.state` access) across many files.

**Neutral**

- `sp5lib` coupling is preserved and intended; only the *accidental* coupling to
  `api.main.DB_PATH`, the app `.env`, the frontend bundle, and the fixed `/api` prefix is
  removed.
