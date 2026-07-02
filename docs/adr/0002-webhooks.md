# ADR 0002 — Ausgehende Webhooks (Design-Vorschlag, nicht umgesetzt)

- **Status:** Proposed (nur Design; Umsetzung erst bei konkretem Bedarf)
- **Date:** 2026-07-02
- **Scope:** Docs-only.

---

## Ziel

Externe Systeme (Lohnabrechnung, Chat-Benachrichtigungen, eigene Automatisierung)
sollen über Plan-Ereignisse informiert werden, ohne zu pollen: die API stellt
konfigurierbare HTTP-POST-Webhooks bereit.

## Abgrenzung

- **Nur ausgehend** (die API ruft fremde URLs); eingehende Integrationen bleiben
  die bestehende REST-API.
- **Optional und standardmäßig AUS**: ohne konfigurierten Endpoint ändert sich
  nichts am Verhalten (Simplicity-first-Regel „harte externe Abhängigkeiten nur
  optional").
- Kein Versand von Personaldaten über das Nötigste hinaus (IDs + Ereignistyp;
  Details holt sich der Empfänger authentifiziert über die API).

## Design-Skizze

1. **Ereignisse:** die bestehenden SSE-Broadcast-Punkte (`schedule_changed`,
   `absence_changed`, `employee_changed`, `swap_changed`, …) sind bereits die
   zentrale Ereignisquelle — Webhooks hängen sich an denselben Hook, keine
   zweite Ereignis-Taxonomie.
2. **Konfiguration:** `SP5_WEBHOOK_URLS` (kommagetrennt) + `SP5_WEBHOOK_SECRET`;
   später optional UI unter Administration (JSON-Store wie andere Einstellungen).
3. **Zustellung:** asynchron mit kurzer Retry-Kette (3 Versuche, Backoff),
   Timeout 5 s, Fehler werden geloggt und im Health-Endpoint gezählt — Zustellung
   darf NIE einen Schreibpfad blockieren (fire-and-forget nach Commit).
4. **Signatur:** `X-SP5-Signature: sha256=HMAC(secret, body)` wie bei GitHub;
   Body = `{event, entity, entity_id, timestamp}`.
5. **Tests:** Unit (Signatur, Payload), Integration mit lokalem Fake-Empfänger,
   Schreibpfad-Regression (Webhook-Ausfall verzögert keinen POST /schedule).

## Risiken / Abhängigkeiten

- **SSRF/Sicherheit:** URLs nur per Server-Env (kein freies UI-Feld in v1) —
  verhindert, dass ein Web-Admin interne Adressen anpeilt.
- **Zuverlässigkeit:** ohne persistente Queue gehen Events bei Neustart
  verloren; für v1 akzeptiert (Empfänger können via API nachladen), dokumentiert.
- **DSGVO:** minimale Payload (siehe Abgrenzung).

## Entscheidung

Vorgeschlagen, aber **nicht umgesetzt**: kein aktueller Bedarfsträger. Die Skizze
ist so geschnitten, dass die Umsetzung klein bleibt (ein Modul + Env-Config +
Hook an den Broadcast-Punkten) und den Default-Pfad unverändert lässt.
