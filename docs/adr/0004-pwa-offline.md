# ADR 0004 — PWA-Offline-Ausbau (Design-Vorschlag, nicht umgesetzt)

- **Status:** Proposed (nur Design; Umsetzung erst bei konkretem Bedarf)
- **Date:** 2026-07-02
- **Scope:** Docs-only.

---

## Ausgangslage

Die App IST bereits eine installierbare PWA: `manifest.json`, Icons und ein
Service Worker (`public/sw.js`) mit Static-Asset-Cache und `offline.html`-
Fallback existieren. „Offline" heißt heute: die Hülle lädt, Daten nicht.

## Ziel

Lesender Offline-Zugriff auf den EIGENEN Plan (Mein Kalender / eigene Woche)
für Mitarbeiter unterwegs — der häufigste mobile Anwendungsfall.

## Abgrenzung

- **Nur lesend.** Offline-SCHREIBEN (Queue + Sync + Konfliktauflösung gegen die
  DBF-Quelle) wird bewusst ausgeschlossen: die Byte-Paritäts-Schreibpfade und
  die Konkurrenz-Semantik (flock, atomare IDs) vertragen keine nachträglich
  einspielten Offline-Änderungen ohne erheblichen Konflikt-Apparat.
- Gecacht wird NUR der Datenbereich des angemeldeten Nutzers (eigener Plan,
  eigene Abwesenheiten) — kein Offline-Cache fremder Personaldaten auf dem
  Gerät (DSGVO-Minimierung).
- Default unverändert: ohne Opt-in („Offline-Modus aktivieren" in den
  Einstellungen) cached der SW weiterhin nur statische Assets.

## Design-Skizze

1. **SW-Erweiterung:** stale-while-revalidate für `GET /api/v1/my/*`-Antworten
   des angemeldeten Nutzers in einem eigenen Cache-Bucket (`osp5-data-v1`),
   Invalidierung bei Logout; TTL 7 Tage.
2. **UI:** Offline-Banner („Stand: <Zeitpunkt des Caches>") in Mein-Kalender,
   wenn `navigator.onLine === false` bzw. der Fetch aus dem Cache kam.
3. **Sicherheit:** Cache-Bucket wird bei Logout/401 geleert; keine Tokens im
   Cache (Cookie-Auth bleibt HttpOnly).
4. **Tests:** SW-Unit (Cache-Strategie), Playwright offline-Emulation
   (context.setOffline) für Mein-Kalender.

## Risiken

- Stale-Daten-Verwechslung (Plan hat sich geändert) → Banner mit Zeitstempel
  ist Pflichtteil, nicht Kosmetik.
- SW-Update-Pfade (alte Caches) — bestehendes CACHE_NAME-Versionsschema
  weiterverwenden.

## Entscheidung

Vorgeschlagen, aber **nicht umgesetzt**; sauber abgegrenzt (nur eigener Plan,
nur lesend, Opt-in). Offline-Schreiben bleibt aus gutem Grund außerhalb des
Zuschnitts.
