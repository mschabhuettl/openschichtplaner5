> **Hinweis (2026-06):** Historisches Prozess-Protokoll autonomer Arbeitsläufe —
> beschreibt teils überholte Zustände (z. B. lokale `backend/api`-Module vor der
> API-Extraktion). Nicht als aktuelle Architektur-Referenz verwenden;
> siehe stattdessen `docs/architecture.md`.

# ANALYSIS — OpenSchichtplaner5 (Phase 0)

Stand: 2026-05-26. Basierend auf Code-Review (Backend, sp5lib, Frontend) plus
ausgeführter Baseline (Tests/Lint/Coverage). Befunde, die in nachfolgenden Phasen
behoben werden, sind mit `[→ Phase N]` markiert.

## 1. Architektur

Monorepo, zwei Hälften + Docker-Orchestrierung:

- **`backend/`** — FastAPI + SQLAlchemy 2.0 + Alembic auf `:8000`.
  - `api/` — FastAPI-App: `main.py` (Entry, mountet Router + gebautes Frontend,
    Middleware-Kette), 25 Router unter `routers/`, `schemas.py` (Pydantic),
    `dependencies.py` (Auth/JWT/RBAC/Rate-Limit), `cache.py`, `rate_limit_store.py`.
  - `sp5lib/` — Kernbibliothek: `dbf_reader.py`/`dbf_writer.py` (DBF-Bridge),
    `database.py` (große Fassade über DBF), `pg_database.py`/`sqlite_adapter.py`/
    `db_factory.py` (DB-Abstraktion), `orm/` (`models.py` SQLite, `models_pg.py`
    Postgres, `repository.py`, `sync.py`), `email_service.py`, `auto_migrate.py`.
  - **Dual-DB:** SQLite (Default/Dev) oder PostgreSQL (Prod); `db_factory.py` wählt.
  - **Auth/Security:** bcrypt, 2FA (pyotp), JWT, Login-Rate-Limiting + Brute-Force-Lockout.
- **`frontend/`** — React 18 + TS 5 + Vite + Tailwind, react-router-dom, recharts.
  ~78 Seiten unter `src/pages/`, geteilte Komponenten unter `src/components/`.
  Unit: vitest (`src/__tests__/`), E2E: Playwright (`e2e/`).

## 2. Datenfluss & DBF-Bridge

Die definierende Eigenschaft: Lesen **und Schreiben** der originalen FoxPro-`.DBF`.

- **Lesen** (`dbf_reader.py`): Header + Felddeskriptoren parsen, Records dekodieren.
  Heuristische UTF-16-LE-Erkennung pro Feld (`_is_utf16_le`), Datums-Parser
  `_parse_date` (validiert Tag 1–31, aber **nicht** monatsspezifisch → akzeptiert
  z. B. `2023-02-31`) `[→ Phase 3]`.
- **Schreiben** (`dbf_writer.py`): `append_record`/Update über `_encode_field`.
  Exklusiver `flock`, Re-Read des Record-Counts im Lock (TOCTOU-sicher), EOF-Marker
  bleibt erhalten, Rollback bei Schreibfehler — solide. **Aber:** numerischer
  Overflow wird still abgeschnitten (`s.encode("ascii")[:flen]`), wodurch
  höchstwertige Stellen wegfallen und sich die Größenordnung ändert `[→ Phase 3]`.
- **DB-Abstraktion:** `db_factory` wählt SQLite/PG. SQLite ist Default; die DBF bleibt
  die kanonische Quelle für Interop mit dem Windows-Client. ORM-Modelle
  (`models.py`/`models_pg.py`) und `to_dict()` divergieren im Feldumfang `[→ Phase 3/4]`.

## 3. API-Oberfläche

25 Router. Authentifizierung via globaler `auth_middleware` (alle `/api/*` außer
Public-Allowlist). RBAC über `require_auth`/`require_planer`/`require_admin`
(`dependencies.py`). API-Versionierung: `/api/v1/` (Middleware schreibt `scope["path"]`
vor der Auth-Middleware um — Reihenfolge korrekt verifiziert). Rate-Limiting via slowapi
auf sensiblen Auth/Admin/Export/Email-Endpunkten, globaler Default `100/minute`.

**RBAC-Lücken gefunden** (write-Endpoints ohne Rollenprüfung):
- `availability.py` POST/PUT `/api/employees/{id}/availability` — jeder
  authentifizierte Nutzer (auch `Leser`) kann fremde Verfügbarkeiten überschreiben `[→ Phase 4]`.
- `schedule.py` DELETE `/api/restrictions/{emp}/{shift}` — kein Rollen-Dependency,
  obwohl das passende POST `require_admin` verlangt (asymmetrisch) `[→ Phase 4]`.

## 4. Baseline (gemessen 2026-05-26)

| Check | Ergebnis |
|---|---|
| Backend `pytest` | **2234 passed, 6 skipped** (40 s) |
| Backend `ruff check` | **clean** |
| Backend `mypy` | 8 Fehler (nicht-blockierend, `make lint` schluckt sie) `[→ Phase 3]` |
| Backend Coverage | **79 %** (6189/7808 stmts) |
| Frontend `vitest` | **378 passed** (33 Dateien) |
| Frontend `tsc -b` | **clean** |
| Frontend `eslint` | 0 errors, 2 react-refresh warnings |

Umgebungshinweis: nur Python 3.14 verfügbar (Projekt zielt 3.12). Tests laufen grün;
nur einzelne Deprecation-Warnings (slowapi `asyncio.iscoroutinefunction`).

## 5. Priorisierter Befund

### Sicherheit / Korrektheit (hoch)
1. **RBAC: availability writes ungeschützt** — `availability.py:159,188`. `[→ Phase 4]`
2. **RBAC: restriction DELETE ungeschützt** — `schedule.py:984` (POST verlangt admin). `[→ Phase 4]`
3. **E-Mail-HTML-Injection** — `email_service.py:105-131` injiziert `title`/`message`
   unescaped → stored XSS in Mails. Link-Schema nicht validiert. `[→ Phase 3]`
4. **DBF numerischer Overflow** — `dbf_writer.py:120` schneidet still ab → Datenkorruption. `[→ Phase 3]`
5. **Falsche Dict-Keys** — `misc.py:795,1103,1158` nutzen `Vorname`/`Nachname` statt
   `FIRSTNAME`/`NAME`; Tausch-Benachrichtigungen zeigen nie den echten Namen. `[→ Phase 3]`

### Korrektheit / Konsistenz (mittel)
6. **ORM SQLite/PG `to_dict()` divergiert** — PG-Backend liefert reduzierten Feldsatz
   (fehlende BIRTHDAY/Adresse/NOTE/Farben). `sync.py` synct Farben/Calc nicht. `[→ Phase 4]`
7. **mypy: 8 Typfehler** — u. a. `Image.LANCZOS`-Typing (Laufzeit ok in Pillow 12),
   `_save_bcrypt_hash`/`invalidate_sessions_for_user` Arg-Typen, `walk_revisions`-Args. `[→ Phase 3]`
8. **schemas.py Feldnamen** — `GroupResponse`/`EmployeeResponse` deklarieren nicht
   existente Felder (`HIDDEN`/`EMPLOYEENO`/`CONTRACTHOURS`); OpenAPI irreführend. `[→ Phase 4]`
9. **DBF-Datumsvalidierung** — akzeptiert unmögliche Daten (`_parse_date`). `[→ Phase 3]`
10. **Cache nicht tenant-scoped** — `cache.py`/employees/groups-Keys ohne Company-Teil
    (latent, solange Single-DB). `[→ Phase 4, dokumentiert]`

### Frontend (Phase 5)
11. **Dark-Mode-Lücken** — `StatCard`, `Badge`, `PageHeader` ohne `dark:`-Varianten. `[→ Phase 5]`
12. **A11y** — 604 `<th>` ohne `scope`; `LoadingSpinner`/`Skeleton` ohne `role="status"`;
    Modals (`FormModal`/`ConfirmDialog`) restaurieren Fokus nicht. `[→ Phase 5]`
13. **Race Conditions** — `useApiData`/`Schedule`-Loader ohne Staleness-Guard
    (keine AbortController im Code). `[→ Phase 5]`
14. **Fehlende Error-States** — `MitarbeiterVergleich`, `Geburtstagkalender`,
    `DienstBoard` ohne `.catch()`/Fehler-UI. `[→ Phase 5]`
15. **Performance** — große Matrizen/Grids ohne `useMemo`/Virtualisierung. `[→ Phase 5]`

### Hinweis (kein Bug)
- `Image.LANCZOS` (`employees.py:659`) ist mit installiertem Pillow 12.1.1 ein gültiger
  Alias — kein Laufzeitfehler. Migration auf `Image.Resampling.LANCZOS` nur kosmetisch.

### Tech-Debt / Deployment
- JWT-Secret wird ohne `SP5_JWT_SECRET` pro Prozess neu generiert → Multi-Worker bricht;
  In-Memory-Stores (`_sessions`, `_failed_logins`, Cache) nicht prozessübergreifend.
- Venv-Inkonsistenz: `start.sh` nutzt `backend/.venv`, `make` nutzt `backend/venv`. `[→ Phase 3]`

## 6. Arbeitsplan (abgeleitet)

- **Phase 3:** Befunde 3,4,5,7,9 fixen (failing test → fix), venv-Vereinheitlichung.
- **Phase 4:** Befunde 1,2,6,8,10 + voller Router-/sp5lib-Audit → AUDIT.md, Tests.
- **Phase 5:** Befunde 11–15, abgesichert mit vitest/Playwright.
- **Phase 6:** sp5lib in eigenes pip-Paket `libopenschichtplaner5` auslösen (Historie erhalten).
- **Phase 7:** Branch-Cleanup (gemergte/verwaiste Branches).
