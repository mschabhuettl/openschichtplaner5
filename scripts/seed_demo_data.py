#!/usr/bin/env python3
"""
seed_demo_data.py — Demo-Daten in die SP5-Datenbank laden.

Erstellt:
  - 5 Demo-Mitarbeiter
  - 3 Demo-Gruppen (A, B, C) mit je ~2 Mitarbeitern
  - 2 Demo-Schichten (Früh, Spät)
  - Schichtplan-Einträge für den aktuellen Monat

Verwendung:
  cd backend
  python ../scripts/seed_demo_data.py [--db /pfad/zur/datenbank]

Achtung: Nur für Entwicklung/Demo! Nicht in Produktion verwenden.
"""

import argparse
import os
import sys
import calendar
from datetime import date, timedelta
from pathlib import Path
from dotenv import load_dotenv

# Backend-Verzeichnis zum Python-Pfad hinzufügen
SCRIPT_DIR = Path(__file__).parent
BACKEND_DIR = SCRIPT_DIR.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

load_dotenv(BACKEND_DIR / ".env")


def get_db_path(cli_path: str | None) -> str:
    if cli_path:
        return cli_path
    env_path = os.environ.get("SP5_DB_PATH")
    if env_path:
        return env_path
    # Fallback: lokaler Entwicklungs-Pfad
    default = BACKEND_DIR.parent / "sp5_db" / "Daten"
    return str(default)


def seed(db_path: str, dry_run: bool = False) -> None:
    from sp5lib.database import SP5Database

    print(f"📂 Datenbank: {db_path}")
    if dry_run:
        print("🔍 DRY-RUN — keine Änderungen werden geschrieben")

    db = SP5Database(db_path)

    # ── Mitarbeiter ──────────────────────────────────────────────
    demo_employees = [
        {"NAME": "Mustermann",  "FIRSTNAME": "Max",      "SHORTNAME": "MAXM",  "SEX": 0, "HRSDAY": 8.0, "HRSWEEK": 40.0},
        {"NAME": "Musterfrau",  "FIRSTNAME": "Maria",    "SHORTNAME": "MARMA", "SEX": 1, "HRSDAY": 8.0, "HRSWEEK": 40.0},
        {"NAME": "Schmidt",     "FIRSTNAME": "Klaus",    "SHORTNAME": "KLSCH", "SEX": 0, "HRSDAY": 8.0, "HRSWEEK": 40.0},
        {"NAME": "Bauer",       "FIRSTNAME": "Anna",     "SHORTNAME": "ANBA",  "SEX": 1, "HRSDAY": 6.0, "HRSWEEK": 30.0},
        {"NAME": "Zimmermann",  "FIRSTNAME": "Thomas",   "SHORTNAME": "THOZI", "SEX": 0, "HRSDAY": 8.0, "HRSWEEK": 40.0},
    ]

    created_employees = []
    print("\n👤 Erstelle Mitarbeiter...")
    existing = {e.get("SHORTNAME", "").strip().upper() for e in db.get_employees(include_hidden=True)}
    for emp_data in demo_employees:
        sn = emp_data["SHORTNAME"].upper()
        if sn in existing:
            print(f"   ⚠ {emp_data['FIRSTNAME']} {emp_data['NAME']} (SHORTNAME={sn}) bereits vorhanden — übersprungen")
            # Finde die bestehende ID
            for e in db.get_employees(include_hidden=True):
                if (e.get("SHORTNAME") or "").strip().upper() == sn:
                    created_employees.append(e)
                    break
            continue
        if not dry_run:
            emp = db.create_employee(emp_data)
            created_employees.append(emp)
            print(f"   ✓ {emp_data['FIRSTNAME']} {emp_data['NAME']} (ID={emp.get('ID', emp.get('id'))})")
        else:
            print(f"   [dry] würde erstellen: {emp_data['FIRSTNAME']} {emp_data['NAME']}")

    # ── Gruppen ──────────────────────────────────────────────────
    demo_groups = [
        {"NAME": "Demo-Gruppe A", "SHORTNAME": "DEMA"},
        {"NAME": "Demo-Gruppe B", "SHORTNAME": "DEMB"},
        {"NAME": "Demo-Gruppe C", "SHORTNAME": "DEMC"},
    ]

    created_groups = []
    print("\n👥 Erstelle Gruppen...")
    existing_groups = {g.get("SHORTNAME", "").strip().upper() for g in db.get_groups(include_hidden=True)}
    for grp_data in demo_groups:
        sn = grp_data["SHORTNAME"].upper()
        if sn in existing_groups:
            print(f"   ⚠ {grp_data['NAME']} (SHORTNAME={sn}) bereits vorhanden — übersprungen")
            for g in db.get_groups(include_hidden=True):
                if (g.get("SHORTNAME") or "").strip().upper() == sn:
                    created_groups.append(g)
                    break
            continue
        if not dry_run:
            grp = db.create_group(grp_data)
            created_groups.append(grp)
            print(f"   ✓ {grp_data['NAME']} (ID={grp.get('ID', grp.get('id'))})")
        else:
            print(f"   [dry] würde erstellen: {grp_data['NAME']}")

    # ── Gruppen-Mitglieder zuweisen ──────────────────────────────
    if not dry_run and created_employees and created_groups:
        print("\n🔗 Weise Mitarbeiter Gruppen zu...")
        # Gruppe A: Mitarbeiter 0+1, Gruppe B: 1+2, Gruppe C: 3+4
        assignments = [
            (0, [0, 1]),
            (1, [1, 2]),
            (2, [3, 4]),
        ]
        for grp_idx, emp_indices in assignments:
            if grp_idx >= len(created_groups):
                continue
            g = created_groups[grp_idx]
            gid = g.get("ID") or g.get("id")
            for ei in emp_indices:
                if ei >= len(created_employees):
                    continue
                e = created_employees[ei]
                eid = e.get("ID") or e.get("id")
                try:
                    db.add_group_member(gid, eid)
                    print(f"   ✓ Mitarbeiter {eid} → Gruppe {gid}")
                except Exception as ex:
                    print(f"   ⚠ Mitarbeiter {eid} → Gruppe {gid}: {ex}")

    # ── Schichten ────────────────────────────────────────────────
    demo_shifts = [
        {"NAME": "Frühschicht", "SHORTNAME": "F",  "STARTTIME": "06:00", "ENDTIME": "14:00"},
        {"NAME": "Spätschicht",  "SHORTNAME": "S",  "STARTTIME": "14:00", "ENDTIME": "22:00"},
    ]

    created_shifts = []
    print("\n🕐 Erstelle Schichten...")
    try:
        existing_shifts = {s.get("SHORTNAME", "").strip().upper() for s in db.get_shifts()}
    except Exception:
        existing_shifts = set()

    for shift_data in demo_shifts:
        sn = shift_data["SHORTNAME"].upper()
        if sn in existing_shifts:
            print(f"   ⚠ {shift_data['NAME']} (SHORTNAME={sn}) bereits vorhanden — übersprungen")
            try:
                for s in db.get_shifts():
                    if (s.get("SHORTNAME") or "").strip().upper() == sn:
                        created_shifts.append(s)
                        break
            except Exception:
                pass
            continue
        if not dry_run:
            try:
                shift = db.create_shift(shift_data)
                created_shifts.append(shift)
                print(f"   ✓ {shift_data['NAME']} (ID={shift.get('ID', shift.get('id'))})")
            except Exception as ex:
                print(f"   ⚠ Konnte Schicht {shift_data['NAME']} nicht erstellen: {ex}")
        else:
            print(f"   [dry] würde erstellen: {shift_data['NAME']}")

    # ── Schichtplan für aktuellen Monat ──────────────────────────
    if not dry_run and created_employees and created_shifts:
        today = date.today()
        year, month = today.year, today.month
        _, days_in_month = calendar.monthrange(year, month)
        print(f"\n📅 Erstelle Schichtplan für {year}-{month:02d} ({days_in_month} Tage)...")

        added = 0
        for emp_idx, emp in enumerate(created_employees[:4]):  # max 4 Mitarbeiter
            eid = emp.get("ID") or emp.get("id")
            if not eid:
                continue
            # Abwechselnd Früh- und Spätschicht, Wochenende frei
            for day in range(1, days_in_month + 1):
                d = date(year, month, day)
                if d.weekday() >= 5:  # Samstag=5, Sonntag=6
                    continue
                shift_idx = (emp_idx + day) % len(created_shifts)
                shift = created_shifts[shift_idx]
                sid = shift.get("ID") or shift.get("id")
                if not sid:
                    continue
                date_str = d.strftime("%Y-%m-%d")
                try:
                    db.add_schedule_entry(
                        employee_id=eid,
                        date_str=date_str,
                        entry_type="shift",
                        shift_id=sid,
                    )
                    added += 1
                except Exception:
                    pass  # Bereits vorhanden → ignorieren

        print(f"   ✓ {added} Schichtplan-Einträge erstellt")

    print("\n✅ Demo-Daten geladen!")
    if dry_run:
        print("   (DRY-RUN: keine Änderungen wurden tatsächlich geschrieben)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Demo-Daten in SP5-Datenbank laden")
    parser.add_argument("--db", help="Pfad zur SP5-Datenbank (Daten-Verzeichnis)")
    parser.add_argument("--dry-run", action="store_true", help="Nur simulieren, nichts schreiben")
    args = parser.parse_args()

    db_path = get_db_path(args.db)

    if not os.path.isdir(db_path):
        print(f"❌ Datenbankverzeichnis nicht gefunden: {db_path}")
        print("   Setze SP5_DB_PATH oder übergib --db /pfad/zur/datenbank")
        sys.exit(1)

    seed(db_path, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
