# AUDIT — API & sp5lib (Phase 4)

Stand: 2026-05-26. Systematische Prüfung der 25 Router unter `backend/api/routers/`
und der Kernbibliothek `backend/sp5lib/`. Schwerpunkte: Auth/RBAC, Pydantic-Validierung,
Fehlerbehandlung, Status-Codes, Schema-Konsistenz, Rate-Limiting, DBF-Korrektheit,
ORM/Repository/Sync. Status je Befund: ✅ behoben in diesem Lauf · 📝 dokumentiert/deferred.

## Zusammenfassung

| Bereich | Ergebnis |
|---|---|
| Authentifizierung | Globale `auth_middleware` schützt alle `/api/*` außer expliziter Public-Allowlist. Reihenfolge ggü. Versioning-Middleware korrekt. |
| RBAC | 2 echte Lücken gefunden (availability writes, restriction DELETE) — ✅ behoben (#57). |
| Rate-Limiting | slowapi auf sensiblen Auth/Admin/Export/Email-Endpunkten + globaler Default `100/minute`. |
| SQL-Injection | Keine gefunden — durchweg parametrisiert (SQLAlchemy + `?`-Bindings). `pg_dump` via argv-Liste, kein `shell=True`. |
| Pfad-Sicherheit | Backup-/Foto-Endpunkte gegen `..`/Zip-Slip/Content-Type/Größe abgesichert (verifiziert). |
| DBF-Bridge | Writer mit `flock`/TOCTOU-sicher/Rollback. 2 Datenintegritäts-Härtungen ✅ (#58). |
| ORM SQLite/PG | `to_dict()`-Feldsätze divergieren — 📝 (siehe unten). |

## Teil A — Router-Audit (Auth/RBAC pro mutierendem Endpunkt)

Geprüft wurde insbesondere, ob datenverändernde Endpunkte (`POST`/`PUT`/`PATCH`/`DELETE`)
eine Rollenprüfung tragen. Ergebnis (Auszug der relevanten Router):

| Router | Write-Endpunkte geschützt? | Anmerkung |
|---|---|---|
| `auth.py` | n/a (Login/2FA public + rate-limited) | Brute-Force-Lockout username-keyed (📝 DoS-Tradeoff) |
| `employees.py` | ✅ `require_admin` (create/update/delete), Foto path-safe | — |
| `schedule.py` | ✅ bis auf restriction DELETE → ✅ **behoben (#57)** | POST verlangte admin, DELETE war offen |
| `availability.py` | ❌ POST/PUT offen → ✅ **behoben (#57)** (`require_planer`) | GET bleibt nur-auth (read) |
| `absences.py` | ✅ `require_planer` | — |
| `admin.py` | ✅ `require_admin`, Backup-Restore path-safe | — |
| `notifications.py`, `notification_settings.py` | ✅ auth/self | — |
| `overtime.py`, `qualification_matrix.py`, `recurring_shifts.py` | ✅ Rollen-Deps | — |
| `reports.py`, `scheduled_reports.py`, `export_scheduler.py` | ✅ + rate-limited | — |
| `webhooks.py`, `email.py` | ✅ `require_admin` + rate-limited | — |
| `companies.py`, `master_data.py`, `work_time_rules.py`, `events.py`, `ical.py`, `conflict_report.py`, `schedule_comments.py`, `schedule_pdf.py`, `misc.py` | ✅ (Reads/Streams bzw. Rollen-Deps) | `misc.py` Feldnamen-Bug ✅ behoben (#57) |

### Befunde Router
1. **RBAC availability writes** — `availability.py:159,188` — ✅ behoben (#57): `require_planer`.
2. **RBAC restriction DELETE** — `schedule.py:984` — ✅ behoben (#57): `require_admin` (symmetrisch zu POST).
3. **Falsche Dict-Keys (`Vorname`/`Nachname`)** — `misc.py:795,1103,1158` — ✅ behoben (#57).
4. **Schema-Feldnamen** — `schemas.py` `GroupResponse`/`EmployeeResponse` deklarieren
   `HIDDEN`/`EMPLOYEENO`/`GROUPID`/`CONTRACTHOURS`, real sind es `HIDE`/`NUMBER`/`ID`.
   `extra="allow"` rettet die Laufzeit, aber OpenAPI ist irreführend. 📝 Phase-4-Fix folgt.
5. **Brute-Force-Lockout username-keyed** — `dependencies.py:134` — gezielter Account-
   Lockout-DoS möglich. 📝 Tradeoff dokumentiert; optional zusätzlich IP-keyen.
6. **JWT-Secret pro Prozess generiert** ohne `SP5_JWT_SECRET` — `dependencies.py:119`.
   Multi-Worker bricht. 📝 Empfehlung: Fail-fast im Nicht-Dev-Modus.
7. **Cache nicht tenant-scoped** — `cache.py` keys ohne Company-Teil. 📝 latent (Single-DB).

## Teil B — sp5lib-Audit

### dbf_reader.py / dbf_writer.py
- ✅ **Numerischer Overflow** beim Schreiben (`_encode_field`) korrumpierte still → wirft jetzt (#58).
- ✅ **Datumsvalidierung** (`_parse_date`) akzeptierte unmögliche Daten → validiert via `date()` (#58).
- 📝 **UTF-16-Heuristik** (`_is_utf16_le`) kann atypische/kurze Felder fehlklassifizieren —
  niedrige Wahrscheinlichkeit bei festem SP5-Schema; kein Fix nötig, beobachten.
- ✅ Writer-Robustheit (flock, TOCTOU-Reread, EOF-Marker, Rollback) verifiziert — solide.

### orm/ (models.py, models_pg.py, repository.py, sync.py)
- 📝 **`to_dict()`-Divergenz SQLite vs. Postgres** (`models.py` vs. `models_pg.py`):
  Das SQLite-`Employee.to_dict()` liefert einen reduzierten Feldsatz (ohne BIRTHDAY,
  Adresse, NOTE1-4, Farben, CALCBASE …), die der DBF-Pfad und die API exponieren.
  `sync.py` synct Farben/Calc-Felder nicht. → Ein PG-Backend liefert reduzierte
  Employee-Objekte. **Empfehlung:** `to_dict()`/Modelle/Sync an den DBF-Feldsatz
  angleichen oder das PG-Backend explizit als „reduced-field" dokumentieren.
  (Risiko: Modell-/Migrations-Änderung → bewusst als separater, getesteter Schritt.)
- 📝 `Settings`-PG-Modell nutzt fixen PK-Default statt Singleton-Enforcement
  (`models_pg.py:300`). Seed-Upsert prüfen.

### email_service.py
- ✅ **HTML-Injection** (`_render_html`) → `html.escape` + Link-Schema-Validierung (#57).

### database.py / Auth-Interna
- 📝 Nicht-konstantzeitige Vergleiche (Legacy-MD5 `==`, Backup-Code-`in`-Liste) —
  geringes Risiko; `hmac.compare_digest` empfohlen.
- 📝 In-Memory-Stores (`_sessions`, `_failed_logins`, Cache) nicht prozessübergreifend —
  Single-Worker-Deployment oder Shared-Store nötig (Deployment-Doku).

### auto_migrate.py
- ✅ `pg_dump` sicher via argv + `PGPASSWORD` env (kein `shell=True`, kein Passwort in argv).

## Teil C — Supply-Chain (während des Audits gefunden)
- ✅ **fastapi 0.136.3 = malicious (MAL-2026-4750)** — `requirements.txt` zog die
  kompromittierte Version; jetzt `!=0.136.3` (#59). War Ursache des roten CI-Security-Audit.

## Offene Phase-4-Punkte (in Arbeit)
- [ ] Befund 4: `schemas.py` Feldnamen an reale DBF-Keys angleichen (eigener PR).
- [ ] Befund (ORM): `to_dict()`-Divergenz angleichen oder dokumentieren (eigener PR).
- [ ] Optionale Härtungen (JWT fail-fast, constant-time compares) als Folge-Issues.
