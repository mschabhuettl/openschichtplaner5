#!/usr/bin/env python3
"""
seed_demo_data.py — eindeutig synthetische Demo-Daten in eine SP5-Datenbank laden.

Macht aus einer schema-validen SP5-Datenbasis (z. B. einer Kopie von
``backend/fixtures``) eine erkennbar fiktive Demo-Datenbank:

  - benennt alle Mitarbeiter auf eindeutig fiktive deutsche Demo-Namen um
    (Max Mustermann, Anna Beispiel, Doris Demo, …) inkl. fiktiver
    Kontaktdaten, Geburtstage und Funktionen
  - legt mit ``--employees N`` zusätzliche fiktive Mitarbeiter an, bis N
    erreicht ist (Namen kombinatorisch aus dem Muster-Pool, z. B.
    „Mia Modell-Nord"; Gruppenzuordnung über die vorhandenen Teams,
    ein Teil Teilzeit mit variiertem CALCBASE/Wochenstunden)
  - benennt Benutzerkonten passend um
  - legt Feiertage, Urlaubsansprüche (inkl. Resturlaub für den
    Verfall-Dialog) und Personalbedarf (Coverage-Ampel) an
  - erzeugt Abwesenheiten, Schichtwünsche, Tauschanfragen und Notizen —
    mit ``--months M`` über die letzten M Monate verteilt (Default: rund
    um den aktuellen Monat)

Empfohlene Reihenfolge (der Dienstplan-Generator überspringt die hier
angelegten Abwesenheitstage):

  cp -r backend/fixtures /tmp/sp5-demo-daten
  python scripts/seed_demo_data.py --db /tmp/sp5-demo-daten --employees 120 --months 13
  python scripts/generate_demo_schedule.py /tmp/sp5-demo-daten --months 13

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

#: Nachnamens-Zusätze für die kombinatorische Pool-Erweiterung („Muster-Nord").
SURNAME_SUFFIXES = [
    "Nord", "Süd", "Ost", "West", "Berg", "Tal",
    "Feld", "See", "Wald", "Bach", "Stein", "Burg",
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


def build_demo_names(count: int) -> list[tuple[str, str, int]]:
    """Deterministische Liste von ``count`` eindeutigen fiktiven Demo-Namen.

    Basis ist :data:`DEMO_NAMES`; darüber hinaus wird der Pool kombinatorisch
    mit Nachnamens-Zusätzen erweitert („Mia Modell-Nord", „Max Mustermann-Süd",
    …) — nach den 12 Zusätzen mit Zählsuffix („-Nord2"), also beliebig weit.
    """
    names = list(DEMO_NAMES)
    round_no = 0
    while len(names) < count:
        suffix = SURNAME_SUFFIXES[round_no % len(SURNAME_SUFFIXES)]
        if round_no >= len(SURNAME_SUFFIXES):
            suffix = f"{suffix}{round_no // len(SURNAME_SUFFIXES) + 1}"
        for first, last, sex in DEMO_NAMES:
            names.append((first, f"{last}-{suffix}", sex))
            if len(names) >= count:
                break
        round_no += 1
    return names[:count]


def demo_hours(idx: int) -> dict:
    """Arbeitszeit-Profil je Mitarbeiter-Index: ~70 % Vollzeit, Rest Teilzeit.

    Deterministisch (Index-Rotation); variiert HRSWEEK/HRSDAY/HRSMONTH und
    CALCBASE (0 = Tagesbasis, 1 = kalenderfixe Wochen — wie im Fixture-Bestand).
    """
    patterns = [
        (38.5, 7.7, 0), (38.5, 7.7, 0), (38.5, 7.7, 1),
        (30.0, 6.0, 0), (38.5, 7.7, 0), (20.0, 4.0, 1),
        (38.5, 7.7, 0), (25.0, 5.0, 0), (38.5, 7.7, 0),
        (19.25, 3.85, 1),
    ]
    hrsweek, hrsday, calcbase = patterns[idx % len(patterns)]
    return {
        "HRSWEEK": hrsweek,
        "HRSDAY": hrsday,
        "HRSMONTH": round(hrsweek * 4.0, 2),
        "CALCBASE": calcbase,
    }


def spread_window(today: date, months: int) -> tuple[date, date]:
    """Zeitfenster für verteilte Bewegungsdaten.

    Vom Monatsanfang ``months - 1`` Monate zurück bis vier Wochen nach heute —
    deckt sich mit dem Zeitraum, den generate_demo_schedule füllt.
    """
    y, m = today.year, today.month
    for _ in range(max(0, months - 1)):
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return date(y, m, 1), today + timedelta(days=28)


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


def _rand_day(rng: random.Random, start: date, end: date) -> date:
    return start + timedelta(days=rng.randint(0, max(0, (end - start).days)))


def seed(
    db_path: str,
    dry_run: bool = False,
    seed_value: int = 42,
    employees_target: int | None = None,
    months: int = 1,
) -> None:
    # sp5lib legt JSON-Stores (z. B. Tauschanfragen) unter SP5_BACKEND_DIR/data
    # ab — ohne gesetzte Variable neben dem installierten Paket. Default wie in
    # generate_demo_schedule: das Elternverzeichnis des Daten-Verzeichnisses.
    os.environ.setdefault("SP5_BACKEND_DIR", os.path.dirname(os.path.abspath(db_path)))
    from sp5lib.database import SP5Database

    print(f"Datenbank: {db_path}")
    if dry_run:
        print("DRY-RUN — keine Änderungen werden geschrieben")

    db = SP5Database(db_path)
    rng = random.Random(seed_value)
    today = date.today()
    year = today.year
    win_start, win_end = spread_window(today, months)

    # ── Mitarbeiter: umbenennen + bis --employees auffüllen ──────
    employees = sorted(db.get_employees(include_hidden=True), key=lambda e: e["ID"])
    target = max(employees_target or 0, len(employees))
    names = build_demo_names(target)
    to_create = target - len(employees)
    print(
        f"\nBenenne {len(employees)} Mitarbeiter auf fiktive Demo-Namen um"
        + (f" und lege {to_create} neue an..." if to_create else "...")
    )
    team_ids = sorted(
        g["ID"]
        for g in db.get_groups(include_hidden=True)
        if (g.get("NAME") or "").startswith("Team")
    )
    prod_ids = [
        g["ID"]
        for g in db.get_groups(include_hidden=True)
        if (g.get("NAME") or "") == "Produktion"
    ]
    used_shortnames: set[str] = set()
    emp_ids: list[int] = []
    for idx, (first, last, sex) in enumerate(names):
        shortname = _unique_shortname(first, last, used_shortnames)
        birthday = date(1966 + (idx * 13) % 36, (idx % 12) + 1, (idx * 7) % 28 + 1)
        data = {
            "NAME": last,
            "FIRSTNAME": first,
            "SHORTNAME": shortname,
            "SEX": sex,
            "EMAIL": f"{_ascii(first)}.{_ascii(last)}@example.com",
            "PHONE": f"+43 555 0{idx:03d}",
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
            emp_ids.append(emp_id)
            print(f"   {emp_id}: {first} {last} ({shortname})")
        else:
            emp = db.create_employee(
                {
                    **data,
                    **demo_hours(idx),
                    "NUMBER": f"D{1000 + idx}",
                    "WORKDAYS": "1 1 1 1 1 0 0 0",
                }
            )
            emp_id = emp["ID"]
            emp_ids.append(emp_id)
            # Gruppenzuordnung: Teams reihum, jeder 6. zusätzlich Produktion
            if team_ids:
                db.add_group_member(team_ids[idx % len(team_ids)], emp_id)
            if prod_ids and idx % 6 == 0:
                db.add_group_member(prod_ids[0], emp_id)
    if not dry_run and to_create:
        print(f"   {to_create} neue Mitarbeiter angelegt (gesamt {len(emp_ids)})")

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

    # ── Abwesenheiten (über das Fenster verteilt) ────────────────
    print(f"\nErzeuge Abwesenheiten ({win_start} … {win_end})...")
    leave_by_name = {lt["NAME"]: lt["ID"] for lt in db.get_leave_types()}
    existing_abs = set()
    for yy in range(win_start.year, win_end.year + 1):
        existing_abs |= {(a["employee_id"], a["date"]) for a in db.get_absences_list(yy)}

    def add_absence(emp_id: int, d: date, leave_type_id: int, clear_shift: bool = True) -> int:
        if not (win_start <= d <= win_end):
            return 0
        if (emp_id, d.isoformat()) in existing_abs:
            return 0
        if clear_shift:
            db.delete_shift_only(emp_id, d.isoformat())
        db.add_absence(emp_id, d.isoformat(), leave_type_id)
        existing_abs.add((emp_id, d.isoformat()))
        return 1

    added_abs = 0
    # Urlaubsblöcke: skaliert mit MA-Zahl und Fensterbreite (je MA ~2 Blöcke/Jahr)
    vacation_blocks = max(4, round(len(emp_ids) * months / 6))
    for _ in range(vacation_blocks):
        emp_id = rng.choice(emp_ids)
        start = _rand_day(rng, win_start, win_end - timedelta(days=14))
        for d in _weekdays_between(start, rng.randint(5, 10)):
            added_abs += add_absence(emp_id, d, leave_by_name["Urlaub"])
    # Krankheit: kurze Episoden (1-3 Tage)
    sick_episodes = max(4, round(len(emp_ids) * months / 8))
    for _ in range(sick_episodes):
        emp_id = rng.choice(emp_ids)
        start = _rand_day(rng, win_start, today)
        for d in _weekdays_between(start, rng.randint(1, 3)):
            added_abs += add_absence(emp_id, d, leave_by_name["Krankheit"])
    # Fortbildung/Arztbesuch: einzelne Tage
    single_days = max(4, round(len(emp_ids) * months / 12))
    for i in range(single_days):
        emp_id = rng.choice(emp_ids)
        lt = leave_by_name["Fortbildung"] if i % 2 == 0 else leave_by_name["Arztbesuch"]
        d = _weekdays_between(_rand_day(rng, win_start, win_end - timedelta(days=7)), 1)[0]
        added_abs += add_absence(emp_id, d, lt)
    print(f"   {added_abs} Abwesenheits-Tage erzeugt")

    # ── Schichtwünsche ───────────────────────────────────────────
    print("\nErzeuge Schichtwünsche...")
    wish_notes = [
        "Kinderbetreuung", "privater Termin", "Vereinstraining",
        "Weiterbildung", "Familienfeier", "",
    ]
    wish_count = max(8, round(len(emp_ids) * months / 12))
    added_wishes = 0
    for i in range(wish_count):
        emp_id = rng.choice(emp_ids)
        if i % 5 < 3:  # überwiegend nahe Zukunft, Rest im Fenster verteilt
            d = today + timedelta(days=rng.randint(1, 21))
        else:
            d = _rand_day(rng, win_start, win_end)
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
        swap_count = max(4, len(emp_ids) // 8)
        for i in range(swap_count):
            a, b = rng.sample(emp_ids, 2)
            if i % 2 == 0:  # offene Anfragen in der nahen Zukunft
                d1 = today + timedelta(days=rng.randint(1, 10))
                d2 = today + timedelta(days=rng.randint(1, 10))
                status = "pending"
            else:  # bereits entschiedene Anfragen in der Vergangenheit
                d1 = _rand_day(rng, win_start, today)
                d2 = d1 + timedelta(days=rng.randint(1, 5))
                status = "approved" if i % 4 == 1 else "rejected"
            db.create_swap_request(
                a, d1.isoformat(), b, d2.isoformat(),
                note="Bitte um Tausch", status=status,
            )
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
        "Erste-Hilfe-Auffrischung",
        "Betriebsversammlung",
        "Hygieneschulung",
    ]
    existing_notes = {n.get("date") for n in (db.get_notes() or [])}
    added_notes = 0
    d = win_start
    i = 0
    while d <= win_end:
        iso = (d + timedelta(days=2 + (i * 5) % 18)).isoformat()
        if iso not in existing_notes:
            db.add_note(iso, demo_notes[i % len(demo_notes)])
            existing_notes.add(iso)
            added_notes += 1
        i += 1
        # nächster Monatsanfang
        y, m = d.year, d.month
        m += 1
        if m == 13:
            y, m = y + 1, 1
        d = date(y, m, 1)
    print(f"   {added_notes} Notizen erzeugt")

    print("\nDemo-Daten geladen!")


def main() -> None:
    parser = argparse.ArgumentParser(description="Demo-Daten in SP5-Datenbank laden")
    parser.add_argument("--db", help="Pfad zur SP5-Datenbank (Daten-Verzeichnis)")
    parser.add_argument("--dry-run", action="store_true", help="Nur simulieren, nichts schreiben")
    parser.add_argument("--seed", type=int, default=42, help="Zufalls-Seed (deterministisch)")
    parser.add_argument(
        "--employees",
        type=int,
        default=None,
        help="Zielanzahl Mitarbeiter (fehlende werden fiktiv angelegt; Default: nur umbenennen)",
    )
    parser.add_argument(
        "--months",
        type=int,
        default=1,
        help="Bewegungsdaten über die letzten N Monate verteilen (Default: aktueller Monat)",
    )
    args = parser.parse_args()

    db_path = get_db_path(args.db)

    if not os.path.isdir(db_path):
        print(f"Datenbankverzeichnis nicht gefunden: {db_path}")
        print("   Setze SP5_DB_PATH oder übergib --db /pfad/zur/datenbank")
        sys.exit(1)

    seed(
        db_path,
        dry_run=args.dry_run,
        seed_value=args.seed,
        employees_target=args.employees,
        months=args.months,
    )


if __name__ == "__main__":
    main()
