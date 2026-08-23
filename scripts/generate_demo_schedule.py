#!/usr/bin/env python3
"""Generate a realistic demo shift schedule into an SP5 data directory.

Starts from an existing (schema-valid) SP5 ``Daten`` directory — typically a copy
of ``backend/fixtures`` — and fills the last ``--months`` months plus the current
one (with a one-week look-ahead) with a rotating shift plan so the UI (dashboard,
schedule, statistics, conflicts …) shows populated, current data. Useful for
demos and for regenerating screenshots.

Usage:
    python scripts/generate_demo_schedule.py <daten_dir> [--months 13] [--seed 42]

It is idempotent: existing entries for an (employee, date) are kept. Days with an
absence entry are skipped — apart from a small deliberate conflict quota so the
conflict views have something to show. All bytes are written by ``sp5lib``
(``libopenschichtplaner5``); see :func:`bulk_append_mashi` for how large volumes
stay O(n).
"""

from __future__ import annotations

import argparse
import calendar
import logging
import os
import random
import sys
from datetime import date, timedelta

#: Anteil der Abwesenheitstage, die absichtlich TROTZDEM verplant werden —
#: erzeugt einige echte Schicht/Abwesenheits-Konflikte für die Konflikt-Ansichten.
CONFLICT_QUOTA = 0.01


def month_list(today: date, months_back: int) -> list[tuple[int, int]]:
    """Die ``months_back`` Monate vor ``today`` plus der aktuelle, chronologisch."""
    months: list[tuple[int, int]] = []
    y, m = today.year, today.month
    for _ in range(months_back + 1):
        months.insert(0, (y, m))
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return months


def _month_range(year: int, month: int) -> list[date]:
    days = calendar.monthrange(year, month)[1]
    return [date(year, month, d) for d in range(1, days + 1)]


def _journal_path(filepath: str) -> str | None:
    """Pfad der -L-Änderungsjournal-Tabelle zu *filepath*, falls vorhanden."""
    base, ext = os.path.splitext(filepath)
    for suffix in ("-L", "-l"):
        candidate = base + suffix + ext
        if os.path.exists(candidate):
            return candidate
    return None


def bulk_append_mashi(daten_dir: str, records: list[dict]) -> None:
    """Append many 5MASHI records via sp5lib in O(n) statt O(n²).

    ``append_record(autoid_field=…)`` vergibt IDs über einen Volltabellen-Scan
    und journalt jeden Satz einzeln in 5MASHI-L (erneut mit NUMBER-Scan) — bei
    zehntausenden Sätzen wird das quadratisch (Minuten statt Sekunden). Hier
    werden die IDs vorab fortlaufend vergeben (``records`` bringen ihre ID mit),
    das Journal wird für die Dauer des Appends beiseitegelegt und danach in
    derselben Reihenfolge nachgezogen (NUMBER fortlaufend, CHANGE=1 je Satz).
    Jedes Byte schreibt weiterhin ``sp5lib.append_record`` — das Ergebnis ist
    byte-identisch zu sequenziellen Einzel-Writes.
    """
    from sp5lib.database import append_record
    from sp5lib.dbf_reader import get_table_fields, read_dbf

    mashi = os.path.join(daten_dir, "5MASHI.DBF")
    fields = get_table_fields(mashi)
    jpath = _journal_path(mashi)
    writer_log = logging.getLogger("sp5lib.dbf_writer")
    old_level = writer_log.level
    parked = None
    if jpath:
        parked = jpath + ".demo-seed-parked"
        os.rename(jpath, parked)
        # „change journal missing“-Warnung würde sonst je Satz geloggt
        writer_log.setLevel(logging.ERROR)
    try:
        for rec in records:
            append_record(mashi, fields, rec)
    finally:
        if parked:
            os.rename(parked, jpath)
            writer_log.setLevel(old_level)

    if jpath:
        jfields = get_table_fields(jpath)
        next_num = max((r.get("NUMBER") or 0 for r in read_dbf(jpath)), default=0) + 1
        for rec in records:
            append_record(
                jpath,
                jfields,
                {
                    "NUMBER": next_num,
                    "CHANGEID1": rec["ID"],
                    "CHANGEID2": rec["EMPLOYEEID"],
                    "CHANGEID3": 0,
                    "CHANGE": 1,
                },
            )
            next_num += 1


def generate(daten_dir: str, months_back: int = 1, seed: int = 42) -> dict:
    # sp5lib resolves backend resource dirs via SP5_BACKEND_DIR; set a sane
    # default so changelog/etc. don't land in site-packages.
    os.environ.setdefault("SP5_BACKEND_DIR", os.path.dirname(os.path.abspath(daten_dir)))
    from sp5lib.database import SP5Database, find_all_records
    from sp5lib.dbf_reader import get_table_fields

    db = SP5Database(daten_dir)
    shifts = db.get_shifts()
    employees = db.get_employees(include_hidden=False)
    if not shifts or not employees:
        raise SystemExit("No shifts/employees found in data dir — wrong path?")

    # Order shifts as a sensible rotation: Früh, Spät, Nacht, then any extras.
    by_name = {(s.get("SHORTNAME") or "").upper(): s["ID"] for s in shifts}
    rotation = [by_name.get(k) for k in ("F", "S", "N") if by_name.get(k)]
    extras = [s["ID"] for s in shifts if s["ID"] not in rotation]
    shift_ids = rotation or [s["ID"] for s in shifts]
    day_shift = extras[0] if extras else shift_ids[0]

    emp_ids = sorted(e["ID"] for e in employees)
    rng = random.Random(seed)
    today = date.today()
    months = month_list(today, months_back)

    # Bestehende Einträge + höchste ID EINMAL lesen (statt Scan je Satz)
    mashi = os.path.join(daten_dir, "5MASHI.DBF")
    existing_rows = find_all_records(mashi, get_table_fields(mashi))
    existing = {
        (r.get("EMPLOYEEID"), r.get("DATE"))
        for _, r in existing_rows
        if int(r.get("TYPE") or 0) == 0
    }
    next_id = max((r.get("ID") or 0 for _, r in existing_rows), default=0) + 1

    # Abwesenheitstage (z. B. aus seed_demo_data) nicht überplanen —
    # bis auf die kleine Konflikt-Quote.
    absent: set[tuple[int, str]] = set()
    for yy in sorted({y for y, _ in months}):
        for a in db.get_absences_list(yy):
            absent.add((a["employee_id"], a["date"]))

    records: list[dict] = []
    skipped = conflicts = 0
    horizon = today + timedelta(days=7)  # one-week look-ahead
    for yy, mm in months:
        for day in _month_range(yy, mm):
            if day > horizon:
                continue
            weekday = day.weekday()  # 0=Mon .. 6=Sun
            iso = day.isoformat()
            week = day.isocalendar()[1]
            # Rotate which employees work which shift; fewer staff on weekends.
            staff = emp_ids[:]
            rng.shuffle(staff)
            if weekday >= 5:
                staff = staff[: len(staff) // 2]
            # ~80% of the eligible staff get a shift on a given day
            on_duty = staff[: int(len(staff) * 0.8)]
            for idx, emp in enumerate(sorted(on_duty)):
                if (emp, iso) in existing:
                    skipped += 1
                    continue
                if (emp, iso) in absent:
                    if rng.random() >= CONFLICT_QUOTA:
                        skipped += 1
                        continue
                    conflicts += 1  # bewusst überplanter Abwesenheitstag
                # rotation index shifts per week and per employee for variety
                sid = (
                    day_shift
                    if (idx % 7 == 0 and weekday < 5)
                    else shift_ids[(idx + week) % len(shift_ids)]
                )
                records.append(
                    {
                        "ID": next_id,
                        "EMPLOYEEID": emp,
                        "DATE": iso,
                        "SHIFTID": sid,
                        "WORKPLACID": 0,
                        "TYPE": 0,
                        "RESERVED": "",
                    }
                )
                next_id += 1

    bulk_append_mashi(daten_dir, records)
    return {
        "created": len(records),
        "skipped": skipped,
        "conflicts": conflicts,
        "months": months,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("daten_dir", help="Path to the SP5 'Daten' directory (.DBF files)")
    ap.add_argument("--months", type=int, default=1, help="How many months back to also fill")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    if not os.path.isdir(args.daten_dir):
        sys.exit(f"Not a directory: {args.daten_dir}")
    result = generate(args.daten_dir, months_back=args.months, seed=args.seed)
    print(
        f"Demo schedule generated: {result['created']} entries created, "
        f"{result['skipped']} kept/skipped, {result['conflicts']} deliberate conflicts "
        f"across months {result['months'][0]}..{result['months'][-1]}"
    )


if __name__ == "__main__":
    main()
