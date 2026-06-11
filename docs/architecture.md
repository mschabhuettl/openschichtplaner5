# Architektur — openschichtplaner5 (App-Repo)

> Stand: 2026-06-10, Branch `main` (Commit `aaa6586`). Version laut README/Frontend: **1.1.0**, MIT.
> Dieses Dokument beschreibt den **IST-Zustand** dieses Repos; die Schwester-Repos
> [`libopenschichtplaner5`](https://github.com/mschabhuettl/libopenschichtplaner5) (Import: `sp5lib`) und
> [`openschichtplaner5-api`](https://github.com/mschabhuettl/openschichtplaner5-api) (Import: `sp5api`)
> werden nur an ihren Schnittstellen betrachtet.

---

## 1. Zweck & Architektur

### 1.1 Zweck

OpenSchichtplaner5 ist der quelloffene, browserbasierte Ersatz für die proprietäre
Windows-Software **Schichtplaner5**. Alleinstellungsmerkmal: Die Anwendung liest **und
schreibt** die originalen `.DBF`-Datenbankdateien (FoxPro) direkt — beide Programme können
parallel auf denselben Daten arbeiten, ohne Migration.

Dieses Repo ist nach der Library- und API-Extraktion die **App-Schale**: Es enthält das
React-Frontend, das Deployment (Docker/nginx/Compose), die Entwickler-Tooling-Schicht
(Makefile, `start.sh`, CI) sowie den **Ressourcen-Root `backend/`** für die beiden
extern bezogenen Python-Pakete. **Es enthält keinen Python-Anwendungscode mehr** (außer
Hilfsskripten und Alembic-Wiring).

### 1.2 Drei-Repo-Architektur und Schichten

```
Browser (React-SPA, frontend/dist)
   │  REST /api/v1/*  +  SSE /api/v1/events  (Bearer-JWT)
   ▼
uvicorn → sp5api.main:app          ← Paket openschichtplaner5-api (eigenes Repo, PyPI)
   │  FastAPI, Router, Auth/2FA/RBAC, Rate-Limit, Reports/Exports
   ▼
sp5lib                              ← Paket libopenschichtplaner5 (eigenes Repo, PyPI)
   │  DBF-Reader/-Writer, DB-Fassade, ORM (SQLite/PostgreSQL), Sync, Auto-Migrate, E-Mail
   ▼
Daten:  .DBF-Dateien (kanonisch, Interop mit Original-SP5)
        + SQLite (Default) oder PostgreSQL (optional, Alembic-Migrationen)
        + JSON-Laufzeit-State unter backend/data + backend/api/  (Wishes, Skills,
          Webhooks, Notification-Settings, Changelog, Foto-Uploads, …)
```

### 1.3 Module dieses Repos

| Pfad | Inhalt / Rolle |
|---|---|
| `frontend/` | React 19 + TypeScript 5 + Vite 7 + Tailwind 3 SPA; 77 Seiten, 34 geteilte Komponenten, 15 Hooks, 4 Contexte, i18n (de/en), PWA (`public/sw.js`, `manifest.json`, `offline.html`); Tests: vitest (52 Testdateien) + Playwright (15 E2E-Specs) |
| `backend/` | **Kein App-Code.** Ressourcen-Root, den `sp5api`/`sp5lib` über `SP5_BACKEND_DIR` auflösen: `alembic/` (PG-Migrationen), `data/` + `api/data` + `api/uploads` (JSON-State-Seeds), `fixtures/` (DBF-Fixtures für CI/E2E), `requirements.txt`, `scripts/` (PG-Migrations-/Seed-Skripte) |
| `nginx/` | Prod-Reverse-Proxy-Image (`Dockerfile`, `nginx.conf`): statisches Frontend, `/api/`-Proxy, Gzip, Security-Header, SSL-ready (Certbot-Webroot) |
| `scripts/` | `seed_demo_data.py`, `generate_demo_schedule.py` (Demo-/Screenshot-Daten via `sp5lib`) |
| `docs/` | `API.md`, `DEPLOYMENT.md`, `DEVELOPMENT.md`, `POSTGRESQL.md`, `ROADMAP.md`, `adr/0001-api-extraction.md`, `screenshots/` (81 Dateien) |
| Repo-Root | `Makefile`, `start.sh`, `Dockerfile`, `docker-compose.yml`, `docker-compose.prod.yml`, `.env.example`, `take_screenshots.py`, CI unter `.github/workflows/` |

Das Root-`pyproject.toml` enthält **nur Ruff-Konfiguration** — dieses Repo veröffentlicht
kein Python-Paket.

### 1.4 Datenflüsse

- **Lesen/Schreiben:** SPA → typisierter Client (`frontend/src/api/client.ts`, ~2300 Zeilen)
  → `/api/v1/*`. Der Client bringt mit: 60-s-TTL-Cache für ausgewählte GET-Pfade mit
  Prefix-Eviction bei Mutationen, Auto-Retry bei Netzfehlern (2 Versuche, Backoff),
  429-Handling (`RateLimitBanner`), Session-Expiry-Events, API-Versions-Check
  (`checkApiCompatibility` → Banner bei zu altem Backend).
- **Echtzeit:** SSE über `EventSource` auf `/api/v1/events?token=…`
  (`frontend/src/hooks/useSSE.ts`, `SSEContext`); Events wie `schedule_changed`,
  `conflict_updated`, `note_*` triggern gezielte Refreshes (`useSSERefresh`).
- **Auth:** Login (`/api/v1/auth/login`, optional 2FA/TOTP) → Bearer-JWT; Rollen
  Admin/Planer/Leser werden doppelt durchgesetzt: Backend (403) und Frontend
  (`RoleRoute`, ausgeblendete Nav-Items/Buttons). Dev-Mode (`SP5_DEV_MODE`) erlaubt
  Auth-Bypass + Rollen-Simulation (`DevRoleSwitcher`).
- **Konfiguration:** Eine `.env` im Repo-Root (aus `.env.example`) wird von `start.sh`
  **und** von beiden Compose-Dateien (`env_file: .env`) gelesen. `SP5_BACKEND_DIR`
  (gesetzt von `start.sh`, Dockerfile, CI) ist der Ressourcen-Vertrag zu den Paketen;
  das gebaute SPA wird über `SP5_FRONTEND_DIST` gefunden (Default
  `SP5_BACKEND_DIR/../frontend/dist`).
- **Build/Serve:** `vite build` (+ SRI-Injektion via `frontend/scripts/add-sri.mjs`);
  im Default-Deployment served `sp5api` das SPA selbst (SPA-Fallback), im
  Prod-Compose übernimmt nginx Statik + Proxy.

---

## 2. Öffentliche Schnittstelle

### 2.1 Frontend-Routen (SPA, `frontend/src/App.tsx`)

Alle 77 Seiten sind lazy-geladen, jede Route in `PageErrorBoundary`+`Suspense` gekapselt.
Rollen in Klammern = `RoleRoute`-Beschränkung (ohne Angabe: alle Rollen).

**Kernplanung (Original-SP5-Ansichten — alle vier vorhanden):**

| Route | Seite | Inhalt |
|---|---|---|
| `/schedule` | `Schedule.tsx` (5876 Z.) | **Dienstplan** — Monatsraster MA×Tag, Kalenderansicht, Drag&Drop, Undo/Redo, Vorlagen, Kopier-/Bulk-Funktionen, Tageskommentare, Konflikt-/Coverage-Anzeige, Druck/CSV |
| `/einsatzplan` (A/P) | `Einsatzplan.tsx` (1734 Z.) | **Einsatzplan** — Sonderdienste/SPSHI + Abweichungen (Kontextmenü „Sonderdienst/Abweichung“), Wochenraster |
| `/jahresuebersicht` | `Jahresuebersicht.tsx` | **Jahresübersicht** — 12 Monate × Mitarbeiter (Schichten, Ist/Soll), Druck-HTML |
| `/personaltabelle` (A/P) | `Personaltabelle.tsx` | **Personaltabelle** — sortierbare Statistik (Soll/Ist/Differenz, Schichten, Urlaub, Krank), CSV-Export |

**Weitere Planung:** `/wochenansicht`, `/schichtmodell` (A/P), `/recurring-shifts` (A/P),
`/personalbedarf` (A/P), `/schichtbriefing`.

**Abwesenheiten:** `/urlaub` (A/P), `/absence-stats` (A/P), `/urlaubs-timeline`,
`/employee-timeline` (A/P), `/schichtwuensche`, `/tauschboerse`.

**Zeitwirtschaft:** `/zeitkonto` (A/P), `/ueberstunden` (A/P), `/overtime-dashboard` (A/P),
`/kontobuchungen` (A/P), `/statistiken` (A/P), `/work-time-rules` (A/P).

**Ansichten:** `/leitwand` (A/P, TV-Modus), `/dienst-board` (A/P), `/teamkalender`,
`/team` (A/P), `/geburtstagkalender`.

**Werkzeuge:** `/notfall-plan` (A/P), `/uebergabe` (A/P), `/simulation` (A/P),
`/verfuegbarkeits-matrix` (A/P), `/notizen` (A/P), `/jahresabschluss` (A/P).

**Berichte/Analysen:** `/jahresrueckblick`, `/mitarbeiter-vergleich`, `/mitarbeiter[/:id]`,
`/fairness`, `/rotations-analyse`, `/kapazitaets-forecast`, `/qualitaets-bericht`,
`/conflict-report`, `/schicht-kalibrator`, `/kompetenz-matrix`, `/analytics`,
`/berichte`, `/export` (alle A/P), `/import` (Admin).

**Stammdaten (A/P):** `/employees` (+ `/employees/:id/timeline`), `/groups`, `/shifts`,
`/leave-types`, `/holidays`, `/workplaces`, `/extracharges`, `/einschraenkungen`.

**Administration (Admin, sofern nicht anders):** `/companies`, `/benutzerverwaltung`,
`/backup`, `/perioden`, `/einstellungen`, `/email-settings`, `/protokoll`, `/webhooks`,
`/export-scheduler`, `/rate-limits`, `/health`, `/orm-mirror`; `/auditlog` (A/P);
`/onboarding`, `/druckvorschau`, `/changelog` (alle).

**Selbstservice/Allgemein:** `/` (Dashboard), `/konflikte`, `/mein-profil`,
`/mein-kalender`, `/notification-settings`, `/benachrichtigungen`, `/login`, `*` (404).

### 2.2 Konsumierte REST-API (definiert im API-Repo, hier vollständig genutzt)

Der typisierte Client (`frontend/src/api/client.ts`) spricht ausschließlich `/api/v1/`
(Legacy-`/api/` ist deprecated, Deprecation-Header). Genutzte Endpunkt-Familien —
das ist zugleich die vollständige Konsum-Oberfläche der App:

- **Auth:** `auth/login`, `auth/change-password`, `auth/2fa/{setup,enable,disable,status,admin-disable/{id}}`
- **Stammdaten:** `employees` (CRUD, `bulk`, `{id}/activate`, `{id}/availability`, Fotos),
  `groups` (CRUD, `{id}/members`), `shifts`, `leave-types`, `holidays`, `workplaces`
  (inkl. `{id}/employees`), `extracharges` (inkl. `summary`), `restrictions`, `companies`,
  `periods`, `users` (inkl. `change-password`, `reset-password`)
- **Planung:** `schedule` (CRUD, `bulk`, `bulk-group`, `copy-week`, `generate`, `swap`,
  `day`, `week`, `year`, `conflicts`, `coverage`, `comments`, `templates` inkl.
  `capture`/`apply`), `einsatzplan` (+ `deviation`), `shift-cycles` (+ `assign`,
  `cycle-exceptions`), `shifts/recurring` (+ `{id}/generate`),
  `staffing-requirements` (+ `special`), `work-time-rules` (+ `check`, `check-all`)
- **Abwesenheit/Zeit:** `absences` (CRUD, `bulk`, `status`, `stats/{overview,group/…,employee/…}`),
  `leave-entitlements`, `leave-balance` (+ `group`), `annual-close` (+ `preview`),
  `bookings` (+ `carry-forward`, `annual-statement`), `zeitkonto` (+ `detail`, `summary`),
  `overtime-summary`
- **Selbstservice:** `me/employee`, `self/schedule`, `self/absences`, `self/wishes`,
  `self/swap-requests` (+ `respond`), `wishes`, `swap-requests` (+ `resolve`), `handover`, `notes`
- **Analysen/Reports:** `statistics` (+ `employee/{id}`, `shifts`, `sickness`,
  `year-summary`), `stats`, `dashboard/{today,upcoming,stats,summary}`, `fairness`,
  `burnout-radar`, `capacity-forecast`, `capacity-year`, `quality-report`,
  `reports/conflicts`, `simulation`, `warnings`, `search`
- **Benachrichtigung/Integration:** `notifications` (+ `settings`, `read-all`, `all`),
  `webhooks` (+ `events/list`, `{id}/test`), `export-scheduler/schedules` (+ `{id}/run`),
  `ical`-Feeds (Token-basiert), `events` (SSE)
- **Skills:** `skills`, `skills/assignments`, `skills/matrix`
- **System/Admin:** `settings`, `changelog`, `release-notes`, `errors`,
  `admin/compact`, `admin/backups` (+ Restore/Delete), `/api/admin/orm/{status,sync}`
  (unversioniert!), `health`, `version`

Swagger/ReDoc unter `/docs` bzw. `/redoc` (vom API-Paket geliefert).

### 2.3 CLI-/Betriebsoberfläche

**Makefile** (Repo-Root): `dev`, `dev-link`, `docker`, `docker-down`,
`test`, `lint`, `build`, `clean`, `logs`, `stop`, `prod`, `prod-secure`, `update`,
`backup`, `help`.

**`start.sh`:** `--help`, `--no-browser`, `--build`, `--stop`. Macht: Dependency-Check →
`.env` anlegen + `SECRET_KEY` generieren → `backend/.venv` + `pip install` →
Frontend-Build (nur bei Änderung) → `uvicorn sp5api.main:app` mit `SP5_BACKEND_DIR`
(PID-Datei `/tmp/sp5-backend.pid`).

**Python-Skripte:** `scripts/seed_demo_data.py` (Demo-MA/Gruppen/Schichten),
`scripts/generate_demo_schedule.py <daten_dir>` (realistischer Demo-Plan, idempotent),
`backend/scripts/seed_postgresql.py` (DBF → PostgreSQL Voll-Sync),
`backend/scripts/migrate_add_company.py` (idempotente Company-Migration),
`take_screenshots.py` (Playwright-Screenshots aller Seiten → `docs/screenshots/`),
`backend/alembic/` (`alembic upgrade head`, `DATABASE_URL`-Override in `env.py`).

**npm** (`frontend/`): `dev`, `build` (tsc -b + vite + SRI), `lint`, `preview`, `test`,
`test:watch`, `test:e2e`, `test:coverage`.

**Docker-Images:** `ghcr.io/mschabhuettl/openschichtplaner5:{latest,<semver>,sha-…}`
(amd64+arm64), ASGI-Entrypoint `sp5api.main:app`, Port 8000, Healthcheck `/api/health`.

---

## 3. Was ist implementiert (Feature-Inventur IST-Stand)

- **Dienstplanung komplett:** Monats-/Wochen-/Kalenderansicht, Drag&Drop, Undo/Redo
  (`useUndoRedo` + `UndoRedoStatus`), Planvorlagen (capture/apply), Auto-Planner
  (`schedule/generate`), wiederkehrende Schichten, Schichtzyklen inkl. Ausnahmen,
  Personalbedarf inkl. Sonderbedarf, Tageskommentare mit Inline-Editor.
- **Die vier Original-SP5-Ansichten existieren:** Dienstplan, Einsatzplan (SPSHI/
  Sonderdienste + Abweichungen), Jahresübersicht, Personaltabelle (siehe 2.1).
- **Abwesenheits-/Urlaubsverwaltung:** Anträge + Genehmigungsworkflow, Ansprüche,
  Jahresabschluss (Preview + Close), Urlaubs-Gantt, Abwesenheitsstatistiken,
  Feiertags-Sperren (`holiday-bans`).
- **Zeitwirtschaft:** Zeitkonto, Kontobuchungen inkl. Übertrag/Jahresauszug, Überstunden
  + Dashboard, konfigurierbare Arbeitszeitregeln (max h/Tag, Ruhezeit, max. Folgetage)
  mit Verletzungs-Highlighting.
- **Selbstservice:** Mein Kalender, Mein Profil, Schichtwünsche, Tauschbörse mit
  Benachrichtigungen/Auto-Expiry, iCal-Abo (tokenbasiert).
- **Analysen/Reports:** Dashboard mit Live-Charts (recharts), 20+ Berichtstypen,
  CSV/XLSX-Downloads, Druck-Stylesheets, Fairness-Score, Burnout-Radar,
  Kapazitäts-Forecast, Qualitäts-/Konfliktberichte, Rotationsanalyse,
  Kompetenz-/Verfügbarkeitsmatrix, Jahresrückblick, MA-Vergleich, geplante
  E-Mail-Exporte (Export-Scheduler-CRUD).
- **Sicherheit/Verwaltung:** RBAC (Admin/Planer/Leser), 2FA (TOTP) inkl.
  Admin-Disable, Benutzerverwaltung, Audit-Log, Protokoll/Changelog, Rate-Limit-
  Dashboard, System-Health, Backup&Restore (UI + `make backup`), ORM-Spiegel-Admin
  (SQLite/PG-Sync-Status), Firmenverwaltung, Webhooks, E-Mail-Einstellungen (SMTP).
- **UX/Infrastruktur:** Dark Mode, i18n de/en (`src/i18n/`), Spotlight-Suche (Ctrl+K) +
  globale Suche, Keyboard-Shortcuts + Hilfe-Modal, geführte Tour + First-Time-Wizard +
  Onboarding-Checkliste, PWA (Service Worker, Offline-Seite, Install-Banner),
  Offline-/Backend-unreachable-/API-Versions-Banner, A11y (Fokus-Traps, Live-Regions,
  Skip-Link, `th scope`), Mobile (BottomNav, Drawer).
- **Qualitätssicherung:** 52 vitest-Testdateien (`frontend/src/__tests__/`), 15
  Playwright-Specs (`frontend/e2e/`, Auth-Setup mit 3 Rollen-Sessions, CI gegen
  DBF-Fixtures aus `backend/fixtures/` mit `SP5_DEV_MODE=1`); CI (`test.yml`):
  ruff, ESLint+Build, pip-audit/npm-audit, vitest+Coverage, E2E; `docker.yml`:
  Lint → Multi-Arch-Build → ghcr-Push → Trivy-Scan (wöchentlicher Rebuild);
  `release.yml`: Tag → Tests → Image (semver+latest) → GitHub-Release aus CHANGELOG.
- **Deployment:** Default-Compose (1 Container, `read_only`-RootFS, Named Volumes
  `sp5_data`/`sp5_state`/`sp5_api_state`/`sp5_backups`, Ressourcen-Limits, Healthcheck);
  Prod-Compose (nginx + Backend nur `expose`, `init-frontend`-One-Shot kopiert das
  SPA in ein Shared Volume, SSL/Certbot vorbereitet); Auto-DB-Migration beim Start
  (sp5lib `auto_migrate`); dualer DB-Backend SQLite (Default) / PostgreSQL
  (Alembic: eine Initial-Migration `a7d24c64d83e`).

**Nicht (mehr) in diesem Repo implementiert:** sämtliche REST-/Auth-/Report-Logik
(→ API-Repo, inkl. pytest-Suite) und die DBF-/ORM-/Sync-/E-Mail-Schicht (→ Lib-Repo).

---

## 4. Cross-Repo-Verdrahtung

### 4.1 Konsum über PyPI (Normalbetrieb)

`backend/requirements.txt` ist die einzige Dependency-Quelle:

- `openschichtplaner5-api>=1.1.1` — REST-Schicht, importierbar als `sp5api`;
  zieht FastAPI/uvicorn/pydantic selbst nach. ASGI-Entrypoint überall
  `sp5api.main:app` (start.sh:302, Dockerfile:45, CI `test.yml` E2E-Job, Doku).
- `libopenschichtplaner5[postgres]>=1.6.0` — **direkte** Dependency (nicht nur
  transitiv), weil `scripts/` und `backend/alembic/env.py` `sp5lib` ohne Umweg über
  das API-Paket importieren.
- dazu `python-dotenv` (Seed-Skript) und `ruff` (Lint).

Historie: erst Git-Dependency (`git+https…@main`, PR #61/#339f), seit
`50bbc9c`/`00688c6` PyPI-Releases mit `>=`-Pins (floatende Minor-Updates).

### 4.2 Editable-Workflow für Co-Entwicklung (`make dev-link`)

```
cd backend && pip install -e "../../libopenschichtplaner5[postgres]" -e ../../openschichtplaner5-api
```

erwartet beide Repos als **Geschwister** neben diesem Repo (`../libopenschichtplaner5`,
`../openschichtplaner5-api`); Änderungen dort wirken ohne Reinstall. Beschrieben auch in
`docs/DEVELOPMENT.md` („Working on all three repos“).

### 4.3 Laufzeit-Vertrag `SP5_BACKEND_DIR` / `SP5_FRONTEND_DIST`

Da die Pakete in `site-packages` liegen, zeigen `start.sh` (Z. 269), das Dockerfile
(`ENV SP5_BACKEND_DIR=/app/backend`) und CI auf `backend/` dieses Repos. Darüber finden
die Pakete: `backend/data` + `backend/api/data` + `backend/api/uploads` (JSON-State,
Fotos), `backend/alembic` (Auto-Migrate), `backend/backups`. Das gebaute SPA wird über
`SP5_FRONTEND_DIST` (Default `SP5_BACKEND_DIR/../frontend/dist`) gemountet — d. h. das
API-Paket served das Frontend dieses Repos.

### 4.4 Richtung der Abhängigkeiten und Test-Verteilung

App → API → Lib (die App wird von keinem der beiden Pakete referenziert). Backend-pytest
lebt im API-Repo (`cd ../openschichtplaner5-api && pytest`), Lib-Tests im Lib-Repo;
`make test` hier fährt nur vitest + Playwright. `docs/adr/0001-api-extraction.md`
dokumentiert die Extraktion (Kopplungsinventar, `create_app(config)`-Zielbild, Phasen
P1–P5).

---

## 5. Known Issues

Bekannte Schwachstellen und Altlasten, mit Pfadangaben; Reihenfolge ≈ Schwere.

1. **SSE-Pfad-Mismatch im Prod-nginx (funktionaler Bug).** Der echte SSE-Endpunkt ist
   `/api/v1/events` (`frontend/src/hooks/useSSE.ts:69`), nginx puffert aber nur
   `location /api/sse` nicht (`nginx/nginx.conf:115`). Live-Updates laufen damit durch
   den generischen `/api/`-Block mit `proxy_buffering on` und `proxy_read_timeout 60s`
   (`nginx/nginx.conf:103-113`) → SSE hinter dem Prod-Proxy verzögert/zwangsgetrennt.
   Dasselbe falsche `location /api/sse`-Beispiel steht in `README.md:252-260`.
2. **`make docker-dev` / `sp5-dev`-Profil ist seit der API-Extraktion ein toter Pfad.**
   *Behoben (Phase 7):* Profil, Makefile-Target und README-Zeile entfernt — lokale
   Entwicklung läuft über `start.sh`/`make dev`, Docker ist reiner Produktionspfad.
3. **`backend/.env.docker` ist tote/staubige Konfiguration.** Keine Compose-Datei
   referenziert sie (beide nutzen `env_file: .env`), sie enthält `APP_VERSION=0.9.5`
   (Repo ist 1.1.0) und Frontend-`VITE_*`-Variablen ohne Wirkung. `README.md:158-160`
   instruiert trotzdem, diese Datei zu editieren — widerspricht `.env.example:6-8`
   („.env lebt im Repo-Root“).
4. **README-/Doku-Drift:**
   - „React 18“ (`README.md:362`, Badge Z. 16) vs. tatsächlich
     `react ^19.2.0` (`frontend/package.json:17`).
   - „33 pages“ (`README.md:347-349`) vs. real 77 Seiten-Komponenten in
     `frontend/src/pages/`; „30 pages“ Screenshots vs. 81 Dateien in `docs/screenshots/`.
   - `docs/API.md` nutzt in allen Beispielen die **deprecateten** unversionierten
     Pfade (`/api/auth/login`, Z. 37 ff.), obwohl dieselbe Datei `/api/v1/` als
     verbindlich erklärt; sie deckt zudem nur ~8 Themenblöcke der „162+ Endpunkte“ ab.
   - Tech-Stack-Tabelle nennt „pytest (backend)“ (`README.md:369`), die Suite liegt
     aber im API-Repo.
5. **Build-Artefakt im Git: `frontend/coverage/`** (HTML/`coverage-final.json`,
   committed seit ~v0.9.7). Der Stand ist veraltet — er kennt nur 7 Seiten von heute 77.
   `.gitignore` ignoriert `htmlcov/`, aber nicht `frontend/coverage/`. Außerdem enthält
   `.gitignore:44-56` doppelte „Runtime data“-Blöcke (Copy-Paste).
6. **`.vscode/` ist gitignoriert (`.gitignore:45`), aber `settings.json`/`extensions.json`
   sind getrackt** — vor der Ignore-Regel hinzugefügt; Ignore greift für getrackte
   Dateien nicht.
7. **ADR-Status veraltet:** `docs/adr/0001-api-extraction.md:3` steht auf „Proposed“,
   obwohl die Extraktion (P5) abgeschlossen ist und die App das Paket konsumiert.
8. **Doppelter Laufzeit-State (bekannte, bewusst vertagte Schuld aus ADR 0001 §1c):**
   zwei Datenverzeichnisse `backend/data/` **und** `backend/api/data/` —
   `skills.json` existiert in beiden (`backend/data/skills.json`,
   `backend/api/data/skills.json`) —, dadurch zwei Volumes (`sp5_state`,
   `sp5_api_state`) statt eines injizierten `data_dir`. Zudem sind zwei
   Demo-Foto-Uploads als „Seeds“ committed (`backend/api/uploads/photos/40.webp`, `41.webp`).
9. **In-Memory-Session-Store → Single-Worker-Zwang.** Mehrere uvicorn-Worker erzeugen
   zufällige 401 (dokumentiert in `README.md:125-128`, `docs/DEVELOPMENT.md`);
   Redis-Alternative existiert nicht. Betriebs-Einschränkung, kein Bug.
10. **Frontend-Typen-Doppelstruktur:** `frontend/src/types.ts` re-exportiert
    `frontend/src/types/index.ts` (Datei gewinnt bei `'../types'` gegen das
    gleichnamige Verzeichnis) — funktioniert, ist aber fragil benannt; der Großteil der
    Response-Typen lebt zusätzlich direkt in `api/client.ts`.
11. **Kleinigkeiten:** Dateiname mit Umlaut `frontend/src/pages/VerfügbarkeitsMatrix.tsx`
    (potenzielle Encoding-Stolperfalle auf Fremdsystemen); `Makefile:42-63` schluckt
    Fehler (`2>/dev/null`, `|| true` bei ruff/mypy — Lint kann nie fehlschlagen);
    `make lint` mypy-t das **installierte** `sp5api`-Paket statt Repo-Code; der
    ORM-Spiegel-Client nutzt als einziger unversionierte Pfade
    (`/api/admin/orm/*`, `frontend/src/api/client.ts`); `take_screenshots.py` braucht
    Playwright, das nicht in `backend/requirements.txt` deklariert ist (bewusst dev-only).

---

## Anhang: Schnellreferenz Betrieb

| Szenario | Befehl | Ergebnis |
|---|---|---|
| Lokal (ohne Docker) | `make dev` / `bash start.sh` | Backend+SPA auf `:8000`, venv `backend/.venv` |
| Co-Entwicklung 3 Repos | `make dev-link` | Editable-Installs aus `../` |
| Docker einfach | `make prod` (`docker compose up -d --build`) | 1 Container `:8000`, SPA via sp5api |
| Docker Prod | `make prod-secure` (`docker-compose.prod.yml`) | nginx `:80/:443` → Backend (nicht exponiert) |
| Backup | `make backup` | Volumes `sp5_data`/`sp5_state`/`sp5_api_state` → `./backups/*.tar.gz` |
| Tests | `make test` (vitest + Playwright) · Backend-pytest im API-Repo | — |
