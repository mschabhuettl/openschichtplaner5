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
- [ ] Bugs aus Phase 0 beheben (failing test → fix wo sinnvoll)
- [ ] mypy-Fehler beheben (u.a. Image.LANCZOS in employees.py)
- [ ] SQLite/Postgres-Modelle synchron halten

## Phase 4 — API- & Library-Audit
- [ ] Alle 25 Router systematisch prüfen → AUDIT.md
- [ ] sp5lib hart prüfen (dbf_reader/writer, ORM, repository, sync)
- [ ] Lücken mit Tests schließen

## Phase 5 — Web-UI verbessern
- [ ] UX/Konsistenz/Empty-States/Responsiveness/A11y/Performance
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
