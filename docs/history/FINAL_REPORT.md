> **Hinweis (2026-06):** Historisches Prozess-Protokoll autonomer Arbeitsläufe —
> beschreibt teils überholte Zustände (z. B. lokale `backend/api`-Module vor der
> API-Extraktion). Nicht als aktuelle Architektur-Referenz verwenden;
> siehe stattdessen `docs/architecture.md`.

# FINAL REPORT — Autonomer Agent-Run

**Projekt:** OpenSchichtplaner5 · **Datum:** 2026-05-26 (Session 1) / 2026-05-27 (Session 2) · **Branch-Basis:** `main`

Vollständiger, autonomer Durchlauf der Phasen 0–7. Alle Code-Änderungen liefen über
Feature-Branches → `make lint`/`make test` grün → PR → CI → Merge. Tracking in
[ANALYSIS.md](ANALYSIS.md), [AUDIT.md](AUDIT.md), [DECISIONS.md](DECISIONS.md), [TASKS.md](TASKS.md).

## Überblick / Was erreicht wurde

| Phase | Ergebnis |
|---|---|
| 0 — Analyse | Architektur/Datenfluss/API/sp5lib geprüft, Baseline gemessen, priorisierter Befund → ANALYSIS.md |
| 1 — PRs | Keine offenen PRs (nichts zu mergen/schließen) |
| 2 — Issues | Keine offenen Issues |
| 3 — Debugging/Fixes | 3 Fix-PRs (RBAC+XSS+Feldnamen, DBF-Integrität, malicious fastapi) |
| 4 — API-/Library-Audit | Voller Router-/sp5lib-Audit → AUDIT.md; RBAC-Lücken mit Tests geschlossen |
| 5 — Web-UI | Dark-Mode + A11y für geteilte Komponenten, mit Tests |
| 6 — Library | sp5lib → eigenständiges Repo `libopenschichtplaner5` (Historie erhalten), App auf Dependency umgestellt |
| 7 — Branches | Gemergte/verwaiste Branches aufgeräumt |

## Pull Requests (alle mit grüner CI gemergt, sofern nicht anders vermerkt)

- **#57** `fix: backend RBAC gaps, email HTML injection, swap-notif field names` — **gemergt**
  - availability POST/PUT → `require_planer`; restriction DELETE → `require_admin`;
    E-Mail-`title`/`message` HTML-escaped + Link-Schema-Validierung; `misc.py` `FIRSTNAME`/`NAME`.
- **#58** `fix(sp5lib): guard DBF numeric overflow and validate calendar dates` — **gemergt**
  - Numerischer Overflow wirft statt still zu korrumpieren; `_parse_date` validiert via `date()`.
- **#59** `fix(security): exclude malicious fastapi 0.136.3 (MAL-2026-4750)` — **gemergt**
  - Supply-Chain: kompromittierte fastapi-Release weggepinnt; war Ursache des roten CI-Security-Audit.
- **#60** `feat(frontend): dark-mode + a11y for shared components` — **gemergt**
  - StatCard/Badge/PageHeader Dark-Mode; LoadingSpinner `role=status`; DataTable `scope`;
    FormModal/ConfirmDialog Fokus-Restore. +8 Tests.
- **#61** `refactor: consume sp5lib as external libopenschichtplaner5 package` — **gemergt**
  - Library-Auslösung: Dependency via `git+https`, `backend/sp5lib/` entfernt, `SP5_BACKEND_DIR`-Entkopplung.
  - Inkl. Dockerfile-Fix: `git` im Build-Image (für `pip install` der git+https-Dependency), danach entfernt.

### Folgearbeiten (nach Abschlussbericht, auf Wunsch)
- **#62** `ci: bump GitHub Actions to Node 24 runtime`
  - 13 Actions auf node24-fähige Majors gebumpt (checkout v5, setup-python v6, setup-node v5,
    cache v5, upload-artifact v6, docker/build-push v7 + login v4/metadata v6/buildx v4/qemu v4,
    codecov v5, codeql/upload-sarif v4, gh-release v3). Jede Version gegen ihre `action.yml`
    als `runs.using=node24` verifiziert (v.a. upload-artifact v5 + build-push v6 waren noch node20).
    Grund: GitHub erzwingt Node 24 ab 2026-06-02.
- **#63** `feat: demo-data generator, refreshed screenshots & UI robustness`
  - UI-Robustheit: `useApiData`-Staleness-Guard (Race-Fix) + sichtbare Fehler-States
    (Geburtstagkalender/DienstBoard/MitarbeiterVergleich) statt stiller Leer-Seiten; +Tests.
  - **`scripts/generate_demo_schedule.py`**: generiert einen realistischen rotierenden
    Dienstplan (aktueller + voriger Monat) → befüllte, aktuelle Demo-Daten.
  - **`take_screenshots.py`** portabel gemacht (repo-relativ, env-konfigurierbar, erzwingt
    deutsche UI) und **alle `docs/screenshots/` neu generiert** (befüllte Daten, deutsche Nav,
    inkl. Dark-Mode-Dashboard, Mobile-Ansicht, echtes Mitarbeiter-Profil).

> Hinweis: #62 & #63 entstanden, während ein **GitHub-Actions/Pages-Incident** lief (Status
> *investigating → monitoring*). Lokal vollständig grün verifiziert; CI lief nach Erholung des
> Incidents wieder an, beide grün gemergt.
- **#64** `chore: consume libopenschichtplaner5 from PyPI (>=1.1.0)` — **gemergt**
  - Library auf **PyPI veröffentlicht** (`libopenschichtplaner5` 1.1.0, sdist+wheel, OIDC Trusted Publishing).
  - App-Konsum `git+https` → versionierte PyPI-Release; `git`-Build-Dep aus dem Dockerfile entfernt
    (war nur fürs git-Klonen nötig). Backend-Suite grün (2251), Import-Name bleibt `sp5lib`.

> Ab hier läuft die Weiterentwicklung **24/7 autonom** über `AUTONOMOUS_RUN.md` (via `/loop`):
> eine Iteration = ein vollständig gemergter Schritt; Run-Log am Ende von `TASKS.md`.

## Neues Library-Repo

**https://github.com/mschabhuettl/libopenschichtplaner5** (öffentlich, MIT)
- `git subtree split` → **57 Commits Historie erhalten** (kein bloßes Copy).
- Distribution `libopenschichtplaner5`, Import-Name **`sp5lib`** (null Import-Churn).
- Eigene `pyproject.toml` (Deps: SQLAlchemy, alembic, bcrypt, pyotp, packaging; `[postgres]`-Extra),
  README, LICENSE, `py.typed`, self-contained Tests, GitHub-Actions-CI (Python 3.10/3.11/3.12, **grün**).
- pip-installierbar: `pip install "libopenschichtplaner5[postgres] @ git+https://github.com/mschabhuettl/libopenschichtplaner5.git"`.

## Gelöste Issues
Keine offenen Issues zu Beginn — daher keine `Closes #N`. Stattdessen wurden in Phase 0/4
gefundene Bugs proaktiv behoben (siehe PRs oben).

## Gelöschte / aufgeräumte Branches
Nach allen Merges (`git fetch --prune` + explizites Löschen auf origin & lokal). Endstand: nur noch `main`.

**Auto-gelöscht beim Squash-Merge** (gh `--delete-branch`):
- `fix/backend-security-correctness` (#57), `fix/dbf-data-integrity` (#58),
  `fix/pin-out-malicious-fastapi` (#59), `feat/frontend-darkmode-a11y` (#60),
  `refactor/extract-sp5lib-to-package` (#61)

**Explizit gelöscht (gemergt/verwaist, nachweislich):**
- `claude/analyze-and-fix-bugs-xD4Ks` — 0 unmerged Commits (vollständig gemergt, PR #56)
- `feature/q093-keyboard-nav` — 0 unmerged (gemergt, PR #52)
- `feature/q094-scheduled-reports` — 0 unmerged (gemergt, PR #54)
- `feature/q092-ratelimit-dashboard` — 2 „unmerged" Commits, aber das Feature ist
  nachweislich via PR #51 in `main` (alle Dateien vorhanden: `rate_limit_store.py`,
  `admin.py`, `RateLimitDashboard.tsx`, Test). Divergente, überholte Variante → verwaist, gelöscht.

`main` wurde nie force-gepusht oder gelöscht; alle Löschungen sind über die PR-Historie/`main` reversibel.

## Session 2 (2026-05-27) — Lib-Roadmap-Konsum, ORM-Mirror & Parallel-Modus

Fortsetzung des 24/7-Laufs unter aktualisiertem Owner-Charter (Substanz vor Coverage;
Coverage gedeckelt; pro Welle ein Lib-Schritt; **Parallel-Modus** als Team-Lead mit bis zu
3 worktree-isolierten Teammates pro Welle, sequenzieller Merge). Highlights:

- **Lib-Roadmap komplett durchgezogen & konsumiert:** `libopenschichtplaner5` von 1.1.0 → **1.6.0**
  getrieben (je from-app-Issue + tmux-Dispatch → `[LIB-DONE]` → App-Konsum). Ergebnis: ein
  **vollständiger DBF→ORM-Lese-Mirror über alle 19 Tabellen** (Stammdaten, Schedule-Einträge,
  Kalender, Zeitkonto, Planungsdaten) als Admin-Router `/api/admin/orm/*` (#131/#133/#138/#139/#141).
- **ORM-Mirror nutzbar gemacht:** `/sync` (via `sync_all`), date-range/Filter-Read-Endpoints je Tabelle,
  `/status` (Live-Counts ohne Re-Sync, #144), vollständige API-Doku (#142) und eine **Admin-UI**
  `/orm-mirror` (Status + Sync-Button, #147).
- **Gefundener/abgefangener Defekt:** floating Lib-Version + verhaltens-gepinnter App-Test
  (`test_orm_sync.py`) → in #138 mitgefixt; sync_group_assignments-UNIQUE + dangling-super_id als
  Lib-Defekte zurückgemeldet und in 1.4.0 behoben.
- **Phase-5 abgeschlossen:** `useFocusTrap`-Hook + Modal-Migration (#132/#136), `scope` auf 499
  Tabellen-Headern/49 Seiten (#137), `aria-live`/`role=status` Live-Regions (#143); Dark-Mode &
  Robustheit/Error-States als bereits abgedeckt verifiziert.
- **Korrektheit/DX:** `ShiftResponse` Phantom-Key `HIDDEN`→`HIDE` (#145, schließt schemas/DBF-Alignment);
  alle OpenAPI-Tags beschrieben + Guard-Test (#146).
- **API-Extraktions-Epic P1:** Analyse + ADR `docs/adr/0001-api-extraction.md` (#140).
- **Charter/Workflow:** Parallel-Modus in AUTONOMOUS_RUN.md verankert (#134).

## Baseline → Endstand

| Metrik | Baseline | Endstand |
|---|---|---|
| Backend-Tests | 2234 passed / 6 skip | **2491 passed / 6 skip** |
| Backend-Coverage | 79 % | ~87 % (api/) |
| Frontend-Tests | 378 passed | **523 passed** |
| ruff / eslint / tsc / mypy | clean / 0err / clean | clean / 0err / clean / clean |
| CI-Security-Audit | **rot** (malicious fastapi) | **grün** |
| libopenschichtplaner5 | git-Pin | **PyPI >=1.6.0** (19-Tabellen-ORM) |
| ORM-Mirror | — | vollständig (Backend + Doku + Admin-UI) |
| docs/screenshots | teils leer/veraltet | neu generiert, deutsch (#63) |

## Offene Punkte & empfohlene nächste Schritte
1. **Tech-Debt (D009):** `backend/data/schedule_comments.json` und `backend/.coverage` aus dem
   Git-Tracking nehmen (gitignore); verursachen Merge-Konflikte/Dirty-Tree.
2. ~~**CI-Wartung:** GitHub-Actions auf Node-24 bumpen~~ — ✅ erledigt in **#62**.
3. **Deployment-Härtung:** Fail-fast wenn `SP5_JWT_SECRET` im Prod-Modus fehlt; In-Memory-Session/
   Rate-Limit-Store für Multi-Worker auf Shared-Store (Redis) umstellen — oder Single-Worker dokumentieren.
4. ~~**ORM-Parität:** SQLite-`to_dict()` an den DBF-Feldsatz angleichen~~ — ✅ entfällt: `to_dict()` lebt
   seit der Lib-Extraktion zentral in `libopenschichtplaner5` (eine Quelle, SQLite=PG).
5. ~~**schemas.py:** Felder an reale DBF-Keys angleichen~~ — ✅ erledigt (#65 Employee/Group, #145 Shift).
6. ~~**mypy:** verbleibende Typfehler~~ — ✅ `mypy api` clean (mit `--ignore-missing-imports`).
7. ~~**Library-Reifung:** PyPI veröffentlichen~~ — ✅ erledigt; mittlerweile **1.6.0** (kompletter ORM-Mirror).

### Auf Owner-Entscheidung wartend (Session 2)
- **Lib Phase 7 — Write-Back (ORM→DBF):** bewusst NICHT autonom dispatcht — berührt die DBF-Schreib-
  Kernsicherheit (Risiko echter FoxPro-Datenkorruption). Erst nach Owner-Freigabe.
- **API-Extraktions-Epic P2–P5:** P1 (ADR) erledigt; P2 erstellt ein neues öffentliches Repo
  `openschichtplaner5-api` + CI/PyPI — konsequente externe Aktion, daher auf explizite Freigabe wartend.
- **Deployment-Härtung** (Punkt 3 oben) und **Performance-Profiling** bleiben offen, sobald gewünscht.
