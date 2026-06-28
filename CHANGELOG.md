# Changelog

All notable changes to OpenSchichtplaner5 are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Changed

- Keine wiederkehrende Trägheit mehr auf Deployments, deren DBF-Verzeichnis periodisch
  gespiegelt/neu synchronisiert wird (z. B. ein Bind-Mount mit 15-Minuten-Mirror): Bisher
  änderte jeder Sync die Datei-Zeitstempel und zwang die App, beim nächsten Seitenaufruf
  alle Tabellen neu einzulesen — auch wenn sich inhaltlich nichts geändert hatte. Das
  gebündelte Datenmodul (libopenschichtplaner5 1.14.3) erkennt jetzt inhaltsbasiert, ob
  eine Datei wirklich verändert wurde, und behält bei unverändertem Inhalt den vorhandenen
  Einlese-Stand. Die DBF-Dateien bleiben die alleinige Datenquelle; Schreibvorgänge gehen
  unverändert sofort byte-genau in die DBF.

---

## [1.10.4] - 2026-06-28

### Changed

- Schnelleres Laden, besonders bei großen Dienstplänen: Das gebündelte Datenmodul
  (libopenschichtplaner5 1.14.2) liest die DBF-Dateien effizienter ein und beantwortet
  Dienstplan-Abfragen über einen nach Monat gruppierten Index statt die gesamte
  Schicht-Tabelle pro Aufruf zu durchsuchen. Das verkürzt vor allem das erste Öffnen des
  Dienstplans und das Neuladen nach Änderungen; der Effekt wächst mit der Datenmenge. Die
  DBF-Dateien bleiben die alleinige Datenquelle, jeder Schreibvorgang geht unverändert
  sofort byte-genau in die DBF.

---

## [1.10.3] - 2026-06-28

### Added

- Dienstplan: Arbeitsplatz direkt im Zellen-Kontextmenü zuordnen oder entfernen. Per
  Rechtsklick auf eine Schicht erscheint „🏢 Arbeitsplatz…" (nur wenn unter Stammdaten
  Arbeitsplätze definiert sind); die aktive Zuordnung ist mit ✓ markiert, „✕ Arbeitsplatz
  entfernen" löst sie wieder, ohne die Schicht selbst zu löschen. Bisher war die
  Arbeitsplatz-Zuordnung nur über den Einsatzplan-Sonderdienst erreichbar.

---

## [1.10.2] - 2026-06-28

### Fixed

- Anmeldung mit Original-Schichtplaner5-Konten, deren Passwort nicht rein aus ASCII
  besteht: Konten mit Umlaut-Passwort oder aus neueren SP5-Versionen (die das Passwort
  intern als UTF-16-Zeichenkette ablegen) ließen sich nicht anmelden („Invalid username
  or password"), obwohl das Passwort korrekt war — nur reine ASCII-Passwörter
  funktionierten. Das gebündelte Datenmodul (libopenschichtplaner5 ≥ 1.14.1) prüft das
  Passwort jetzt wie das Original gegen beide Kodierungen (Windows-ANSI/CP1252 und
  UTF-16); falsche Passwörter werden weiterhin abgewiesen. Tipp: Für über einen
  Neustart hinweg gültige Sitzungen `SECRET_KEY` setzen (sonst pro-Prozess zufällig).

---

## [1.10.1] - 2026-06-28

### Fixed

- Schichtmodelle/Ausnahmen: Eine Modell-Ausnahme (5CYEXC) streicht jetzt schlicht den
  automatischen Zyklusdienst an diesem Tag (freier Tag). Die frühere Auswahl einer
  „Ersatzschicht" schickte deren Schicht-ID im Feld `type` an `POST /api/cycle-exceptions`,
  das nur 0/1 erlaubt → „422 – Must be at most 1"; die Funktion war faktisch unbenutzbar
  (5CYEXC besitzt kein Ersatzschicht-Feld). Wer eine andere Schicht möchte, stellt den Tag
  frei und trägt sie im Dienstplan ein.

---

## [1.10.0] - 2026-06-28

### Fixed

- Dienstplan-Undo/Redo und Verschieben bewahren jetzt die **Teiltags-Granularität**
  einer Abwesenheit: Wird eine vormittags-/nachmittags- oder stundenweise Abwesenheit
  gelöscht und per Rückgängig wiederhergestellt (oder in eine andere Zelle verschoben),
  kommt sie nicht mehr als ganztägig zurück. Nutzt die neuen Teiltags-Felder aus
  `GET /api/schedule` (ROADMAP §A.10; erfordert das gebündelte API ab 1.9.0 / lib 1.14.0).

---

## [1.9.2] - 2026-06-28

### Fixed

- Dienstplan: Stundenweise Teiltags-Abwesenheiten (Auswahl „Std." mit Von-/Bis-Uhrzeit)
  ließen sich nicht speichern — die Uhrzeiten wurden als „HH:MM" statt als Minuten an die
  API geschickt, die mit „422 – start_time: Must be an integer" ablehnte. Die Umrechnung
  erfolgt jetzt vor dem Senden; vormittags/nachmittags/ganztägig waren nie betroffen.

---

## [1.9.1] - 2026-06-17

### Changed

- Dienstplan: Beim Eintragen einer Abwesenheit über den Schnelleintrag werden die
  Backend-Hinweise jetzt als Toast angezeigt (z. B. „Urlaubssperre für …", Feiertag) —
  bisher erschienen sie nur im Urlaub-Fenster. Weiche Hinweise; die Eintragung bleibt
  bestehen.

---

## [1.9.0] - 2026-06-17

### Added

- Neuer Bericht **„Zeitzuschläge je Tag"** (Spec 3.8): listet die Zuschlagsstunden
  je Mitarbeiter und Tag im Zeitraum (Von/Bis) mit Summe je Mitarbeiter, als Druck
  oder CSV; berücksichtigt den Gruppenfilter. Nutzt den neuen API-Endpoint
  `GET /api/extracharges/by-day`.

---

## [1.8.0] - 2026-06-16

### Added

- Bericht „Dienstplaneinträge (Liste)": Auswahl der **Datenbasis** Istplan /
  Sollplan / Soll- & Istplan (Spec 4.12). Der Bericht zeigt die gewählte Datenbasis
  im Kopf; bei „Soll- & Istplan" sind Sollplan-Schichten in der Art-Spalte mit
  „· Soll" gekennzeichnet.
- Bericht „Dienstplaneinträge (Liste)": optionale **Untergliederung** je Mitarbeiter
  nach **Kalenderwoche** (ISO-8601) oder **Monat** — mit Zwischenüberschrift und
  Zwischensumme je Untergruppe, in Druck und CSV.
- Bericht „Dienstplaneinträge (Liste)": Option **„Mitarbeiter ohne Einträge zeigen"**
  (Nullzeilen) — führt auch Mitarbeiter der gewählten Gruppe ohne Einträge im Zeitraum
  als Leerzeile mit (sonst nur Mitarbeiter mit mindestens einem Eintrag).

### Fixed

- Dienstplan-Undo/Redo bewahrt jetzt den **Soll-/Istplan-Typ** und die
  **Arbeitsplatz-Zuordnung** eines Schichteintrags: Wird ein Sollplan- oder ein
  einem Arbeitsplatz zugeordneter Eintrag gelöscht und per Rückgängig
  wiederhergestellt, kommt er nicht mehr als einfacher Istplan-Eintrag ohne
  Arbeitsplatz zurück (Detailtreue, ROADMAP §A.10).

---

## [1.7.0] - 2026-06-16

### Added

- Sonderdienst-Dialog (Einsatzplan): frei wählbare Hintergrund- und Schriftfarbe
  sowie ein Feld für die Arbeitsstunden des Sonderdienstes. Die Arbeitsstunden
  sind mit den Iststunden der gewählten Schicht am jeweiligen Tag vorbelegt und
  frei überschreibbar; Farben und Stunden gelten beim Neuanlegen wie beim
  Bearbeiten. Bisher übernahmen Sonderdienste nur die Schichtfarbe und wurden mit
  0 Arbeitsstunden gespeichert — ein per Web angelegter Sonderdienst zählt damit
  nun korrekt zu den Iststunden.
- Sonderdienst-Dialog: Mehrtages-Erfassung. Über ein optionales Bis-Datum wird der
  Sonderdienst für jeden Tag des Zeitraums (max. 92 Tage) in einem Rutsch angelegt;
  der Vorgang lässt sich als Ganzes per Rückgängig wieder entfernen.
- Gekennzeichnete Zeiträume (Perioden) erhalten eine wählbare Farbe und werden im
  Dienstplan farbig hinterlegt: die betroffenen Tagesspalten tragen im Kopf einen
  farbigen Balken in der Periodenfarbe; die Bezeichnung erscheint beim Überfahren
  des Spaltenkopfs (Original „gekennzeichnete Zeiträume", R5.10-8/11).
- Urlaubssperren: Beim Eintragen einer Abwesenheit in einem gesperrten Zeitraum
  zeigt das Urlaub-Fenster jetzt einen Hinweis (weiche Warnung, Eintragung bleibt
  möglich) — getrieben vom neuen API-Warnfeld.

---

## [1.6.2] - 2026-06-16

### Changed

- Release-Pipeline auf den vollständigen Standard angehoben: das App-Image-
  Release trägt nun eine Build-Provenance-Attestation, je Image wird ein
  SPDX-SBOM erzeugt, attestiert und dem GitHub-Release als Asset beigelegt
  (zusätzlich die Stack-Compose `docker-compose.stack.yml`). Multi-Arch
  (amd64+arm64) und die ghcr-Tags Version/Minor/`latest` bleiben unverändert.
  Optionale cosign-Signierung über die Repo-Variable `ENABLE_COSIGN`.

---

## [1.6.1] - 2026-06-16

### Fixed

- **Sidebar-Icons** ragen nicht mehr über die Seitenleiste: die Action-Icons im
  Kopf (Warnungen/Benachrichtigungen/Suche/Hilfe/Erste-Schritte/Tour) brechen jetzt
  um, statt die `w-56`-Zeile zu sprengen.
- **Dark-Mode-Schalter** unten links wird nicht mehr „zerrissen" dargestellt: der
  Schiebeknopf war ohne `left`-Anker, der Browser löste `left:auto` auf seine
  statische Position auf und der Knopf rutschte im An-Zustand über den Pillen-Rand —
  jetzt `left-0` als Translate-Ursprung + durchgehend weißer Knopf.
- **All-in-One-Image schreibt gemountete Daten-Verzeichnisse** (Entrypoint): behebt
  „Interner Serverfehler" beim Speichern, wenn das DBF-Verzeichnis vom Host
  eingebunden wird (gleiche gosu-Lösung wie im API-Image; Auto-Backups in
  `SP5_BACKUP_DIR`).

### Added

- E2E-Regressionssuite (echter Login, Produktionsmodus, Nicht-localhost-Herkunft)
  gegen alle sechs in Zyklus 8 reproduzierten Symptome; läuft in CI und wird rot,
  wenn ein Fix zurückgenommen wird.

### Changed

- Docker-Pins nachgezogen: `LIB_SOURCE` → `==1.12.0`, `API_SOURCE` →
  `openschichtplaner5-api==1.6.0`.

---

## [1.6.0] - 2026-06-12

### Added

- Mitarbeiter-Detailseite (`/mitarbeiter/:id`): die Übersicht bündelt jetzt auch
  die **Schichteinschränkungen** des Mitarbeiters (mit „verwalten →"-Verweis) —
  Ein-Ort-Zusammenführung von Stammdaten, Kontakt/Notizen, Gruppe, Qualifikationen,
  Verfügbarkeit, Statistik, Abwesenheiten und Einschränkungen wie im Original.
- Stammdaten: **manuelle Reihenfolge** (programmweite POSITION-Sortierung) — ein
  „↕ Reihenfolge"-Dialog (▲/▼) auf Mitarbeiter, Schichtarten, Abwesenheitsarten
  und Arbeitsplätzen; die Mitarbeiter-Reihenfolge gilt direkt im Dienstplan.
- Einsatzplan: **Sonderdienst bearbeiten** — bestehende Sonderdienste lassen sich
  jetzt nachträglich ändern (Kontextmenü „Sonderdienst bearbeiten", `PUT`), nicht
  mehr nur löschen+neu. Zudem **freier Name/Kürzel** je Sonderdienst (abweichend
  von der Schichtbezeichnung). (Freie Farben/getrennte Arbeitsstunden/Mehrtages-
  Erfassung bleiben offen — ROADMAP §A.6.)
- Einstellungen: konfigurierbare **Startseite** — die Seite, die beim Öffnen/
  Anmelden direkt erscheint (Dashboard, Dienstplan, Einsatzplan, Wochenansicht,
  Mein Kalender). Planer können so direkt im Dienstplan starten; spätere Klicks
  auf „Dashboard" bleiben unberührt.

---

## [1.5.0] - 2026-06-12

### Added

- Dienstplan: **Monats-Schnellwahl** — die Monatsanzeige ist ein Direktwahl-
  Dropdown (Januar…Dezember); ein Klick springt in jeden Monat (analog zur
  12-Monats-Leiste des Originals). ‹/›, Heute und Strg+G bleiben.
- Dienstplan: die Auslastungsanzeige je Mitarbeiter zeigt zusätzlich den **Saldo
  (Ist − Soll)** als signierte, farbcodierte Kennzahl in der Namensspalte — die
  Stunden-Bilanz ist so beim Planen sichtbar, ohne die Personaltabelle zu öffnen.

---

## [1.4.0] - 2026-06-12

### Added

- Einschränkungen: Grad-Auswahl (nie / auf Anfrage / keine, Spec 4.11) in der
  Einschränkungs-Maske; „auf Anfrage" lässt die Eintragung mit Warnung zu.
- Dienstplan: Gruppen-Verknüpfung Vereinigung/Schnittmenge (Spec 4.6.3) bei
  Mehrfach-Gruppenauswahl.
- Dienstplan: Kalenderwochen-Anzeige (Spec 4.11) — „KW"-Umschalter blendet die
  ISO-Kalenderwoche im Tageskopf (montags) ein.
- Dienstplan: Arbeitsplatz-Filter (Spec 4.7) in der Filterleiste; Einträge zeigen
  den Arbeitsplatz-Namen; neue Einträge/Bestandseinträge können einem Arbeitsplatz
  zugeordnet werden.
- Dienstplan: Soll-/Istplan-Umschalter (Istplan / Sollplan / Soll- & Istplan,
  Spec 4.12). Sollplan-Einträge werden mit „S" und gestricheltem Rahmen
  gekennzeichnet; die Auto-Planung/Eintragung schreibt standardmäßig Istplan.
- Benutzerverwaltung: dreiwertige Einstellung „Abwesenheiten anzeigen"
  (vollständig / anonymisiert / gar nicht) je Nicht-Admin-Benutzer. Anonymisierte
  bzw. ausgeblendete Abwesenheiten werden serverseitig durchgesetzt und wirken im
  Dienstplan, Einsatzplan und Dienstplan-Druck (Spec 9.5.2 / 9.2).

---

## [1.3.0] - 2026-06-12

### Fixed
- **Anmeldung wieder funktionsfähig:** Demo-Konten (`admin`/`planer`/`leser`,
  `Test1234`) und vom Original angelegte Konten melden sich wieder an und
  bleiben angemeldet (Folge-Requests autorisiert).
- **Seitenleiste:** Navigations-Icons können nicht mehr über den Rand
  hinausragen (Icon/Badge `flex-shrink-0`, Label `truncate`).
- **Dialoge:** sichtbares Hover-/Fokus-Feedback an Schließen-/Zurück-Schaltern;
  hohe Formular-Modals scrollen statt überzulaufen.
- **Einschränkungen:** Wochentag-Auswahl nutzt den Original-Tagindex
  (Mo..So = 0..6, Feiertag = 7) statt „0=alle".

### Changed
- **Dev-Modus-Umschalter:** die zu Admin redundante „dev"-Stufe entfernt — der
  Umschalter dient nur noch dem Testen niedrigerer Stufen (Planer/Leser).
- **Notfallplan:** die Ersatzsuche bietet nur noch geeignete Mitarbeiter an
  (Bereich/Verfügbarkeit/Restriktionen).

### Added
- **Release-Vorbereitung per Workflow (`prepare-release.yml`):** hebt die
  Version (`frontend/package.json` + Lockfile, README-Badge) an, schneidet die
  `[Unreleased]`-Sektion der CHANGELOG zur Versions-Sektion und pusht Commit +
  annotiertes Tag — das Publish bleibt tag-getrieben. Trockenlauf-Modus
  (Default) zeigt den geplanten Stand nur im Step-Summary; fehlende oder leere
  `[Unreleased]`-Sektionen werden abgelehnt. Ablauf dokumentiert in
  `RELEASING.md`.
- **Gesamt-Stack-Compose `docker-compose.stack.yml`:** fährt App und API als
  getrennte Container — nginx (Stage `frontend-static`) served das SPA und
  proxied `/api` an den API-Container, der aus dem Geschwister-Repo
  `../openschichtplaner5-api` gebaut wird; optionales `postgres`-Profil für den
  PostgreSQL-Betrieb inkl. dokumentiertem einmaligem DBF→PG-Seed-Schritt.

### Changed
- **Docker-Builds installieren Library und API standardmäßig von PyPI:** die
  Build-Args `LIB_SOURCE`/`API_SOURCE` defaulten auf die Pins
  `libopenschichtplaner5[postgres]==1.7.0` / `openschichtplaner5-api==1.2.0`
  und bleiben mit beliebigen pip-Requirements (z. B. `git+https://…@main`)
  überschreibbar; `backend/requirements.txt` hebt die Untergrenzen auf
  `>=1.7.0` / `>=1.2.0`.
- **Doku konsolidiert:** README verschlankt (Kern-Infos + Verweis auf das
  [GitHub-Wiki](https://github.com/mschabhuettl/openschichtplaner5/wiki));
  PostgreSQL-Anleitung von `backend/` nach `docs/POSTGRESQL.md` verschoben;
  Entwickler-Setup in `docs/DEVELOPMENT.md` zusammengeführt; `docs/API.md` um
  Personaltabelle, Resturlaub-Verfall und den freien Statistik-Zeitraum
  (`from`/`to`) ergänzt; veraltete Planungsdokumente entfernt;
  Architektur-Dokument auf Stand 1.2.0 gehoben.

### Fixed
- **PostgreSQL-Seed-Skript an die aktuelle ORM-Modellstruktur angepasst:**
  `scripts/seed_postgresql.py` importierte Modelle aus einem nicht mehr
  existierenden Modul (ImportError mit Library 1.7.0) und scheiterte beim
  Befüllen der Gruppenzuordnungen an nicht-eindeutigen DBF-IDs — Importe
  repariert, Gruppenzuordnungen werden wie in der Library über das Paar
  (Mitarbeiter, Gruppe) dedupliziert.
- **nginx-Stage-Healthcheck:** prüft `127.0.0.1` statt `localhost` —
  busybox-wget löste `localhost` nach `::1` auf, nginx lauscht im Container
  aber nur auf IPv4; der Healthcheck schlug dadurch dauerhaft fehl.

---

## [1.2.0] - 2026-06-11

### Fixed
- **Nginx-Produktion: SSE lief über den generischen `/api/`-Block.** Der
  Frontend-Hook `useSSE` verbindet sich mit `/api/v1/events`; der bisherige
  `location`-Block `/api/sse` griff nie, wodurch Events gepuffert wurden und
  Verbindungen nach 60 s getrennt wurden. Die SSE-Location zeigt jetzt auf
  `/api/v1/events` mit `proxy_buffering off` und `proxy_read_timeout 3600s`;
  das Reverse-Proxy-Beispiel im README ist entsprechend korrigiert.
- **Makefile: `lint` und `test` schluckten Fehlercodes** (`|| true` und
  `2>/dev/null` entfernt — Befunde lassen die Targets jetzt fehlschlagen);
  redundantes `mypy`-Ziel entfernt, Playwright in eigenes Ziel `test-e2e`.
- **Removed the dead root `tests/test_thread_safety.py`.** It still imported
  `backend.sp5lib` — broken since the library extraction (#61) — and was
  referenced by no runner (neither Makefile nor CI). The tests cover sp5lib
  internals (DBF-cache integrity and lock reentrancy under concurrent load)
  and now live in the
  [libopenschichtplaner5](https://github.com/mschabhuettl/libopenschichtplaner5)
  test suite, rewritten against the installed package and run by that repo's CI.
- **`SP5_DB_PATH` defaults unified.** Four places disagreed about where the DBF
  database lives: `.env.example` shipped a cwd-relative `../sp5_db/Daten`
  (which resolved differently under start.sh than its own fallback and was
  plain broken in Docker), the default compose mounted the data volume at
  `/app/sp5_db` while the image ENV and the prod compose said `/app/data`, and
  `docs/DEPLOYMENT.md` advised a bind mount at a path the configured
  `SP5_DB_PATH` never read. Now: Docker uses **`/app/data`** everywhere (image
  ENV, both compose files, `.env.docker`, docs — DBF files in the `sp5_data`
  volume root, working out of the box with no `.env` entry); locally the
  default is `../sp5_db/Daten` next to the repo, and start.sh resolves
  relative values against the repo root (cwd-independent) and exports the
  result. `openschichtplaner5-api` 1.1.3 additionally publishes its default
  into the environment so `sp5lib.auto_migrate` and the admin backup endpoints
  always see the same path as the API.
  **Migration (default compose only):** if your `.env` sets
  `SP5_DB_PATH=/app/sp5_db/...`, change it to `/app/data/...` — the volume
  content itself is unchanged.
- **Docker: runtime state was unwritable.** `/app/backend` was root-owned and both
  compose files run the container with `read_only: true`, so every JSON-state
  write (changelog, notification settings, webhooks, availability …), photo
  uploads and the auto-migrate backup directory failed with `EACCES`/`EROFS` —
  mutating endpoints could 500 after the DBF write had already succeeded. The
  mutable paths under `SP5_BACKEND_DIR` (`backend/data`, `backend/api`,
  `backend/backups`) are now `sp5`-owned in the image and mounted as named
  volumes (`sp5_state`, `sp5_api_state`, `sp5_backups`) in both compose files —
  seeded from the image on first start, persistent across container recreation,
  while the root FS stays read-only. The DB-volume mountpoint `/app/sp5_db` is
  now also created `sp5`-owned (the startup auto-backup writes next to the DBF
  data). `make backup` archives the new state volumes alongside the database.
- **Docker: image was unstartable on Python 3.11.** The API uses PEP-695
  generics (`class PaginatedResponse[T]`, since the pagination feature), which
  need Python 3.12 — the container crashed on import. Base image bumped
  `python:3.11-slim` → `python:3.12-slim` (matches CI and the ruff target);
  `openschichtplaner5-api` 1.1.2 declares `requires-python >=3.12`.
  `backend/.venv` is now dockerignored so local builds don't bake the dev venv
  into the image.
- **Honour documented config env vars (#151, #152, #153):** `LOG_LEVEL`, `LOG_FILE`, `BRUTE_FORCE_MAX_ATTEMPTS`, `BRUTE_FORCE_LOCKOUT_MINUTES`, `RATE_LIMIT_API`, `RATE_LIMIT_LOGIN` and `SESSION_CLEANUP_INTERVAL_MINUTES` were documented in `.env.example` but hardcoded/ignored in code — they now take effect (defaults unchanged, so non-breaking). `LOG_FILE` creates its parent directory and falls back safely to `/tmp` on error.
- **`ShiftResponse` schema key (#145):** the shift response model declared the phantom `HIDDEN` field; corrected to the real DBF key `HIDE` (+ `POSITION`), so the OpenAPI schema no longer advertises an always-null field.

### Changed
- **API extracted into its own repo:** the REST API (formerly `backend/api/`) now
  lives in [openschichtplaner5-api](https://github.com/mschabhuettl/openschichtplaner5-api)
  — extracted with full git history (`git filter-repo`), packaged as
  `openschichtplaner5-api` (on PyPI), importable as **`sp5api`** (mirroring
  `libopenschichtplaner5` → `sp5lib`). The app consumes it via
  `backend/requirements.txt`; the backend test suite moved with it. The ASGI
  entrypoint is now `sp5api.main:app` (start.sh, Dockerfile, CI updated);
  `SP5_BACKEND_DIR` is set explicitly so the packages find `backend/data`,
  `backend/api/data` and the Alembic dir; the built SPA path is overridable via
  `SP5_FRONTEND_DIST`. `backend/api/` keeps only runtime state (`api/data`,
  `api/uploads`); the e2e fixture DBFs moved to `backend/fixtures/`. New
  `make dev-link` installs local sibling clones of the library and the API
  editable into `backend/.venv` for three-repo development.
- **Repo-Hygiene:** veraltetes `frontend/coverage/`-Artefakt
  und tote `backend/.env.docker` aus Git entfernt, `.gitignore` konsolidiert
  (`.vscode/settings.json`/`extensions.json` bleiben bewusst getrackt);
  Doku-Drift behoben
  (React 19, 77 Seiten, `/api/v1`-Pfade, ADR-0001 Accepted);
  `VerfügbarkeitsMatrix.tsx` → ASCII-Dateiname `VerfuegbarkeitsMatrix.tsx`;
  tote Typ-Duplikate aus `types.ts` und die Übergangs-Union
  `'low'|'critical'` aus `CoverageDay.status` entfernt.

### Added
- **ORM-Mirror Admin API (#131):** New admin-only router under `/api/admin/orm` exposing a read-only ORM projection of the DBF master-data definition tables (shifts, leave types, workplaces). `POST /api/admin/orm/sync` materializes the mirror into its own `sp5_orm.db`; `GET /api/admin/orm/shifts`, `/leave-types`, `/workplaces` list the definitions (with an `include_hidden` query). The DBF files remain the source of truth — this is the gradual DBF → ORM migration path. Consumes `libopenschichtplaner5 >=1.2.0` (Shift/LeaveType/Workplace models + repositories + sync).
- **ORM-Mirror Schedule Entries (#133):** Extended the ORM mirror with schedule-entry endpoints — `GET /api/admin/orm/shift-assignments` (`5MASHI`), `/special-shifts` (`5SPSHI`) and `/absences` (`5ABSEN`) — each filterable via `date_from`/`date_to` (inclusive ISO dates) and `employee_id` query params. `POST /api/admin/orm/sync` now covers all six tables. Bumps the `libopenschichtplaner5` consumption to `>=1.3.0` (schedule-entry models with date-range repositories; `sync_all` is now dangling-FK tolerant on dirty data).
- **ORM-Mirror Calendar Data (#138):** Extended the ORM mirror with calendar endpoints — `GET /api/admin/orm/holidays` (`5HOLID`, with an optional `year` query that also returns recurring holidays) and `/periods` (`5PERIO`). `POST /api/admin/orm/sync` now mirrors all 11 supported tables (adds employees, groups and group assignments alongside holidays and periods); `sync_group_assignments` dedups and skips dangling rows so `sync_all` runs cleanly on dirty DBF data. Bumps the `libopenschichtplaner5` consumption to `>=1.4.0`.
- **ORM-Mirror Time Accounting (#139):** Extended the ORM mirror with time-accounting endpoints — `GET /api/admin/orm/bookings` (`5BOOK`) and `/overtime` (`5OVER`), each filterable via `date_from`/`date_to` (inclusive ISO dates) and `employee_id`, plus `/leave-entitlements` (`5LEAEN`), filterable via `year` and `employee_id`. Bumps the `libopenschichtplaner5` consumption to `>=1.5.0`.
- **ORM-Mirror Planning Data (#141):** Completed the read mirror with planning endpoints — `GET /api/admin/orm/shift-demands` (`5SHDEM`, filterable via `shift_id`/`weekday`/`group_id`), `/special-demands` (`5SPDEM`, filterable via `date_from`/`date_to`/`shift_id`), `/cycles` (`5CYCLE`, with `include_hidden`), `/cycle-assignments` (`5CYASS`, filterable via `employee_id`/`cycle_id`) and `/restrictions` (`5RESTR`, filterable via `employee_id`/`shift_id`). `POST /api/admin/orm/sync` now covers **all 19 supported tables**, so the read-only ORM mirror spans the full DBF schema. Bumps the `libopenschichtplaner5` consumption to `>=1.6.0`.
- **ORM-Mirror status endpoint (#144):** `GET /api/admin/orm/status` reports the live per-table row counts of the mirror (all 19 tables) plus `mirror_db_exists` and `total_rows`, without triggering a re-sync — a cheap freshness check before `POST /sync`.
- **ORM-Mirror admin UI (#147):** New admin-only **"ORM-Spiegel"** page (`/orm-mirror`) showing the mirror status (per-table counts) with a "Jetzt synchronisieren" button — a usable face for the mirror endpoints.
- **Dienstplan: Mehrfacheinträge, Konfliktdialog, Besetzungs-Ampel:** Das Dienstplan-Grid
  stapelt jetzt Mehrfacheinträge pro Zelle (Dienst + Abwesenheit) mit
  Kontextmenü-Aktionen je Eintrag; ein Konfliktdialog
  „Zusätzlich/Ersetzen/Abbrechen" (wie im Original) mit merkbarer Strategie sichert
  Klick-Eintragung und Drag & Drop in belegte Felder ab; die
  Personalbedarfs-Ampel zeigt Unter-/Über-/Normalbesetzung je Tag; generierte
  Zyklusdienste sind im Dienstplan und im Einsatzplan gekennzeichnet (↻,
  Schraffur) und beim Löschen/Verschieben/Kopieren sicher behandelt;
  Heute-Button und Datumssprung (Strg+G) ergänzen die Navigation.
- **Teiltags-Abwesenheiten:** ganz/vormittags/nachmittags/stundenweise
  (`5ABSEN.INTERVAL`) in Dienstplan-Picker, Kontextmenü und Urlaub-Erfassung,
  inkl. Zeitfenster bei stundenweiser Abwesenheit.
- **Jahresübersicht als Jahres-Tagesraster:** neues 12×31-Raster je
  Mitarbeiter mit Dienstplan-Farben, Feiertags-/Wochenend-Markierung und
  Zyklus-Kennzeichnung; Klick auf eine Zelle öffnet den Monat im Dienstplan.
  Die bisherige Aggregat-Ansicht bleibt als Modus „Zusammenfassung" erhalten.
- **Granulares Rechte-Gating:** Bedienelemente in Dienstplan,
  Einsatzplan, Urlaub, Notizen, Tauschbörse und Mitarbeiterverwaltung folgen
  jetzt den feingranularen Benutzerrechten (`WDUTIES`, `WABSENCES`, `WPAST`,
  `WNOTES`, `WDEVIATION`, `WSWAPONLY`, `ADDEMPL`) aus `/api/auth/me`.
- **Stammdaten-Tiefe:** Schichtarten-Dialog mit Zeiten-Tabelle
  über 8 Tagestypen (Mo–So + Feiertag), bis zu drei Zeiträumen je Tagestyp und
  Arbeitszeit-Autoberechnung; Personalbedarf mit Feiertagsspalte, „kein
  Maximum" und besonderem Bedarf über Von/Bis-Zeiträume; mehrere
  Schichtmodell-Zuordnungen je Mitarbeiter mit Einstiegsposition.
- **Feiertage & Jahresabschluss:** halbe Feiertage
  (vormittags/nachmittags) und „auch in den folgenden 9 Jahren anlegen";
  Jahresabschluss-Option „Urlaubsansprüche bleiben im Folgejahr gleich";
  Admin-Funktion „Resturlaub verfallen lassen (Stichtag)" mit
  Dry-Run-Vorschau.
- **Abwesenheitsarten-Anrechnung:** `CHARGETYP`-Konfiguration
  (Keine/Abwesenheitszeit/feste Stundenzahl je Tag) im
  Abwesenheitsarten-Dialog.
- **Personaltabelle & Berichte:**
  Personaltabelle nutzt `/api/personnel-table` mit frei wählbarem
  Auswertungszeitraum; neuer Bericht „Dienstplaneinträge (Liste)" mit
  Druckansicht und CSV-Export (UTF-8 + BOM).
- **Import-Interop:** Importer erkennt UTF-16-Dateien per BOM und
  Tab/Komma/Semikolon als Trennzeichen (Original-Exporte direkt importierbar),
  akzeptiert Farbwerte als Dezimal-COLORREF und fragt vor dem Import-Start
  nach Bestätigung.
- **Einstellungen: Reset der gemerkten Konflikt-Strategie.** Eine per
  „merken"-Häkchen gespeicherte Standard-Aktion des Dienstplan-Konfliktdialogs
  (hinzufügen/ersetzen) lässt sich jetzt auf der Einstellungen-Seite wieder
  auf „immer fragen" zurücksetzen.

### Security
- **JWT secret now honours `SECRET_KEY` (#150):** The signing secret previously read only `SP5_JWT_SECRET`, while `.env.example`, the README, the deployment docs and `start.sh` all use `SECRET_KEY` — so a deployment following the docs silently signed tokens with a random per-process key (sessions broke on every restart and across workers). `SECRET_KEY` is now honoured (`SP5_JWT_SECRET` kept as an alias) and the shipped `change-me…` placeholder is treated as unset.
- **Startup warning for missing JWT secret (#149):** In production (not dev/debug) the app now logs a prominent warning when no real JWT secret is configured, instead of silently using a random per-process fallback.

### Accessibility
- **Modal focus management (#132, #136):** Added a shared `useFocusTrap` hook (Tab cycling that skips disabled controls, Escape, focus restoration) and migrated `FormModal`/`ConfirmDialog` to it; `PhotoCropDialog` and `KeyboardShortcutsModal` gained proper focus trapping.
- **Table headers & live regions (#137, #143):** Added `scope` to data-table headers across all pages (WCAG 1.3.1) and `role="status"`/`aria-live` to the empty/loading/error state components so screen readers announce async state changes.

### Improved
- **Full OpenAPI tag descriptions (#146):** every API tag group is now described in the Swagger UI (Reports, Notifications, ORM Mirror, …), with a regression-guard test.
- **Deployment docs (#155):** documented the single-worker / in-process-session caveat and the `SECRET_KEY` requirement for production.

---

## [1.1.0] - 2026-03-28

### Added
- **Scheduled Reports (Q094):** Automatic report generation and email delivery on configurable schedules (daily, weekly, monthly). Supports PDF/XLSX formats with recipient management.
- **Keyboard Navigation (Q093):** Complete keyboard accessibility across all views — arrow keys for schedule navigation, Tab for form controls, Enter/Space for actions, Escape to close modals.
- **Rate-Limit Dashboard (Q092):** Admin dashboard showing API rate-limit status, top consumers, and throttle statistics with real-time updates.
- **Employee Photo Upload (Q091):** Profile photo upload with client-side crop/resize. Photos stored efficiently and displayed in employee lists and profiles.
- **Auto DB Migration (Q090):** Automatic database schema migration on version updates — detects schema changes and applies them safely on startup.
- **Drag & Drop Calendar (Q089):** Drag & drop shift assignment in the calendar view for intuitive schedule editing.
- **API Versioning (Q088):** Versioned API routes under `/api/v1/` with OpenAPI docs. Unversioned routes return deprecation headers with sunset dates.
- **PostgreSQL Support (Q086):** PostgreSQL as an alternative database backend alongside SQLite/DBF. Full feature parity with connection pooling and optimized queries.

### Improved
- **Dark Mode (Q087):** Improved dark mode consistency across all components — unified color variables, better contrast ratios, and system preference detection.
- **2FA Screenshots:** Accurate profile screenshots showing 2FA setup section.
- **Documentation Screenshots:** Fresh screenshots for all 74+ pages.

### Fixed
- **Post-v1.0.0 Stabilization (S004):** Comprehensive test coverage improvements, resource warning fixes, and edge case handling.

---

## [1.0.0] - 2026-03-27

### 🎉 Production Release

OpenSchichtplaner5 v1.0.0 — the first stable production release. A fully-featured, open-source web replacement for the proprietary Windows software Schichtplaner5, reading and writing the original DBF database files directly.

### Added
- **Onboarding Checklist (Q085):** Non-blocking checklist card on the Dashboard for new admins. Tracks setup progress (company, shift types, employees, first schedule) with localStorage persistence and dismiss button. Auto-detects completion via API checks.
- **Qualifikations-Matrix (Q084):** Backend API for employee qualifications/skills matrix with CRUD endpoints. Enables tracking of certifications, training, and skill levels per employee.
- **Konflikt-Report UI (Q083):** Dedicated conflict report page with summary bar, type filters (overlap, understaffing, rule violations), and CSV/XLSX export.
- **Schedule PDF Export (Q082):** Print-optimized HTML-based PDF export endpoint for schedule data.
- **Arbeitszeit-Regelwerk UI (Q081):** Frontend interface for configuring working time rules (max hours/day, minimum rest, max consecutive days) with violation highlighting in schedule view.
- **Notification Settings (Q080):** Per-user email notification preferences with toggleable event types (shift changes, swaps, approvals, comments).
- **Arbeitszeit-Regelwerk Backend (Q079):** Configurable rule engine for working time compliance with automated violation detection.
- **Mitarbeiter-Timeline (Q078):** Horizontal CSS timeline showing shifts and absences per employee on a unified time axis.
- **Schicht-Konflikt-Report Backend (Q077):** Automated conflict detection covering overlap, double-booking, and understaffed periods with severity indicators.
- **Abwesenheits-Statistiken UI (Q076):** Multi-tab absence statistics with overview, group, and employee views. CSS-based charts for type distribution and monthly trends.
- **Export-Scheduler UI (Q075):** Full CRUD interface for scheduled report exports with recipient management and manual trigger.
- **Abwesenheits-Statistiken Backend (Q074):** Per-employee breakdown, group comparison, and organization-wide absence statistics.
- **Recurring Shifts UI (Q073):** Frontend for managing recurring shift templates (weekly/biweekly) with 🔁 badge on auto-generated instances.
- **Schicht-Tausch Erweiterungen (Q072):** Swap request notifications (in-app + email), full status history log, auto-expiry after configurable days.
- **Überstunden-Dashboard (Q071):** Visual bar chart with color-coded overtime balances per employee (green/yellow/red).
- **Export-Scheduler Backend (Q070):** Automated weekly report delivery via email with CRUD and manual trigger endpoints.
- **Schichtplan-Kommentare (Q069):** Day-level notes with 📝 indicator and inline popover editor.
- **Überstunden-Tracking (Q068):** Per-employee overtime balance and organization-wide summary endpoints.
- **Mitarbeiter-Vergleichsansicht (Q067):** Side-by-side employee comparison via URL params or Compare button.
- **Recurring Shifts Backend (Q066):** Weekly/biweekly repeat patterns with generate endpoint.
- **Dashboard Performance-Widget (Q065):** Live system metrics (API response time, DB status, memory, disk).
- **CSV Employee Import (Q064):** Bulk employee creation from CSV with validation and duplicate detection.
- **Print Layout Improvements (Q063):** Enhanced A4 landscape print stylesheet.
- **In-App Changelog (Q060):** Changelog page accessible from within the application.
- **Soft-Delete Employees (Q059):** Active/inactive filter with soft-delete support.
- **Keyboard Shortcuts (Q058):** Global keyboard shortcuts with help modal.
- **Structured Logging (Q057):** JSON logging with request IDs for backend.
- **Empty State Illustrations (Q056):** Friendly empty states for all major list pages.
- **Content-Security-Policy (Q054):** CSP headers + Subresource Integrity (SRI).
- **Extended Health Check (Q053):** Structured metrics for monitoring.
- **Bulk Import UX (Q052):** Drag-and-drop file upload with validation preview.
- **Excel Export (Q051):** XLSX export for all data endpoints.
- **Responsive Tables (Q050):** Horizontal scroll on mobile for all data tables.
- **Webhook System (Q049):** Backend webhook delivery for integration with external systems.
- **Dashboard Company Context (Q048):** Active company display in dashboard header.
- **Production Docker Compose (Q047):** Nginx reverse proxy + production-hardened Docker setup.
- **Playwright E2E in CI (Q046):** End-to-end tests running in GitHub Actions.
- **Multi-Tenant Companies (Q044):** Company CRUD API with tenant isolation.

### Improved
- 8 stabilization batches (S003–S012) with comprehensive bug fixes and test coverage
- API versioning under `/api/v1/` with deprecation headers on legacy routes
- Global search bar (`Ctrl+K`) across employees, groups, and shifts
- Enhanced conflict detection with HTTP 409 responses
- Improved auto-planner considering availability, weekly limits, and assigned hours
- Consistent loading animations and error states across all pages
- Rate limiting on all API endpoints
- Stricter input validation on all form fields

### Changed
- Full CI/CD pipeline with pytest, ruff, ESLint, TypeScript checks, and Playwright E2E
- Docker multi-arch builds (amd64 + arm64)
- Automated GitHub Container Registry publishing
- SQLite backup/restore with automatic pre-restore backups

---

## [1.0.0-rc7] - 2026-03-27

### Added
- **Abwesenheits-Statistiken UI (Q076):** New multi-tab absence statistics interface with overview, group, and employee tabs. CSS-based charts display absence distribution by type (vacation, sick leave, other) and monthly trends. Accessible from the Statistics section.
- **Schicht-Konflikt-Report (Q077):** Automated shift conflict detection covering overlap, double-booking, and understaffed periods. Results are displayed in a conflict report view with severity indicators. Supports CSV and XLSX export for further analysis.
- **Mitarbeiter-Timeline (Q078):** Horizontal CSS timeline view per employee showing shifts and absences on a unified time axis. Enables at-a-glance review of individual workload and absence patterns across a configurable date range.
- **Arbeitszeit-Regelwerk (Q079):** Working time rule engine with configurable limits: maximum hours per day, minimum rest between shifts, and maximum consecutive working days. A dedicated checker highlights violations in the schedule and employee views.
- **Notification-Settings (Q080):** Per-user email notification preferences. Users can independently toggle notifications for each event type (shift assigned, shift changed, swap requested/approved/rejected, vacation approved/rejected, schedule comment added) via the profile settings page.

---

## [1.0.0-rc6] - 2026-03-27

### Added
- **Überstunden-Dashboard (Q071):** Visual bar chart on the overtime dashboard showing per-employee overtime balances at a glance. Color-coded bars (green/yellow/red) indicate healthy, borderline, and critical overtime levels. Integrates with existing `/api/v1/overtime/summary` endpoint.
- **Schicht-Tausch Erweiterungen (Q072):** Shift swap requests now include in-app and email notifications for both parties on status changes. Full status history log (requested → accepted/rejected → approved/denied) displayed in the swap detail view. Auto-expiry: open swap requests automatically expire after a configurable number of days (default: 7).
- **Recurring Shifts UI (Q073):** Frontend interface for managing recurring shift templates. Users can create, view, and delete recurring shift rules (weekly/biweekly) directly from the schedule view. A recurring badge (🔁) marks auto-generated shift instances.
- **Abwesenheits-Statistiken (Q074):** New absence statistics views — per-employee breakdown, group comparison, and organization-wide overview. Charts show absence days by type (vacation, sick leave, other), month-by-month trends, and team absence calendars. Accessible via the Statistics section.
- **Export-Scheduler UI (Q075):** Full CRUD interface for managing scheduled report exports. Users can create, edit, and delete export jobs with configurable recipient lists, report types, and schedules. A manual trigger button allows immediate on-demand delivery. Integrates with the existing `/api/v1/export-scheduler` backend.

---

## [1.0.0-rc5] - 2026-03-27

### Added
- **Recurring Shifts (Q066):** New recurring shift system with weekly and biweekly repeat patterns. Endpoints: `POST /api/shifts/recurring` (create), `GET /api/shifts/recurring` (list), `DELETE /api/shifts/recurring/{id}` (remove), `POST /api/shifts/recurring/{id}/generate` (materialize occurrences for a date range). Supports custom intervals, weekday selection, and end dates.
- **Mitarbeiter-Vergleichsansicht (Q067):** Side-by-side employee comparison view accessible via URL parameters (`?compare=id1,id2`) or the new "Compare" button on employee pages. Displays scheduled hours, leave days, overtime, and shift distribution for each selected employee simultaneously.
- **Überstunden-Tracking (Q068):** Dedicated overtime tracking endpoints: `GET /api/v1/employees/{id}/overtime` (per-employee overtime balance with period breakdown) and `GET /api/v1/overtime/summary` (organization-wide summary with top earners and department totals). Overtime is calculated from contract hours vs. actual scheduled hours.
- **Schichtplan-Kommentare (Q069):** Day-level notes for the schedule view. Planners can attach text comments to any day. A 📝 indicator appears on days with notes; clicking opens a popover with the full comment and edit/delete controls. Notes are stored per planning context (location + date).
- **Export-Scheduler (Q070):** Automated weekly report delivery via email. Supports full CRUD for scheduled export jobs (`POST/GET/PUT/DELETE /api/v1/export-scheduler`), configurable recipient lists, report type selection, and a manual trigger endpoint (`POST /api/v1/export-scheduler/{id}/trigger`) for immediate on-demand delivery.

---

## [1.0.0-rc4] - 2026-03-27

### Added
- **Global Search:** New header search bar that searches employees, groups, and shifts simultaneously. Results appear in a categorized dropdown with keyboard navigation support. Accessible via `Ctrl+K` / `Cmd+K`.
- **API Versioning:** All endpoints now available under the `/api/v1/` prefix. Legacy `/api/` routes continue to work but return `Deprecation: true` and `X-API-Version: v1` response headers. Clients should migrate to `/api/v1/`.
- **Improved Print Layout:** Redesigned A4 landscape print stylesheet for the schedule view — cleaner table borders, page headers with company name and date range, repeated table headers across pages, signature line at the bottom. Print via browser `Ctrl+P`.
- **CSV Employee Import:** New endpoint `POST /api/v1/employees/import-csv` for bulk employee creation from a CSV file. Includes field validation, duplicate detection (by employee number), configurable error threshold (default 20%), and a detailed import result report (created / skipped / errors).
- **Performance Dashboard Widget:** New widget on the main dashboard showing live system metrics: API response time, database status, service uptime, memory usage, and disk usage. Data sourced from the extended `/api/health` endpoint.

### Improved
- **Print CSS:** Hides navigation sidebar, header bar, and action buttons during print. Enforces `A4 landscape` page size and avoids page breaks inside table rows.
- **Health Endpoint:** `/api/health` now exposes structured metrics for memory, disk, and uptime — consumed by the new Performance Widget.

---

## [1.0.0-rc3] - 2026-03-10

### Added
- **Two-Factor Authentication (TOTP):** Users can enable 2FA via an authenticator app (QR code setup, backup codes). Admins can reset 2FA for locked accounts.
- **Calendar View:** Schedule now also available as a monthly calendar with colored shift chips per day. Toggle between weekly and calendar view.
- **Undo/Redo in Schedule:** Undo shift assignments (Ctrl+Z) and redo (Ctrl+Y), up to 30 steps.
- **Schedule Templates:** Save weeks as templates and apply to any target week. Templates are stored server-side and visible to all planners.
- **Employee Availability:** Per-employee configurable availability (weekdays + time slots). The auto-planner considers these when generating suggestions.
- **Employee Profile Extended:** New tab for qualifications, availability and contract hours — all editable directly in the profile.
- **Personal Shift Calendar:** Employees (Reader role) get a personal monthly calendar showing their own shifts and can submit shift preferences per day.
- **Printable Schedule Layout:** Optimized print layout (A4 landscape) with hidden navigation, page repeats and signature line.
- **Database Export:** Admins can download the SQLite database backup (optionally compressed). An automatic backup is created before every restore.
- **SQLAlchemy ORM Layer:** Abstraction layer for future PostgreSQL migration — currently used alongside DBF as proof of concept.

### Improved
- **Conflict Detection:** When assigning shifts, duplicate assignments, time overlaps and absences are now checked (HTTP 409 with details).
- **Auto-Planner:** Now considers employee availability, weekly work hour limits and already assigned hours.
- **Loading Animations:** Consistent loading indicators across all pages.
- **Session Expiry:** Automatic logout before JWT expiry with notification toast.
- **Rate Limiting:** API endpoints secured against brute force (login: 5/min, general: 100/min).
- **Input Validation:** Stricter backend validation of all form fields (lengths, formats, required fields).
- **Password Security:** Passwords are hashed with bcrypt. Migration of existing accounts happens automatically on next login.

### Fixed
- Smoke tests updated to use correct auth header (`x-auth-token`) and `/api/version` endpoint.
- Overnight shift overlap detection corrected (modular arithmetic fix).
- Availability partial update no longer loses existing time windows for unchanged days.

---

## [1.0.0-rc2] - 2026-03-06

### Added
- **iCal Export:** Download employee shift schedules as `.ics` files.
- **Subscribable iCal Feed:** Token-based `webcal://` feed for calendar app subscription (Google Calendar, Outlook, Apple Calendar).
- **Email Notifications:** SMTP email notification system with configurable templates and admin settings page.
- **Audit Log:** Full activity log with user tracking, old/new value diffs, and entity-type filtering.

### Improved
- **OpenAPI Documentation:** Complete descriptions and examples for all 162+ API endpoints.
- **Test Coverage:** 1327+ backend tests, 165+ frontend component tests.
- **Structured Logging:** JSON-structured backend logs with request IDs and user context.
- **Security:** Removed hashed passwords from API responses; hardened CORS configuration.

### Fixed
- Test isolation: auth tokens no longer shared across test sessions (203 previously failing tests fixed).
- Mobile column layout and SQLite adapter improvements.

---

## [1.0.0-rc1] - 2026-03-06

First release candidate — marking feature completeness for the core use case.

### Added
- **Swap Exchange (Tauschbörse):** Employees can request shift swaps; partner acceptance workflow with planner notification.
- **Leave Approval Workflow:** Absence requests → planner review → approval/rejection with email notification.
- **Notifications Center:** Bell icon in header with dropdown; full notifications page with filters and mark-all-read.
- **Dark Mode:** Persistent dark/light theme toggle with system preference detection.
- **Keyboard Navigation & Accessibility:** Full keyboard navigation, ARIA labels, focus management.
- **Bulk Operations:** Assign shifts to entire groups for a date range.
- **CSV/Excel Export:** Download employee lists and absence reports as CSV or XLSX.
- **Real-time Updates (SSE):** Live schedule and notification updates via Server-Sent Events.
- **Password Reset Flow:** Self-service password reset for employees.
- **Drag & Drop:** Shift assignment by dragging in the schedule view (permission-gated).
- **Pagination:** Opt-in pagination for employee, absence and changelog endpoints.
- **Offline Indicator:** Graceful degradation and reconnect handling on network loss.

### Improved
- **Statistics Dashboard:** Year-over-year comparisons, monthly breakdowns, group CSV export.
- **Performance:** Lazy loading, code splitting, TTL-based API caching.
- **Security:** CSRF protection, security headers (CSP, HSTS, X-Frame-Options), rate limiting (100 req/min).
- **Mobile UX:** Hamburger menu, touch-friendly targets, responsive tables and bottom navigation.
- **Error Boundaries:** Global React error boundary to prevent full-page crashes.
- **404 Page:** Custom not-found page for unknown routes.
- **Docker:** healthcheck, `.dockerignore`, multi-arch image (amd64 + arm64).

---

## [0.5.0] - 2026-03-01

Major feature expansion — all core Schichtplaner5 features implemented.

### Added
- **Analytics Dashboard:** KPI charts, employee statistics, shift distribution visualization.
- **Capacity Planning:** Staffing requirements and gap analysis.
- **Skill Matrix:** Employee qualification tracking and assignment.
- **Schedule Optimizer:** Automated shift scheduling based on requirements.
- **Conflict Resolution UI:** Visual conflict detection and resolution workflow.
- **Employee Self-Service:** Absence requests, shift preferences, profile management.
- **Configuration Management:** Central settings page with categorized groups (Planning, Notifications, Display).
- **Data Import:** 7 import types (employees, shifts, groups, holidays, leave types, workplaces, special staffing).
- **PWA Support:** Installable as progressive web app with offline caching.
- **Print Export:** Optimized print stylesheets for all major views.
- **Advanced Reporting:** 20+ report types including shift statistics, rotation analysis, year summary.
- **Team Overview:** Group-based planning views with capacity indicators.

### Improved
- **Search & Filter:** Autocomplete search and multi-field filtering across all list views.
- **Data Visualization:** Recharts integration for all statistics pages.
- **Onboarding Tour:** Interactive first-time setup guide.

---

## [0.3.0] - 2026-02-28

Foundation release — core scheduling and employee management.

### Added
- **Schedule View:** Week-based shift schedule with group filtering and date navigation.
- **Employee Management:** Full CRUD for employees, groups, and group assignments.
- **Shift Types:** Create and manage shift templates with color coding.
- **Absence Management:** Vacation and absence tracking with leave type configuration.
- **Master Data:** Workplaces, holidays, pay supplements, staffing requirements.
- **User Management:** Role-based access control (Admin, Planner, Reader) enforced at API and UI level.
- **DBF Compatibility:** Direct read/write of FoxPro `.DBF` files — no migration needed, compatible with original Schichtplaner5.
- **Docker Deployment:** Multi-stage Dockerfile with production compose configuration.
- **CI Pipeline:** GitHub Actions with ruff lint, ESLint, pytest, and Docker build.

---

## [0.2.0] - 2026-02-28

Initial working prototype with basic schedule display and authentication.
