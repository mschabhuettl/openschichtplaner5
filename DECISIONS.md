# DECISIONS — Autonomer Agent-Run

Dieses Dokument hält jede nicht-triviale Entscheidung mit Begründung fest, damit der
gesamte autonome Lauf nachvollziehbar bleibt. Chronologisch, neueste unten.

Datum-Konvention: absolute Daten (Lauf gestartet 2026-05-26).

---

## D000 — Umgebung & Toolchain (2026-05-26)
**Kontext:** Frische Umgebung ohne Node, ohne pip/venv, Python nur 3.14 (Projekt zielt auf 3.12).
**Entscheidung:**
- Toolchain via `apt-get` installiert: `python3-venv`, `python3-pip`, `nodejs` (v22), `npm` (v9).
- Backend-venv unter `backend/venv` angelegt (entspricht dem von `make test`/`make lint`
  erwarteten Pfad — `start.sh` nutzt dagegen `backend/.venv`; siehe Befund in ANALYSIS.md).
- Python 3.14 statt 3.12 verwendet, da 3.12 nicht verfügbar. Risiko: einzelne Deprecation-
  Warnings (z. B. `asyncio.iscoroutinefunction` in slowapi). Tests laufen trotzdem grün.
**Begründung:** Ohne lokale Toolchain ist weder Test noch Lint möglich; `backend/venv`
deckt die Makefile-Targets ab.

## D001 — Phasen 1 & 2 (PRs/Issues) sind leer (2026-05-26)
**Kontext:** `gh pr list` und `gh issue list` liefern beide `[]` — keine offenen PRs/Issues.
**Entscheidung:** Phase 1 & 2 entfallen inhaltlich; statt PR-/Issue-Abarbeitung fließt der
Fokus auf die analytischen Phasen 0/3/4/5 und die Library-Auslösung (Phase 6). Verwaiste
Branches werden in Phase 7 behandelt.
**Begründung:** Es gibt nichts zu mergen/schließen. Die Branch-Aufräumung bleibt relevant.

## D002 — Lebende Tracking-Dokumente direkt auf main (2026-05-26)
**Kontext:** TASKS.md, DECISIONS.md, ANALYSIS.md, AUDIT.md, FINAL_REPORT.md werden über
den gesamten Lauf hinweg fortlaufend aktualisiert. In Feature-Branches gehalten würden
sie ständig divergieren/Merge-Konflikte erzeugen.
**Entscheidung:** Diese reinen Koordinations-/Doku-Dateien werden direkt auf `main`
committet (keine Code-Änderung, Tests bleiben trivially grün). **Jede Code-Änderung**
läuft weiterhin strikt über Feature-Branch → `make lint`+`make test` → PR → CI.
**Begründung:** Hält Feature-PRs fokussiert auf echten Code; vermeidet künstliche
Doku-Merge-Konflikte; die Doku ist am Ende vollständig auf main reviewbar.
