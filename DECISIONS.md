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

## D003 — RBAC-Rollenwahl für availability-Writes (2026-05-26, PR #57)
**Kontext:** `POST/PUT /api/employees/{id}/availability` hatten keine Rollenprüfung.
Optionen: (a) `require_planer`, (b) Self-Service (Mitarbeiter setzt eigene Verfügbarkeit).
**Entscheidung:** `require_planer` (GET bleibt nur-auth).
**Begründung:** Konsistent mit allen anderen Write-Endpunkten; Self-Service hätte eine
verlässliche Session→Employee-Zuordnung gebraucht, die hier nicht etabliert ist. Minimal-
invasiv und schließt die Privilege-Escalation. Self-Service kann später additiv ergänzt werden.

## D004 — restriction DELETE → require_admin (2026-05-26, PR #57)
**Entscheidung:** `DELETE /api/restrictions/{emp}/{shift}` erhält `require_admin`,
symmetrisch zum bereits admin-geschützten POST.
**Begründung:** Asymmetrische Rechte sind ein klarer Bug; Admin ist die korrekte Schwelle,
da nur Admin Restriktionen anlegen kann.

## D005 — DBF numerischer Overflow: raise statt truncate (2026-05-26, PR #58)
**Entscheidung:** `_encode_field` wirft bei zu breitem Numerikwert `ValueError` statt zu schneiden.
**Begründung:** Stilles Abschneiden ändert die Größenordnung (99999→9999) und korrumpiert die
kanonische FoxPro-Datei. „Fail loud" ist hier sicherer als „fail silent"; bestehende Tests grün.

## D006 — Malicious fastapi 0.136.3 wegpinnen statt Advisory ignorieren (2026-05-26, PR #59)
**Kontext:** CI-Security-Audit rot wegen MAL-2026-4750 (fastapi 0.136.3 = manipulierte Release).
**Entscheidung:** `requirements.txt` auf `!=0.136.3` pinnen (statt `--ignore-vuln`).
**Begründung:** Eine als manipuliert geflaggte Release zu nutzen ist Supply-Chain-untragbar;
nur 0.136.3 ist betroffen, also surgisch ausschließen. Reversibel, hält Audit ehrlich.
