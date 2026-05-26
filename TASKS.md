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
- [ ] venv-Vereinheitlichung (.venv vs venv)

## Phase 4 — API- & Library-Audit
- [x] Alle 25 Router systematisch geprüft → AUDIT.md
- [x] sp5lib geprüft (dbf_reader/writer, ORM, repository, sync) → AUDIT.md
- [x] RBAC-Lücken mit Tests geschlossen (PR #57)
- [ ] schemas.py Feldnamen an reale DBF-Keys angleichen
- [ ] ORM to_dict() SQLite/PG-Divergenz angleichen oder dokumentieren

## Phase 5 — Web-UI verbessern
- [ ] Dark-Mode: StatCard/Badge/PageHeader
- [ ] A11y: th scope, role=status, Modal-Fokus-Restore
- [ ] Robustheit: Staleness-Guards, Error-States
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
- [ ] venv-Vereinheitlichung (`.venv` vs `venv`)
- [x] `schemas.py` `EmployeeResponse`/`GroupResponse` an reale DBF-Keys angleichen → PR #65
- [ ] ORM `to_dict()` SQLite/Postgres-Divergenz angleichen oder dokumentieren
- [ ] `backend/data/schedule_comments.json` + `backend/.coverage` aus Git-Tracking nehmen

## Run-Log
<!-- Eine Zeile pro abgeschlossener Iteration: YYYY-MM-DD HH:MM · PR #<nr> · <kurz> -->
- 2026-05-26 16:17 · PR #64 · App konsumiert libopenschichtplaner5 jetzt aus PyPI (>=1.1.0); git-Build-Dep aus Dockerfile entfernt; Backend-Suite grün (2251)
- 2026-05-26 16:46 · PR #65 · schemas.py: Employee/GroupResponse-Felder an reale DBF-Keys angeglichen (HIDDEN→HIDE, EMPLOYEENO→NUMBER, Phantom-Felder entfernt) + Regressions-Test; Suite grün (2255)
- 2026-05-26 16:58 · PR #66 · employees.py Pillow: Image.Resampling.LANCZOS + img-Annotation (api/ mypy 4→1, keine Verhaltensaenderung); Suite gruen (2255)
- 2026-05-26 17:08 · PR #67 · auth.py change-password user_id None-Guard → mypy api = 0 Fehler; Suite gruen (2255)
