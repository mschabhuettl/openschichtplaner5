# SQLite Migration Plan

**Status:** Planning / PoC  
**Created:** 2026-03-06  
**Author:** Hilbert (AI Assistant)

---

## 1. Warum migrieren? — Aktuelle Probleme

### 1.1 Race Conditions im Cache-Layer

`database.py` hält einen globalen In-Memory-Cache `_GLOBAL_DBF_CACHE` als einfaches Python-Dict:

```python
_GLOBAL_DBF_CACHE: Dict[tuple, tuple] = {}
```

Dieses Dict ist **nicht thread-safe**. Bei concurrent Requests (FastAPI läuft mit mehreren Worker-Threads/Processes) kann es zu:
- **Lost-update** beim Cache-Write (`_GLOBAL_DBF_CACHE[key] = ...`)
- **Stale reads** wenn Thread A schreibt während Thread B liest
- **Torn reads** in CPython (obwohl GIL schützt, ist `dict.__setitem__` nicht atomar über alle Operationen)

### 1.2 fcntl.flock() schützt nur auf Datei-Ebene

`dbf_writer.py` setzt korrekt `fcntl.flock(LOCK_EX)` für jede Write-Operation. Das schützt gegen gleichzeitige Datei-Schreiber. **Es schützt nicht gegen:**
- Multi-Process-Szenarien (mehrere Gunicorn-Worker)
- Den Zeitraum zwischen "Datei lesen" und "Cache-Eintrag anlegen" (TOCTOU)
- Concurrent reads die alle dasselbe DBF gleichzeitig neu laden

### 1.3 Weitere strukturelle Probleme

| Problem | Details |
|---------|---------|
| **Kein ACID** | DBF-Writes sind keine Transaktionen — bei Absturz mid-write: korrupte Datei |
| **Kein Index** | Jede Suche ist ein Full Table Scan durch alle 60 DBF-Dateien |
| **Kein JOIN** | Verknüpfungen (z.B. Employee↔Group) müssen in Python gebaut werden |
| **Encoding-Komplexität** | UTF-16-LE mit Custom-Encoding-Logik in dbf_reader/writer |
| **Keine Migrations-History** | Schema-Änderungen nicht nachvollziehbar |
| **Keine Query-Sprache** | Alle Filter-Logik = Python-Code |
| **60 Dateien** | Jede Tabelle hat `.DBF` + `-L.DBF` Lock-File = 30 Tabellen × 2 |

### 1.4 Vorteile nach SQLite-Migration

- ✅ **ACID-Transaktionen** — kein partieller Write-Absturz möglich
- ✅ **WAL-Mode** — concurrent reads + 1 writer ohne Blocking
- ✅ **Thread-safe** via SQLite's built-in connection serialization
- ✅ **Volltextsuche** via FTS5 Extension möglich
- ✅ **Einzelne Datei** statt 60 — einfacheres Backup
- ✅ **SQL** — komplexe Queries ohne Python-Loops
- ✅ **Standard** — Python's `sqlite3` ist Teil der Stdlib (kein Dependency)

---

## 2. Migrationsplan — 3 Phasen

### Phase 1: Read-Mirror (4-6 Wochen)

**Ziel:** SQLite als Lese-Cache neben DBF; DBF bleibt Quelle der Wahrheit.

**Schritte:**
1. `sqlite_adapter.py` (bereits erstellt als PoC) ausbauen
2. Sync-Job: bei App-Start und bei jedem DBF-Write → SQLite aktualisieren
3. Neue API-Endpoints für lesende Operationen auf SQLite umstellen (opt-in per Config-Flag)
4. Monitoring: Response-Zeit DBF vs SQLite messen
5. Integrationstests die beide Pfade vergleichen

**Breaking Changes:** Keine — DBF-Pfad bleibt aktiv, SQLite ist additionell.

**Deliverable:** `SP5SQLiteAdapter` mit vollständiger Sync-Logik für alle 30 Tabellen.

---

### Phase 2: Dual-Write (4-6 Wochen)

**Ziel:** Schreibende Operationen gehen an DBF UND SQLite gleichzeitig.

**Schritte:**
1. `dbf_writer.py` um SQLite-Mirroring erweitern (Wrapper-Pattern)
2. Transaktions-Semantik: Zuerst DBF schreiben (Kompatibilität), dann SQLite; bei SQLite-Fehler loggen (non-fatal)
3. Consistency-Checker als Background-Task: DBF ↔ SQLite vergleichen, Divergenzen loggen
4. Feature-Flag: `SP5_STORAGE_MODE=dual` (default: `dbf-only`)

**Breaking Changes:** Keine — DBF ist weiterhin autoritativ.

**Deliverable:** `DualWriteAdapter` der beide Backends synchron hält.

---

### Phase 3: SQLite Primary (6-8 Wochen)

**Ziel:** SQLite ist die primäre Datenbank; DBF wird nur noch für Legacy-Export benötigt.

**Schritte:**
1. Alle API-Endpoints auf SQLite-Reads umstellen
2. Export-Funktion: SQLite → DBF für Kompatibilität mit Original-Schichtplaner5-App
3. DBF-Writes als optionaler "Export-Mode" (`SP5_STORAGE_MODE=sqlite`)
4. Vollständige Schema-Migration: alle 30 Tabellen in SQLite
5. Performance-Tests unter Last (10+ concurrent requests)
6. Backup-Strategie: SQLite `.backup()` API statt File-Copy

**Breaking Changes:**
- `dbf_writer.py` wird deprecated (bleibt für Export)
- `_GLOBAL_DBF_CACHE` wird entfernt
- API bleibt kompatibel (gleiche JSON-Responses)

**Deliverable:** SP5 läuft vollständig auf SQLite, DBF-Kompatibilität via Export.

---

## 3. Risiken & Rollback-Strategie

### 3.1 Risikomatrix

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|--------------------|--------|------------|
| SQLite-Korruption (Absturz) | Gering (WAL schützt) | Hoch | Tägliche Backups + `PRAGMA integrity_check` |
| Daten-Divergenz DBF↔SQLite | Mittel (Phase 2) | Mittel | Consistency-Checker + Alerts |
| Performance-Regression | Gering | Mittel | Benchmarks vor Phase 3 |
| Encoding-Fehler bei Sync | Mittel (UTF-16-LE) | Mittel | Unit-Tests mit allen Sonderzeichen |
| Breaking-Change für SP5-Clients | Gering (API-stabil) | Hoch | API-Compatibility-Tests |
| Verlust von DBF-Feldern ohne SQLite-Äquivalent | Möglich | Hoch | Vollständige Feld-Inventur in Phase 1 |

### 3.2 Rollback-Strategie

**Phase 1 Rollback:** Trivial — `sqlite_adapter.py` löschen, Feature-Flag deaktivieren. DBF nie berührt.

**Phase 2 Rollback:**
1. `SP5_STORAGE_MODE=dbf-only` setzen
2. App neu starten
3. SQLite-Datei kann ignoriert werden (nächste Sync überschreibt sie)

**Phase 3 Rollback:**
1. Vor Phase-3-Start: vollständiges DBF-Backup (tar.gz der Daten-Ordner)
2. `SP5_STORAGE_MODE=dual` setzen → DBF-Writes reaktivieren
3. Bei kritischem Fehler: Backup einspielen + `SP5_STORAGE_MODE=dbf-only`

**Emergency Rollback jederzeit:**
```bash
# 1. Letztes DBF-Backup wiederherstellen
cp -r /backup/sp5_db/Daten/* /opt/sp5_db/Daten/

# 2. SQLite löschen (wird beim nächsten Start neu gebaut)
rm /opt/sp5.sqlite

# 3. Config: Nur DBF
export SP5_STORAGE_MODE=dbf-only

# 4. App neu starten
systemctl restart sp5api
```

---

## 4. PoC — Vorhandener Code

`backend/sp5lib/sqlite_adapter.py` implementiert:
- `SP5SQLiteAdapter.init_db()` — Schema für EMPL, GROUP, BOOK erstellen
- `SP5SQLiteAdapter.sync_from_dbf(daten_path)` — Daten aus DBF in SQLite übertragen
- Einfache Query-Helper als Demo

**Test:**
```python
from sp5lib.sqlite_adapter import SP5SQLiteAdapter

adapter = SP5SQLiteAdapter("/tmp/sp5_test.sqlite")
adapter.init_db()
counts = adapter.sync_from_dbf("/path/to/sp5_db/Daten")
print(counts)  # {"employees": 39, "groups": 10, "bookings": 1}

employees = adapter.get_employees()
print(employees[0]["name"])
```

---

## 5. Nächste Schritte

- [ ] Phase-1-Ticket erstellen: alle 30 Tabellen in Schema aufnehmen
- [ ] Feld-Inventur: DBF-Felder vs SQLite-Schema vergleichen (insbes. Memo-Felder)
- [ ] Performance-Baseline messen: aktuelle DBF-Response-Zeiten
- [ ] `sqlite_adapter.py` auf alle Tabellen erweitern
- [ ] CI-Test: `sync_from_dbf` gegen Test-DBF laufen lassen
