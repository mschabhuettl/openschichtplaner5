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
- [ ] git-Historie von backend/sp5lib erhalten (subtree split / filter-repo)
- [ ] Neues Paket libopenschichtplaner5 (pyproject, README, LICENSE, CI)
- [ ] Repo erstellen + pushen
- [ ] OpenSchichtplaner5 auf Dependency umstellen, Tests grün

## Phase 7 — Branches aufräumen
- [ ] Gemergte/verwaiste Branches löschen (nach PR-Merges), `git fetch --prune`

## Abschluss
- [ ] FINAL_REPORT.md
