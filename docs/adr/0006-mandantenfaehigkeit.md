# ADR 0006 — Mandantenfähigkeit (mehrere DBF-Datenbanken parallel, Design, nicht umgesetzt)

- **Status:** Proposed (nur Design; Umsetzung erst bei konkretem Bedarf)
- **Date:** 2026-07-05
- **Scope:** Docs-only. (ROADMAP §B Nr. 7)

---

## Ausgangslage

Heute ist genau **eine** Datenbank pro Prozess aktiv: `get_db()` baut bei jedem
Aufruf `SP5Database(main.DB_PATH)` aus einer Prozess-globalen `DB_PATH` (aus
`SP5_DB_PATH`); der veränderliche JSON-Zustand liegt unter dem globalen
`state_dir()` (`SP5_STATE_DIR`, sonst `backend_dir()/data`). Beides ist bereits
**injizierbar** — die Bausteine für eine Mandanten-Auflösung existieren also,
werden nur noch nicht pro Request gewählt.

## Ziel

Eine Instanz bedient mehrere getrennte Betriebe/Standorte, jeder mit eigener
DBF-Datenbank und eigenem 5USER-Login, mit einem Umschalter — ohne dass Daten
zwischen Mandanten sichtbar werden und ohne das Verhalten der
Ein-Mandanten-Installation zu ändern.

## Abgrenzung

- **Default unverändert:** Ohne Mandanten-Registry verhält sich die App exakt wie
  heute (ein Mandant = die konfigurierte `SP5_DB_PATH`). Feature hinter der
  Existenz einer Registry bzw. `SP5_TENANTS`-Konfiguration.
- **DBF-Verzeichnis pro Mandant** in v1; Schema-pro-Mandant für das
  PostgreSQL-Backend ist ein getrennter, späterer Schritt.
- **Keine mandantenübergreifenden Abfragen/Aggregationen** in v1 (harte Grenze,
  kein „alle Standorte"-Report).
- Kein Self-Service-Onboarding/Provisionierung; Mandanten werden vom Betreiber
  in der Registry gepflegt.

## Design-Skizze

1. **Registry:** `tenant_id → {dbf_path, display_name}` aus einer kleinen Config
   (`SP5_TENANTS` JSON bzw. Datei). Fehlt sie → Single-Tenant-Pfad wie heute.
2. **Request-Kontext:** Der aktive `tenant_id` kommt aus dem **JWT-Claim** (beim
   Login gesetzt) — NICHT aus einem frei wählbaren Header, damit ein Token an
   seinen Mandanten gebunden ist. Login zielt via Subdomain/`tenant`-Feld auf
   einen Mandanten; dessen 5USER wird geprüft.
3. **Auflösung:** `get_db()` liest `DB_PATH` aus `registry[ctx.tenant_id]` statt
   der Globalen; `state_dir()` wird `<base>/<tenant_id>/`. Da `SP5Database` ohnehin
   pro Aufruf frisch gebaut wird, ist das eine lokale Änderung der Pfad-Herkunft.
4. **Cache-Keying:** Der Prozess-Cache (`cache.*`) und alle Prefixe werden mit
   `tenant_id` präfixiert; sonst leckt z. B. eine `employees:`-Liste über Mandanten.

## Risiken

- **Import-fixe Modul-Konstanten sind der eigentliche Umbau:** `main.DB_PATH` und
  die JSON-Store-Pfade (`recurring_shifts._RECURRING_FILE`, `_NOTIF_FILE`,
  `_STATUS_FILE`, `_AVAILABILITY_FILE`, swap/wishes) sind heute **beim Import**
  gebunden. Für Mandantenfähigkeit müssen sie zu **pro-Request aufgelösten Pfaden**
  werden (Funktionsaufruf statt Konstante) — dieselbe Klasse, die die
  Test-Isolation (`_state_stores_in_tmp`) bereits pro Test umlenkt. Das ist der
  größte und heikelste Teil; ohne ihn leckt Zustand zwischen Mandanten.
- **Token-Isolation:** Ein Token von Mandant A darf B nie erreichen — der
  `tenant_id` muss im Token stecken und nach Auth immutabel sein (kein
  Mid-Request-Wechsel). Der bestehende Scope-/Sichtbarkeits-Layer filtert nur
  *innerhalb* einer DB; die DB-Wahl ist die neue äußere Grenze.
- **Ressourcen:** viele DBF-Handles/Prozess; ein LRU über geöffnete Mandanten
  begrenzt das.

## Entscheidung

Vorgeschlagen, aber **nicht umgesetzt**. Der Wert reduziert sich auf einen klar
abgegrenzten Kern — request-gebundener `tenant_id` (JWT), mandantenbewusste
Pfad-Auflösung (`DB_PATH` + `state_dir` + Cache-Prefix) hinter einer Registry,
Default-Single-Tenant unverändert. Voraussetzung ist die Ablösung der import-fixen
Pfad-Konstanten durch pro-Request-Auflösung; erst danach ist die
Mandanten-Isolation strukturell garantiert.
