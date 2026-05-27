# TASKS — Autonomer Agent-Run

Laufend aktualisierte Aufgabenliste. Legende: [ ] offen · [~] in Arbeit · [x] erledigt · [-] entfällt

## Phase 0 — Gesamtanalyse
- [x] Repo-Überblick (git log, branches, PRs, issues)
- [x] Toolchain bereitstellen (node, pip, venv)
- [x] Baseline: `pytest` (2234 pass/6 skip), `ruff` (clean), `mypy` (8 err non-blocking)
- [x] Baseline Frontend: `vitest` (378 pass), `tsc -b` (clean), `eslint` (0 err/2 warn)
- [x] Baseline Coverage: 79% Backend
- [~] ANALYSIS.md: Architektur, Datenfluss, API-Oberfläche, sp5lib, priorisierter Befund

## Phase 1 — Pull Requests
- [-] Keine offenen PRs (siehe D001)

## Phase 2 — Issues
- [-] Keine offenen Issues (siehe D001)

## Phase 3 — Debugging & Fixes
- [x] email HTML-Injection + falsche Feldnamen + RBAC → PR #57
- [x] DBF numerischer Overflow + Datumsvalidierung → PR #58
- [x] Supply-Chain: malicious fastapi 0.136.3 wegpinnen → PR #59
- [ ] mypy-Fehler beheben (8, nicht-blockierend; u.a. Pillow-Resampling-Typing)
- [x] venv-Vereinheitlichung (.venv) → PR #69

## Phase 4 — API- & Library-Audit
- [x] Alle 25 Router systematisch geprüft → AUDIT.md
- [x] sp5lib geprüft (dbf_reader/writer, ORM, repository, sync) → AUDIT.md
- [x] RBAC-Lücken mit Tests geschlossen (PR #57)
- [x] schemas.py Feldnamen an reale DBF-Keys angleichen (#65 Employee/Group; #145 ShiftResponse HIDDEN→HIDE — letzter Phantom-Key)
- [x] ORM to_dict() SQLite/PG-Divergenz: entfällt — `to_dict()` lebt seit der Lib-Extraktion in `libopenschichtplaner5` (models.py re-exportiert aus models_pg → eine Quelle), SQLite/PG nutzen dieselbe Implementierung

## Phase 5 — Web-UI verbessern
- [x] Dark-Mode: StatCard/Badge/PageHeader (Audit: bereits vollständig abgedeckt)
- [x] A11y: `th scope` (#137, 499 Header/49 Dateien) + Modal-Fokus-Restore/Trap (#132 `useFocusTrap`, #136 Migration FormModal/ConfirmDialog)
- [x] A11y Rest: `role=status`/`aria-live` Live-Regions für Async-States (#143: EmptyState/ErrorBoundary/Skeleton; Toast/LoadingSpinner waren bereits korrekt)
- [x] Robustheit: Staleness-Guards, Error-States — bereits abgedeckt (`useApiData` liefert loading/error/refresh-Retry; 75/76 Seiten haben Error-Handling, einzige Ausnahme ist die statische NotFound-Seite; `ErrorBoundary` + #143 Live-Regions)
- [ ] vitest + Playwright absichern

## Phase 6 — Library herauslösen
- [x] git-Historie von backend/sp5lib erhalten (`git subtree split`, 57 Commits)
- [x] Neues Paket libopenschichtplaner5 (pyproject, README, LICENSE, CI, Tests, py.typed)
- [x] Repo erstellt + gepusht (github.com/mschabhuettl/libopenschichtplaner5), CI grün
- [x] Host-relative Pfade via SP5_BACKEND_DIR entkoppelt (Lib-Commit)
- [x] OpenSchichtplaner5 auf Dependency umgestellt → PR #61 **gemergt** (CI grün inkl. Docker-Build/E2E)

## Phase 7 — Branches aufräumen
- [x] 5 PR-Branches auto-gelöscht; q093/q094/claude (0 unmerged) + q092 (verwaist) gelöscht
- [x] `git fetch --prune` — Endstand: nur `main`
- [x] q092-Branch bewertet (Feature via #51 in main → verwaist, gelöscht)

## Abschluss
- [x] FINAL_REPORT.md

## Folgearbeiten (24/7-Lauf via AUTONOMOUS_RUN.md)
- [x] CI-Actions auf Node 24 bumpen → PR #62
- [x] Demo-Daten-Generator + Screenshots neu + UI-Robustheit → PR #63
- [x] libopenschichtplaner5 auf PyPI veröffentlicht (1.1.0); App-Konsum auf PyPI umgestellt → PR #64
- [ ] Phase 5 Web-UI: weitere Empty-/Error-States, Responsiveness, Performance
- [x] mypy-Restfehler in api/ behoben (Pillow #66 + auth user_id #67 → mypy api = 0 Fehler)
- [x] venv-Vereinheitlichung (.venv) → PR #69
- [x] `schemas.py` `EmployeeResponse`/`GroupResponse` an reale DBF-Keys angleichen → PR #65
- [ ] ORM `to_dict()` SQLite/Postgres-Divergenz angleichen oder dokumentieren
- [x] `schedule_comments.json` + `.coverage` aus Git-Tracking genommen → PR #68

## Owner-Steuerung (2026-05-27)
- [x] Charter aktualisiert: Substanz vor Coverage; Coverage gedeckelt (keine Mikro-PRs); pro Iteration ein Lib-Schritt; Epic API-Extraktion → PR #130
- [x] Lib-Roadmap Phase 2 dispatcht & geliefert: libopenschichtplaner5#3 (Shift/LeaveType/Workplace ORM + Repos + sync) → `[LIB-DONE]` v1.2.0 auf PyPI
- [x] Lib 1.2.0 konsumiert: `requirements.txt` >=1.2.0 + ORM-Mirror-Admin-Router (`/api/admin/orm/*`) nutzt neue Models/Repos/sync → PR (siehe Run-Log)
- [x] Lib-Roadmap Phase 3 dispatcht & geliefert: libopenschichtplaner5#5 (Schedule MASHI/SPSHI/ABSEN + date-range Repos + sync, sync_groups-FK-Fix) → `[LIB-DONE]` v1.3.0 auf PyPI
- [x] Lib 1.3.0 konsumiert: `requirements.txt` >=1.3.0 + ORM-Mirror um Schedule-Entries erweitert (`/shift-assignments|special-shifts|absences` mit date-range) → PR (siehe Run-Log)
- [x] Lib-Roadmap Phase 4 dispatcht & geliefert: libopenschichtplaner5#7 (Holiday/Period + Fix `sync_group_assignments` UNIQUE) → `[LIB-DONE]` v1.4.0; `sync_all` läuft jetzt über 11 Tabellen
- [x] Lib 1.4.0 konsumiert: `requirements.txt` >=1.4.0 + `/sync` nutzt `sync_all` + `/holidays`,`/periods` Endpoints; Defekt-Folge: App-Test `test_orm_sync.py` an neues group_assignments-Verhalten angepasst (#138)
- [x] Lib-Roadmap Phase 5 dispatcht & geliefert: libopenschichtplaner5#9 (AccountBooking/OvertimeEntry/LeaveEntitlement) → `[LIB-DONE]` v1.5.0; `sync_all` deckt 14 Tabellen ab
- [x] Lib 1.5.0 konsumiert: `requirements.txt` >=1.5.0 + `/bookings`,`/overtime`,`/leave-entitlements` Endpoints (#139)
- [x] Lib-Roadmap Phase 6 dispatcht & geliefert: libopenschichtplaner5#11 (Demand 5SHDEM/5SPDEM + Cycles 5CYCLE/5CYASS + Restrictions 5RESTR) → `[LIB-DONE]` v1.6.0; **`sync_all` deckt 19 Tabellen ab — Lese-Mirror VOLLSTÄNDIG**
- [x] Lib 1.6.0 konsumiert: `requirements.txt` >=1.6.0 + ORM-Mirror um Planungsdaten erweitert (`/shift-demands`,`/special-demands`,`/cycles`,`/cycle-assignments`,`/restrictions`) (#141)
- [ ] Lib-Roadmap Phase 7 (Write-Back ORM→DBF) — bewusst NICHT autonom dispatcht: berührt die DBF-Schreib-Kernsicherheit; Owner-Entscheidung/Review abwarten. Read-Mirror ist komplett.
- [x] Parallel-Modus (Team-Lead) verankert: AUTONOMOUS_RUN.md → PR #134
- [x] API-Extraktions-Epic P1 (Analyse + ADR `create_app(config)`) → PR #140 (Teammate)
- [ ] Substanz-Backlog (Owner-Prio): Phase-5 UI/A11y, schemas/ORM-Alignment, echte Features/Bugfixes, Performance (mypy = bereits clean mit --ignore-missing-imports)

## Epic — API-Extraktion (`openschichtplaner5-api`), niedrige Prio, strikt inkrementell
Ziel: `backend/api` (routers, schemas, dependencies, cache, rate_limit, auth, DB-Wiring) analog zur Lib in ein eigenes
Repo `mschabhuettl/openschichtplaner5-api` herauslösen — **app-agnostisch & konfigurierbar** (kein gemountetes Frontend,
keine App-`.env`), abhängig von `libopenschichtplaner5`. Danach konsumiert die App das Paket und behält nur Wiring +
Frontend + Deployment. Jede Phase = eigener PR, App-CI bleibt durchgehend grün. Ziel: Lib **und** API von Drittprojekten nutzbar.
- [x] **P1 — Analyse/Schnittstelle:** App-Kopplungen kartiert + Konfig-Vertrag `ApiSettings`/`create_app(config)` entworfen → ADR `docs/adr/0001-api-extraction.md` (PR #140). Top-Risiko: globaler `_sessions`-State.
- [ ] **P2 — Repo-Bootstrap:** `gh repo create mschabhuettl/openschichtplaner5-api --public` (MIT). `pyproject` (dist `openschichtplaner5-api`, dep `libopenschichtplaner5`), README, LICENSE, CI wie Lib (ruff + pytest-Matrix + PyPI Trusted Publishing). Möglichst mit `git subtree split`/`filter-repo` History von `backend/api`.
- [ ] **P3 — App-agnostisch machen:** Hardcodierte App-Annahmen hinter Config/DI ziehen (Settings statt `.env`-Direktzugriff, Frontend-Mount optional/aus, Pfade injizierbar). Eigene Tests grün.
- [ ] **P4 — Erstes Release:** Version + Tag, PyPI-Publish (Trusted Publishing). Smoke-Test: Drittprojekt-Minimal-App via `create_app`.
- [ ] **P5 — App umstellen:** `backend/` konsumiert `openschichtplaner5-api>=…`; lokale `api/`-Kopie entfernen, nur Wiring + Frontend + Deployment behalten. `make test`/CI grün, gut dokumentierter PR.

## Run-Log
<!-- Eine Zeile pro abgeschlossener Iteration: YYYY-MM-DD HH:MM · PR #<nr> · <kurz> -->
- 2026-05-26 16:17 · PR #64 · App konsumiert libopenschichtplaner5 jetzt aus PyPI (>=1.1.0); git-Build-Dep aus Dockerfile entfernt; Backend-Suite grün (2251)
- 2026-05-26 16:46 · PR #65 · schemas.py: Employee/GroupResponse-Felder an reale DBF-Keys angeglichen (HIDDEN→HIDE, EMPLOYEENO→NUMBER, Phantom-Felder entfernt) + Regressions-Test; Suite grün (2255)
- 2026-05-26 16:58 · PR #66 · employees.py Pillow: Image.Resampling.LANCZOS + img-Annotation (api/ mypy 4→1, keine Verhaltensaenderung); Suite gruen (2255)
- 2026-05-26 17:08 · PR #67 · auth.py change-password user_id None-Guard → mypy api = 0 Fehler; Suite gruen (2255)
- 2026-05-26 17:20 · PR #68 · generierte Dateien (.coverage, schedule_comments.json) aus Git-Tracking genommen + gitignored; kein Daten-Churn mehr; Suite gruen (2255)
- 2026-05-26 17:33 · PR #69 · venv-Pfad auf .venv vereinheitlicht (Makefile↔start.sh); make lint/test laufen verlaesslich via .venv
- 2026-05-26 17:47 · PR #70 · Coverage schedule_pdf.py 69%→91% (Unit-Tests _build_schedule_html entries/group + 404); rein additiv
- 2026-05-26 17:52 · PR #71 · Coverage absences.py 74%→82% (Unit-Tests _classify_leave_type + _build_employee_stats); Gesamt 85%
- 2026-05-26 18:08 · PR #72 · Coverage overtime.py 80%→97% (Unit-Tests _calc_overtime MASHI/SPSHI-Stundenlogik)
- 2026-05-26 18:23 · PR #73 · Doku-Mindestversionen korrigiert (Python 3.8+→3.10+, Node 18+→20+) in README + DEVELOPMENT.md
- 2026-05-26 18:31 · PR #74 · DEVELOPMENT.md Backend-Setup auf .venv angeglichen (Konsistenz mit #69)
- 2026-05-26 18:44 · PR #75 · explizite Tests: Passwort-Staerke-Validierung (alle Branches) + change-password 403-Reject
- 2026-05-26 18:59 · PR #76 · Frontend-Coverage: useUndoRedo-Hook (Undo/Redo-Stack, 8 Tests) — bisher ungetestet
- 2026-05-26 19:11 · PR #77 · Frontend-Coverage: recentPages-Util (Parse-Fallback, Dedupe, Cap-5; 6 Tests)
- 2026-05-26 19:22 · PR #78 · Frontend-Coverage: useForm-Hook (State/Validierung/Submit/Reset; 7 Tests)
- 2026-05-26 19:35 · PR #79 · BUGFIX useOnlineStatusWithFlash: justReconnected klaerte nie (Effect-Re-Run cancelte 3s-Timer); via neuem Test entdeckt, mit useRef behoben
- 2026-05-26 19:46 · PR #80 · Frontend-Coverage: usePermissions RBAC-Gating-Hook (4 Tests)
- 2026-05-26 19:57 · PR #81 · Frontend-Coverage: useAppSettings (Deep-Merge/Persistenz/Import-Export; 7 Tests)
- 2026-05-26 20:09 · PR #82 · Frontend-Coverage: useRovingTabindex a11y-Tastaturnavigation (5 Tests)
- 2026-05-26 20:22 · PR #83 · Frontend-Coverage: useKeyboardShortcuts globale Tastatur-Shortcuts (9 Tests)
- 2026-05-26 20:33 · PR #84 · Frontend-Coverage: useFocusOnNavigate a11y-Fokus nach Routenwechsel (6 Tests)
- 2026-05-26 20:43 · PR #85 · Frontend-Coverage: useSSE Event-Stream + Reconnect-Backoff (11 Tests)
- 2026-05-26 20:53 · PR #86 · Frontend-Coverage: useConfirm Promise-Dialog (4 Tests) — Hook-Lücke geschlossen
- 2026-05-26 21:04 · PR #87 · Frontend-Coverage: ThemeContext Theme-Resolution + Persistenz (9 Tests)
- 2026-05-26 21:15 · PR #88 · Frontend-Coverage: ToastContext Queue + Dedup + Auto-Dismiss (8 Tests)
- 2026-05-26 21:25 · PR #89 · Frontend-Coverage: SSEContext Pub/Sub-Dispatch + useSSERefresh (7 Tests)
- 2026-05-26 21:37 · PR #90 · Frontend-Coverage: AuthContext Session/Rollen/Login/Expiry (16 Tests) — alle Contexts abgedeckt
- 2026-05-26 21:52 · PR #91 · Backend-Coverage: schedule_comments Error-Paths 79%→100% (4 Tests)
- 2026-05-26 22:03 · PR #92 · Backend-Coverage: rate_limit_store Edge/Failure-Paths 82%→100% (6 Tests)
- 2026-05-26 22:16 · PR #93 · Backend-Coverage: companies Validation/Conflict/Error-Paths 81%→93% (9 Tests)
- 2026-05-26 22:27 · PR #94 · Backend-Coverage: notifications Storage + Email-Bridge 87%→100% (8 Tests)
- 2026-05-26 22:39 · PR #95 · Backend-Coverage: work_time_rules Parsing-Helper 87%→100% (8 Tests)
- 2026-05-26 22:50 · PR #96 · Backend-Coverage: qualification_matrix Parser + Stats 91%→100% (3 Tests)
- 2026-05-26 23:02 · PR #97 · Backend-Coverage: recurring_shifts Validation/Generation 93%→100% (7 Tests)
- 2026-05-26 23:12 · PR #98 · Backend-Coverage: notification_settings Korruptdatei-Fallback 95%→100% (1 Test)
- 2026-05-26 23:27 · PR #99 · Backend-Coverage: dependencies.py Auth/Security-Helper 91%→100% (21 Tests)
- 2026-05-26 23:44 · PR #100 · Backend-Coverage: conflict_report Detection-Engine + Export 86%→99% (11 Tests)
- 2026-05-26 23:57 · PR #101 · Backend-Coverage: webhooks Update/Dispatch-Failure 90%→100% (8 Tests)
- 2026-05-27 00:15 · PR #102 · Backend-Coverage: ical Feed-Generierung + Token-Lifecycle 84%→96% (5 Tests)
- 2026-05-27 00:28 · PR #103 · Backend-Coverage: schedule_pdf HTML-Builder 91%→98% (6 Tests)
- 2026-05-27 00:43 · PR #104 · Backend-Coverage: auth change_own_password Flow 81%→85% (5 Tests; CI-Flake WorkTimeRules-Rerun)
- 2026-05-27 00:55 · PR #105 · Backend-Coverage: auth reset_user_password E-Mail-Pfad 85%→89% (3 Tests)
- 2026-05-27 01:05 · PR #106 · Backend-Coverage: auth Login-Security Lockout/2FA/Session-Limit 89%→92% (4 Tests)
- 2026-05-27 01:20 · PR #107 · FIX: admin rate-limit-Dashboard erreichbar (Route /api/v1→/api) + admin.py 83%→89% (6 Tests)
- 2026-05-27 01:32 · PR #108 · Backend-Coverage: admin Backup-Helper (zip/rotate/auto-backup) 89%→91% (6 Tests)
- 2026-05-27 01:47 · PR #109 · Backend-Coverage: absences create_absence Warnungen/Resilienz 82%→85% (6 Tests)
- 2026-05-27 01:58 · PR #110 · Backend-Coverage: absences bulk_create per-Employee-Outcomes →86% (3 Tests)
- 2026-05-27 02:11 · PR #111 · Backend-Coverage: master_data create_shift Duplikat-409 + Errors 87%→88% (5 Tests)
- 2026-05-27 02:25 · PR #112 · Backend-Coverage: employees CSV-Import Upload-Validierung →90% (5 Tests)
- 2026-05-27 02:36 · PR #113 · Backend-Coverage: misc _send_swap_email Bridge 83%→85% (5 Tests)
- 2026-05-27 02:49 · PR #114 · Backend-Coverage: misc Self-Service-Endpoints 85%→89% (9 Tests)
- 2026-05-27 03:00 · PR #115 · Backend-Coverage: schedule Konflikt-Zeit-Primitive (11 Tests)
- 2026-05-27 03:14 · PR #116 · Backend-Coverage: reports Format/CSV-Upload-Helper (7 Tests; vitest-Flake-Rerun)
- 2026-05-27 03:26 · PR #117 · FIX: WorkTimeRules vitest-Flake gehärtet (selectEmployeeAndCheck-Helper; behebt #104/#116-Blocker)
- 2026-05-27 03:40 · PR #118 · Backend-Coverage: scheduled_reports Update-Validatoren + corrupt-load 94%→96% (6 Tests)
- 2026-05-27 03:53 · PR #119 · Backend-Coverage: reports Warnings-Center-Aggregation 80%→81% (2 Tests)
- 2026-05-27 04:08 · PR #120 · Backend-Coverage: reports Fairness-Score-Algorithmus 81%→83% (2 Tests)
- 2026-05-27 04:19 · PR #121 · Backend-Coverage: reports Kapazitäts-Forecast-Analytics 83%→85% (2 Tests)
- 2026-05-27 04:30 · PR #122 · Backend-Coverage: reports Quality-Report-Analytics 85%→86% (2 Tests)
- 2026-05-27 04:46 · PR #123 · Backend-Coverage: reports import_absences_csv Zeilen-Validierung 86%→87% (1 Test)
- 2026-05-27 04:57 · PR #124 · Backend-Coverage: reports run_simulation Analytics 87%→88% (1 Test)
- 2026-05-27 05:10 · PR #125 · Backend-Coverage: reports jährliche Kapazitäts-Übersicht 88%→89% (1 Test)
- 2026-05-27 05:23 · PR #126 · Backend-Coverage: reports monthly-report Input-Guards + no-data-404 (3 Tests)
- 2026-05-27 05:40 · PR #127 · Backend-Coverage: main globaler Exception-Handler (sanitisierte 500) 78%→79% (1 Test)
- 2026-05-27 05:52 · PR #128 · Backend-Coverage: main Dashboard-Endpoints (summary/today/stats/upcoming) 79%→85% (4 Tests)
- 2026-05-27 06:04 · PR #129 · Backend-Coverage: main dashboard/upcoming recurring-holiday + birthday Branches 85%→87% (letzte Coverage-Mikro-PR)
- 2026-05-27 09:30 · PR #131 · FEATURE: Lib 1.2.0 konsumiert — requirements >=1.2.0 + ORM-Mirror-Admin-Router (`/api/admin/orm/sync|shifts|leave-types|workplaces`) nutzt neue Shift/LeaveType/Workplace-Models+Repos+sync; Integrationstest gegen DBF-Fixtures (6 Tests); Suite grün (2478)
- 2026-05-27 10:05 · PR #132 · A11y (Phase 5): wiederverwendbarer `useFocusTrap`-Hook (Tab-Cycling ohne disabled-Controls, Escape, Fokus-Restore) + Einbindung in PhotoCropDialog (vorher 0 Dialog-A11y) & KeyboardShortcutsModal (Trap+Restore ergänzt); 9 Hook-Tests; Frontend-Suite grün (509)
- 2026-05-27 11:20 · PR #133 · FEATURE: Lib 1.3.0 konsumiert — requirements >=1.3.0 + ORM-Mirror um Schedule-Entries erweitert (`/shift-assignments|special-shifts|absences` mit date_from/date_to/employee_id via neue date-range Repos); sync deckt jetzt 6 Tabellen; 4 neue Tests (10 gesamt); Backend-Suite grün (2482)
- 2026-05-27 11:40 · PR #134 · CHARTER: Parallel-Modus (Team-Lead) in AUTONOMOUS_RUN.md verankert — Wellen aus bis zu 3 unabhängigen Teammates (worktree-isoliert), Lead merged sequentiell, rebase bei Konflikt
- 2026-05-27 12:10 · PR #138 · FEATURE (Welle): Lib 1.4.0 konsumiert — `/sync` nutzt `sync_all` (11 Tab.) + `/holidays`,`/periods`; Folgefix App-Test `test_orm_sync.py` an 1.4.0-group_assignments-Verhalten angepasst; Suite grün (2484)
- 2026-05-27 12:12 · PR #135 · DOCS (Welle, Teammate): ORM-Mirror-API in `docs/API.md` + CHANGELOG dokumentiert
- 2026-05-27 12:14 · PR #136 · A11y (Welle, Teammate): FormModal/ConfirmDialog auf shared `useFocusTrap` migriert (~80 Zeilen Duplikat entfernt, disabled-Controls-Trap-Bug behoben); 34 Tests grün
- 2026-05-27 12:16 · PR #137 · A11y (Welle, Teammate): `scope="col"` auf 499 Tabellen-Header in 49 Page-Komponenten (WCAG 1.3.1); Frontend-Suite grün (509)
- 2026-05-27 12:40 · PR #139 · FEATURE: Lib 1.5.0 konsumiert — requirements >=1.5.0 + ORM-Mirror um Zeitkonto erweitert (`/bookings`,`/overtime` date-range + `/leave-entitlements` year/employee via neue Repos); `sync_all` deckt 14 Tabellen ab; Backend-Suite grün (2485)
- 2026-05-27 13:05 · PR #140 · EPIC P1 (Teammate): API-Extraktion Analyse + ADR `docs/adr/0001-api-extraction.md` (Kopplungs-Inventar, `ApiSettings`/`create_app(config)`-Vertrag, P2–P5-Plan); Top-Risiko globaler `_sessions`-State
- 2026-05-27 13:30 · PR #141 · FEATURE: Lib 1.6.0 konsumiert — requirements >=1.6.0 + ORM-Mirror um Planungsdaten erweitert (`/shift-demands`,`/special-demands`,`/cycles`,`/cycle-assignments`,`/restrictions`); `sync_all` deckt 19 Tabellen ab → **Lese-Mirror vollständig**; Backend-Suite grün (2486)
- 2026-05-27 13:55 · PR #142 · DOCS (Welle, Teammate): ORM-Mirror-API-Referenz in `docs/API.md` vervollständigt (alle 1.4–1.6-Endpoints) + CHANGELOG
- 2026-05-27 13:58 · PR #143 · A11y (Welle, Teammate): `role=status`/`aria-live` in EmptyState/ErrorBoundary/Skeleton (Toast/LoadingSpinner bereits korrekt); 514 Frontend-Tests grün
- 2026-05-27 14:20 · PR #144 · FEATURE: ORM-Mirror `/api/admin/orm/status` — Live-Zeilen-Counts aller 19 Tabellen ohne Re-Sync (Mirror-Freshness-Sichtbarkeit); 15 Tests; Backend-Suite grün (2487)
- 2026-05-27 14:45 · PR #145 · FIX: `ShiftResponse` Phantom-Key `HIDDEN`→`HIDE` (reale 5SHIFT.DBF-Spalte; verifiziert gegen Fixture) + `POSITION` ergänzt; Regressions-Test; schließt schemas/DBF-Key-Alignment ab
- 2026-05-27 15:10 · PR #146 · DX: 12 fehlende OpenAPI-Tag-Beschreibungen ergänzt (Reports/Notifications/ORM Mirror/… → Swagger-UI vollständig beschriftet) + Regressions-Guard-Test (jeder Route-Tag muss beschrieben sein); Backend-Suite grün (2491)
- 2026-05-27 15:35 · PR #147 · FEATURE (Teammate): Admin-UI `/orm-mirror` (ORM-Spiegel) — Status (Tabellen-Counts, mirror_db_exists) + „Jetzt synchronisieren"-Button; `getOrmMirrorStatus`/`syncOrmMirror` im API-Client; 9 Tests; Frontend-Suite grün (523)
- 2026-05-27 15:55 · PR #148 · DOCS: FINAL_REPORT.md auf Session 2 aktualisiert (Lib 1.1→1.6/19-Tabellen-Mirror, Admin-UI, Parallel-Modus, Metriken 2491/523, offene Owner-Entscheidungen Write-Back & API-Epic-P2)
- 2026-05-27 16:15 · PR #149 · SECURITY: Warnung beim Start, wenn JWT-Secret in Produktion fehlt (random Per-Prozess-Fallback bricht Sessions über Restarts/Worker); testbarer `_resolve_jwt_secret`; 5 Tests; nicht brechend
- 2026-05-27 16:35 · PR #150 · SECURITY-FIX: JWT-Secret liest jetzt `SECRET_KEY` (dokumentierte + von start.sh generierte Var) statt nur `SP5_JWT_SECRET` — vorher wurde der konfigurierte/generierte Secret IGNORIERT (immer random Fallback); `change-me`-Platzhalter als unset behandelt; 8 Tests; Backend-Suite grün (2499)
- 2026-05-27 17:00 · PR #151 · FIX: dokumentierte ENV-Config wirksam gemacht — `LOG_LEVEL` (Alias), `BRUTE_FORCE_MAX_ATTEMPTS`/`BRUTE_FORCE_LOCKOUT_MINUTES`, `RATE_LIMIT_API`, `SESSION_CLEANUP_INTERVAL_MINUTES` wurden bisher ignoriert (hardcodiert/anderer Name); jetzt via `_int_env`/Env gelesen (Defaults = bisheriges Verhalten, nicht brechend); 5 Tests; Suite grün (2504)
- 2026-05-27 17:25 · PR #152 · FIX: dokumentiertes `LOG_FILE` wird jetzt honoriert (`_open_log_handler` legt Parent-Dir an, fällt bei FS-Fehler sicher auf `/tmp` zurück → Start kann nie an LOG_FILE scheitern); 2 Tests; Suite grün (2506). Verbleibender Config-Rest: `RATE_LIMIT_LOGIN` (Dekorator-Refactor; hardcodierte „5/minute" = dokumentierter Default, daher nicht irreführend)
- 2026-05-27 17:50 · PR #153 · FIX: `RATE_LIMIT_LOGIN` wird jetzt honoriert (Login-Endpoint `@limiter.limit(_LOGIN_RATE_LIMIT)` via neuen `_str_env`-Helfer; `RATE_LIMIT_API` ebenfalls auf `_str_env` umgestellt) — **damit sind ALLE dokumentierten ENV-Vars wirksam**; 4 Tests; Suite grün (2510)
