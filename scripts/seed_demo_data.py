#!/usr/bin/env python3
"""
seed_demo_data.py — eindeutig synthetische Demo-Daten in eine SP5-Datenbank laden.

Macht aus einer schema-validen SP5-Datenbasis (z. B. einer Kopie von
``backend/fixtures``) eine erkennbar fiktive Demo-Datenbank:

  - benennt alle Mitarbeiter auf eindeutig fiktive deutsche Demo-Namen um
    (Max Mustermann, Anna Beispiel, Doris Demo, …) inkl. fiktiver
    Kontaktdaten, Geburtstage und Funktionen
  - benennt Benutzerkonten passend um
  - legt Feiertage, Urlaubsansprüche (inkl. Resturlaub für den
    Verfall-Dialog) und Personalbedarf (Coverage-Ampel) an
  - erzeugt Abwesenheiten, Schichtwünsche, Tauschanfragen und Notizen
    rund um den aktuellen Monat

Empfohlene Reihenfolge (Abwesenheiten räumen kollidierende Schichten weg):

  cp -r backend/fixtures /tmp/sp5-demo-daten
  python scripts/generate_demo_schedule.py /tmp/sp5-demo-daten --months 2
  python scripts/seed_demo_data.py --db /tmp/sp5-demo-daten

Achtung: Nur für Entwicklung/Demo! Nicht in Produktion verwenden.
"""

import argparse
import os
import random
import sys
from datetime import date, timedelta
from pathlib import Path

from dotenv import load_dotenv

# Backend-Verzeichnis zum Python-Pfad hinzufügen
SCRIPT_DIR = Path(__file__).parent
BACKEND_DIR = SCRIPT_DIR.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

load_dotenv(BACKEND_DIR / ".env")

# Eindeutig fiktive deutsche Demo-Namen (Platzhalter-Nachnamen).
# Reihenfolge = Mitarbeiter sortiert nach ID; (Vorname, Nachname, SEX 0=m/1=w).
DEMO_NAMES = [
    ("Max", "Mustermann", 0),
    ("Erika", "Musterfrau", 1),
    ("Moritz", "Muster", 0),
    ("Monika", "Muster", 1),
    ("Anna", "Beispiel", 1),
    ("Bernd", "Beispiel", 0),
    ("Doris", "Demo", 1),
    ("Daniel", "Demo", 0),
    ("Petra", "Probe", 1),
    ("Peter", "Probe", 0),
    ("Tina", "Test", 1),
    ("Theo", "Test", 0),
    ("Vera", "Vorlage", 1),
    ("Viktor", "Vorlage", 0),
    ("Frieda", "Fiktiv", 1),
    ("Felix", "Fiktiv", 0),
    ("Paula", "Platzhalter", 1),
    ("Paul", "Platzhalter", 0),
    ("Sandra", "Schablone", 1),
    ("Stefan", "Schablone", 0),
    ("Emma", "Entwurf", 1),
    ("Emil", "Entwurf", 0),
    ("Klara", "Konzept", 1),
    ("Konrad", "Konzept", 0),
    ("Mia", "Modell", 1),
    ("Martin", "Modell", 0),
    ("Sofia", "Skizze", 1),
    ("Simon", "Skizze", 0),
    ("Lena", "Legende", 1),
    ("Lukas", "Legende", 0),
]

# Benutzerkonten, die nach (echten) Original-Nachnamen benannt sind → fiktiv.
USER_RENAMES = {
    "Schmidt": "Beispiel",
    "Bartel": "Demo",
    "Herzog": "Probe",
    "Wolf": "Test",
}

DEMO_FUNCTIONS = ["Schichtleitung", "Fachkraft", "Maschinenführung", "Logistik", "Verwaltung"]

# Österreichische Feiertage 2026 (Ostersonntag = 05.04.2026)
HOLIDAYS_2026 = [
    ("2026-01-01", "Neujahr"),
    ("2026-01-06", "Heilige Drei Könige"),
    ("2026-04-06", "Ostermontag"),
    ("2026-05-01", "Staatsfeiertag"),
    ("2026-05-14", "Christi Himmelfahrt"),
    ("2026-05-25", "Pfingstmontag"),
    ("2026-06-04", "Fronleichnam"),
    ("2026-08-15", "Mariä Himmelfahrt"),
    ("2026-10-26", "Nationalfeiertag"),
    ("2026-11-01", "Allerheiligen"),
    ("2026-12-08", "Mariä Empfängnis"),
    ("2026-12-25", "Christtag"),
    ("2026-12-26", "Stefanitag"),
]


def get_db_path(cli_path: str | None) -> str:
    if cli_path:
        return cli_path
    env_path = os.environ.get("SP5_DB_PATH")
    if env_path:
        return env_path
    # Fallback: lokaler Entwicklungs-Pfad
    default = BACKEND_DIR.parent / "sp5_db" / "Daten"
    return str(default)


def _ascii(s: str) -> str:
    return (
        s.lower()
        .replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    )


def _unique_shortname(first: str, last: str, used: set[str]) -> str:
    base = (first[0] + last[:2]).upper()
    cand = base
    i = 2
    while cand in used:
        cand = (first[0] + last[0] + str(i)).upper()
        i += 1
    used.add(cand)
    return cand


def _weekdays_between(start: date, days: int) -> list[date]:
    """Die nächsten ``days`` Werktage ab ``start`` (inklusive)."""
    out, d = [], start
    while len(out) < days:
        if d.weekday() < 5:
            out.append(d)
        d += timedelta(days=1)
    return out


def seed(db_path: str, dry_run: bool = False, seed_value: int = 42) -> None:
    from sp5lib.database import SP5Database

    print(f"Datenbank: {db_path}")
    if dry_run:
        print("DRY-RUN — keine Änderungen werden geschrieben")

    db = SP5Database(db_path)
    rng = random.Random(seed_value)
    today = date.today()
    year = today.year

    # ── Mitarbeiter umbenennen (eindeutig fiktive Demo-Namen) ────
    employees = sorted(db.get_employees(include_hidden=True), key=lambda e: e["ID"])
    print(f"\nBenenne {len(employees)} Mitarbeiter auf fiktive Demo-Namen um...")
    used_shortnames: set[str] = set()
    for idx, (first, last, sex) in enumerate(DEMO_NAMES):
        shortname = _unique_shortname(first, last, used_shortnames)
        birthday = date(1966 + (idx * 13) % 36, (idx % 12) + 1, (idx * 7) % 28 + 1)
        data = {
            "NAME": last,
            "FIRSTNAME": first,
            "SHORTNAME": shortname,
            "SEX": sex,
            "EMAIL": f"{_ascii(first)}.{_ascii(last)}@example.com",
            "PHONE": f"+43 555 01{idx:02d}",
            "STREET": f"Musterweg {idx + 1}",
            "ZIP": "12345",
            "TOWN": "Musterstadt",
            "BIRTHDAY": birthday.isoformat(),
            "FUNCTION": DEMO_FUNCTIONS[idx % len(DEMO_FUNCTIONS)],
        }
        if dry_run:
            print(f"   [dry] {first} {last} ({shortname})")
            continue
        if idx < len(employees):
            emp_id = employees[idx]["ID"]
            db.update_employee(emp_id, data)
            print(f"   {emp_id}: {first} {last} ({shortname})")
        else:
            emp = db.create_employee({**data, "HRSDAY": 7.7, "HRSWEEK": 38.5})
            print(f"   neu {emp.get('ID')}: {first} {last} ({shortname})")
    emp_ids = [e["ID"] for e in employees]

    # ── Benutzerkonten umbenennen ────────────────────────────────
    print("\nBenenne Benutzerkonten um...")
    for user in db.get_users():
        new_name = USER_RENAMES.get((user.get("NAME") or "").strip())
        if not new_name:
            continue
        if dry_run:
            print(f"   [dry] {user['NAME']} → {new_name}")
        else:
            db.update_user(user["ID"], {"NAME": new_name})
            print(f"   {user['NAME']} → {new_name}")

    if dry_run:
        print("\nDRY-RUN beendet (Bewegungsdaten werden erst beim echten Lauf erzeugt)")
        return

    # ── Feiertage ────────────────────────────────────────────────
    existing_holidays = {h.get("DATE") for h in db.get_holidays(year)}
    print("\nLege Feiertage an...")
    created = 0
    for iso, name in HOLIDAYS_2026:
        if iso in existing_holidays:
            continue
        db.create_holiday({"DATE": iso, "NAME": name})
        created += 1
    print(f"   {created} Feiertage angelegt")

    # ── Urlaubsansprüche (inkl. Resturlaub für Verfall-Dialog) ──
    print("\nSetze Urlaubsansprüche...")
    for idx, emp_id in enumerate(emp_ids):
        days = 25.0 + (idx % 3) * 2.5
        carry = float(rng.choice([0, 0, 2, 3, 5, 8]))
        db.set_leave_entitlement(emp_id, year, days, carry_forward=carry)
    print(f"   {len(emp_ids)} Ansprüche für {year} gesetzt")

    # ── Personalbedarf (Coverage-Ampel im Dienstplan) ────────────
    print("\nSetze Personalbedarf (Teams A/B/C × Früh/Spät/Nacht)...")
    team_ids = [
        g["ID"]
        for g in db.get_groups(include_hidden=True)
        if (g.get("NAME") or "").startswith("Team")
    ]
    shift_by_short = {(s.get("SHORTNAME") or "").upper(): s["ID"] for s in db.get_shifts()}
    demand = {"F": (1, 3), "S": (1, 3), "N": (1, 2)}
    cells = 0
    for gid in team_ids:
        for short, (mn, mx) in demand.items():
            sid = shift_by_short.get(short)
            if not sid:
                continue
            for weekday in range(7):
                if weekday >= 5:  # Wochenende: weniger Bedarf
                    mn_w, mx_w = max(0, mn - 1), max(1, mx - 1)
                else:
                    mn_w, mx_w = mn, mx
                db.set_staffing_requirement(sid, weekday, mn_w, mx_w, gid)
                cells += 1
    print(f"   {cells} Bedarfszellen gesetzt")

    # ── Abwesenheiten (aktueller Monat ± 1) ──────────────────────
    print("\nErzeuge Abwesenheiten...")
    leave_by_name = {lt["NAME"]: lt["ID"] for lt in db.get_leave_types()}
    existing_abs = {
        (a["employee_id"], a["date"]) for a in db.get_absences_list(year)
    }

    def add_absence(emp_id: int, d: date, leave_type_id: int, clear_shift: bool = True) -> int:
        if (emp_id, d.isoformat()) in existing_abs:
            return 0
        if clear_shift:
            db.delete_shift_only(emp_id, d.isoformat())
        db.add_absence(emp_id, d.isoformat(), leave_type_id)
        existing_abs.add((emp_id, d.isoformat()))
        return 1

    added_abs = 0
    month_start = today.replace(day=1)
    # Urlaubsblöcke: 8 Mitarbeiter mit je 5-10 Werktagen
    for emp_id in rng.sample(emp_ids, 8):
        start = month_start + timedelta(days=rng.randint(-21, 21))
        for d in _weekdays_between(start, rng.randint(5, 10)):
            added_abs += add_absence(emp_id, d, leave_by_name["Urlaub"])
    # Krankheit: 10 kurze Episoden (1-3 Tage)
    for emp_id in rng.sample(emp_ids, 10):
        start = month_start + timedelta(days=rng.randint(-14, 18))
        for d in _weekdays_between(start, rng.randint(1, 3)):
            added_abs += add_absence(emp_id, d, leave_by_name["Krankheit"])
    # Fortbildung/Arztbesuch: einzelne Tage, Schicht absichtlich stehen
    # lassen → ein paar echte Konflikte für die Konflikt-Ansichten
    for i, emp_id in enumerate(rng.sample(emp_ids, 6)):
        lt = leave_by_name["Fortbildung"] if i % 2 == 0 else leave_by_name["Arztbesuch"]
        d = _weekdays_between(month_start + timedelta(days=rng.randint(0, 18)), 1)[0]
        added_abs += add_absence(emp_id, d, lt, clear_shift=(i % 3 != 0))
    print(f"   {added_abs} Abwesenheits-Tage erzeugt")

    # ── Schichtwünsche ───────────────────────────────────────────
    print("\nErzeuge Schichtwünsche...")
    wish_notes = [
        "Kinderbetreuung", "privater Termin", "Vereinstraining",
        "Weiterbildung", "Familienfeier", "",
    ]
    added_wishes = 0
    for i, emp_id in enumerate(rng.sample(emp_ids, 12)):
        d = today + timedelta(days=rng.randint(1, 21))
        try:
            if i % 2 == 0:
                sid = shift_by_short.get("F" if i % 4 == 0 else "S")
                db.add_wish(emp_id, d.isoformat(), "WUNSCH", shift_id=sid)
            else:
                db.add_wish(emp_id, d.isoformat(), "SPERRUNG", note=rng.choice(wish_notes))
            added_wishes += 1
        except ValueError:
            pass  # Duplikat → ignorieren
    print(f"   {added_wishes} Wünsche/Sperrungen erzeugt")

    # ── Tauschanfragen (Tauschbörse) ─────────────────────────────
    print("\nErzeuge Tauschanfragen...")
    added_swaps = 0
    if len(db.get_swap_requests() or []) == 0:
        pairs = list(zip(rng.sample(emp_ids, 8)[:4], rng.sample(emp_ids, 8)[4:]))
        for a, b in pairs:
            d1 = today + timedelta(days=rng.randint(1, 10))
            d2 = today + timedelta(days=rng.randint(1, 10))
            db.create_swap_request(a, d1.isoformat(), b, d2.isoformat(), note="Bitte um Tausch")
            added_swaps += 1
    print(f"   {added_swaps} Tauschanfragen erzeugt")

    # ── Notizen ──────────────────────────────────────────────────
    print("\nErzeuge Notizen...")
    demo_notes = [
        "Teambesprechung 10:00 Uhr",
        "Wartung Maschine 2",
        "Inventur im Lager",
        "Brandschutzübung",
        "Neue Dienstkleidung abholen",
    ]
    existing_notes = {n.get("date") for n in (db.get_notes() or [])}
    added_notes = 0
    for i, text in enumerate(demo_notes):
        d = (month_start + timedelta(days=2 + i * 6)).isoformat()
        if d in existing_notes:
            continue
        db.add_note(d, text)
        added_notes += 1
    print(f"   {added_notes} Notizen erzeugt")

    print("\nDemo-Daten geladen!")


def main() -> None:
    parser = argparse.ArgumentParser(description="Demo-Daten in SP5-Datenbank laden")
    parser.add_argument("--db", help="Pfad zur SP5-Datenbank (Daten-Verzeichnis)")
    parser.add_argument("--dry-run", action="store_true", help="Nur simulieren, nichts schreiben")
    parser.add_argument("--seed", type=int, default=42, help="Zufalls-Seed (deterministisch)")
    args = parser.parse_args()

    db_path = get_db_path(args.db)

    if not os.path.isdir(db_path):
        print(f"Datenbankverzeichnis nicht gefunden: {db_path}")
        print("   Setze SP5_DB_PATH oder übergib --db /pfad/zur/datenbank")
        sys.exit(1)

    seed(db_path, dry_run=args.dry_run, seed_value=args.seed)


if __name__ == "__main__":
    main()
