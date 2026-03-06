# Contributing to OpenSchichtplaner5

Thank you for your interest in contributing! This document explains how to get started, how the CI/CD pipeline works, and which branch protections are in place.

---

## Getting Started

```bash
# Clone the repo
git clone https://github.com/<org>/openschichtplaner5.git
cd openschichtplaner5

# Start the full stack locally
docker-compose up --build

# Or run backend + frontend separately:
cd backend && pip install -r requirements.txt && uvicorn api.main:app --reload
cd frontend && npm install && npm run dev
```

---

## Branch Model

| Branch    | Purpose                             | Protected |
|-----------|-------------------------------------|-----------|
| `main`    | Production-ready, tagged releases   | ✅ Yes     |
| `develop` | Integration branch for new work     | ✅ Yes     |
| `feat/*`  | Feature branches (short-lived)      | ❌ No      |
| `fix/*`   | Bug fix branches                    | ❌ No      |

### Recommended Branch Protection Rules (GitHub Settings → Branches)

For **`main`** and **`develop`**:

- ✅ Require pull request before merging
- ✅ Require at least **1 approving review**
- ✅ Dismiss stale reviews when new commits are pushed
- ✅ Require status checks to pass before merging:
  - `Lint (ruff + eslint)`
  - `Backend Tests (pytest --cov)`
  - `Frontend Tests (vitest)`
  - `Security Audit`
- ✅ Require branches to be up to date before merging
- ✅ Do not allow force pushes
- ✅ Do not allow deletions

---

## CI/CD Pipeline

All pull requests and pushes to `main`/`develop` run the full pipeline defined in `.github/workflows/test.yml`.

### Jobs

#### 1. `lint` — Code Quality
- **Python:** `ruff check` — fast linting + style enforcement
- **TypeScript:** `eslint src` with `--max-warnings=0` (zero warnings allowed)

#### 2. `backend-tests` — Python Tests + Coverage
- Runs `pytest` against `tests/` directory
- Coverage collected for `sp5lib/` and `api/` packages
- Reports: terminal summary + `coverage.xml` (artifact + Codecov upload)
- **Fails if coverage drops below 70%** (`--cov-fail-under=70`)

#### 3. `security` — Dependency Vulnerability Scan
- **Python:** `pip-audit` scans `requirements.txt` for known CVEs
- **Node:** `npm audit --audit-level=critical` blocks on critical vulnerabilities
- Run this locally before pushing: `pip-audit -r backend/requirements.txt` and `npm audit` in `frontend/`

#### 4. `frontend-tests` — TypeScript Tests + Build
- `vitest run --coverage` with `@vitest/coverage-v8` provider
- Coverage output uploaded as artifact (`frontend-coverage-report`)
- Full production build (`npm run build`) must succeed
- TypeScript type-check (`tsc --noEmit`) must pass

### On Tag Push (`v*.*.*`) — Release Pipeline (`.github/workflows/release.yml`)
1. All tests must pass
2. Docker image built for `linux/amd64` + `linux/arm64` and pushed to GHCR
3. Trivy CVE scan on the Docker image
4. GitHub Release created with changelog notes from `CHANGELOG.md`

### On Push to `main` — Docker Pipeline (`.github/workflows/docker.yml`)
- Lint → Build → Push to GHCR as `sha-<commit>` and `main`
- Trivy scan results uploaded to GitHub Security tab

---

## Running Tests Locally

### Backend

```bash
cd backend
pip install -r requirements.txt
pip install pytest pytest-cov pytest-asyncio httpx pip-audit

# Run tests with coverage
python -m pytest tests/ --cov=sp5lib --cov=api --cov-report=term-missing -q

# Security audit
pip-audit -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install

# Run tests with coverage
npm test -- --coverage

# Lint
npm run lint

# Build check
npm run build

# Security audit
npm audit
```

---

## Commit Style

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add shift export to PDF
fix: correct overtime calculation for night shifts
docs: update CONTRIBUTING.md
chore: bump vitest to v4.1
```

This feeds into automatic changelog generation for releases.

---

## Questions?

Open a GitHub Discussion or file an issue. We're happy to help!
