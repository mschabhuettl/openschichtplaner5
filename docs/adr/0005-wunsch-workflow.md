# ADR 0005 — Wunsch-/Verfügbarkeits-Workflow mit Genehmigungskette (Design, nicht umgesetzt)

- **Status:** Proposed (nur Design; Umsetzung erst bei konkretem Bedarf)
- **Date:** 2026-07-02
- **Scope:** Docs-only. (ROADMAP §B Nr. 4)

---

## Ausgangslage

Bausteine existieren bereits: Schichtwünsche (WUNSCH/SPERRUNG je Tag),
Verfügbarkeits-Zeitfenster je Wochentag, und die Tauschbörse hat mit
`pending_partner → pending → approved/rejected` samt Status-Historie,
Benachrichtigungen und Planer-Entscheid ein erprobtes Genehmigungs-Muster.

## Ziel

Mitarbeiter planen sich per Self-Service in offene Dienste ein bzw. geben
Wunschpläne für einen Zeitraum ab; Planer genehmigen gesammelt — statt
Einzelwünsche nur als Information neben dem manuellen Planen zu sehen.

## Abgrenzung

- **Der genehmigte Plan bleibt die einzige Wahrheit** (5MASHI): Wünsche/
  Bewerbungen leben bis zur Genehmigung ausschließlich im JSON-Store (wie die
  Tauschbörse) und berühren die DBF-Schreibpfade erst beim Planer-Approve
  (dann über die bestehenden, validierten create-Pfade inkl. Dienst-Guards).
- Kein Auto-Placement in v1 (keine Optimierer-Magie): der Planer entscheidet;
  das System prüft nur hart die Eignung (bestehende Konflikt-/Restriktions-/
  Doppelbelegungs-Checks der Einspringer-Suche werden wiederverwendet).
- Optional: Feature hinter `SP5_SELF_SCHEDULING=1`; Default-Verhalten der App
  unverändert.

## Design-Skizze

1. **Datenmodell (JSON-Store, analog swap_requests):** `shift_applications`
   {id, employee_id, date, shift_id, status: offen|zurückgezogen|genehmigt|
   abgelehnt, created_at, resolved_by, Historie}.
2. **Angebotsseite:** Planer markiert offene Dienste („Ausschreibung") — v1
   minimal: jeder unbesetzte Bedarf aus Personalbedarf/Staffing gilt als offen.
3. **Self-Service:** Mitarbeiter sieht offene Dienste, die seine Eignung
   erfüllen (Wiederverwendung `is_eligible_replacement` + same_group-Rang),
   und bewirbt sich; Rücknahme bis zur Entscheidung.
4. **Genehmigung:** Planer-Sammelansicht je Tag/Schicht mit allen Bewerbungen;
   Approve schreibt über den normalen Schreibpfad (inkl. WPAST/Read-only-
   Gates) und lehnt konkurrierende Bewerbungen automatisch mit Grund ab.
5. **Benachrichtigungen:** bestehende create_notification/SSE-Kanäle.

## Risiken

- Erwartungsmanagement (Bewerbung ≠ Zusage) → klare Status-UI, wie Tauschbörse.
- Konkurrenz zweier Approves auf denselben Dienst → der zweite scheitert am
  bestehenden Dienst-Guard (Duplikat-Check) und wird sauber abgelehnt.
- Scope-Kriechen Richtung Auto-Planung → bewusst v1 ohne Optimierer.

## Entscheidung

Vorgeschlagen, aber **nicht umgesetzt**. Größtes der §B-Features; die Skizze
reduziert es auf Wiederverwendung dreier vorhandener Bausteine (JSON-Workflow-
Store, Eignungsprüfung, Schreibpfad-Gates) hinter einem Feature-Flag.
