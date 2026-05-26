#!/usr/bin/env python3
"""Generate a realistic demo shift schedule into an SP5 data directory.

Starts from an existing (schema-valid) SP5 ``Daten`` directory — typically a copy
of ``backend/tests/fixtures`` — and fills the previous + current month with a
rotating shift plan so the UI (dashboard, schedule, statistics, conflicts …) shows
populated, current data. Useful for demos and for regenerating screenshots.

Usage:
    python scripts/generate_demo_schedule.py <daten_dir> [--months 2] [--seed 42]

It is idempotent: existing entries for a (employee, date) are replaced.
Requires the ``sp5lib`` package (``libopenschichtplaner5``) to be importable.
"""

from __future__ import annotations

import argparse
import calendar
import os
import random
import sys
from datetime import date


def _month_range(year: int, month: int):
    days = calendar.monthrange(year, month)[1]
    return [date(year, month, d) for d in range(1, days + 1)]


def generate(daten_dir: str, months_back: int = 1, seed: int = 42) -> dict:
    # sp5lib resolves backend resource dirs via SP5_BACKEND_DIR; point it at the
    # parent of the data dir is unnecessary here (we only touch MASHI), but set a
    # sane default so changelog/etc. don't land in site-packages.
    os.environ.setdefault("SP5_BACKEND_DIR", os.path.dirname(os.path.abspath(daten_dir)))
    from sp5lib.database import SP5Database

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
    # Build the list of months to fill: [today-1 .. today]
    months: list[tuple[int, int]] = []
    y, m = today.year, today.month
    for _ in range(months_back + 1):
        months.insert(0, (y, m))
        m -= 1
        if m == 0:
            y, m = y - 1, 12

    created = skipped = 0
    for (yy, mm) in months:
        for day in _month_range(yy, mm):
            # don't schedule far into the future beyond today + 7 days
            if day > date(today.year, today.month, today.day).replace(day=1) and day > today:
                # allow a one-week look-ahead in the current month
                from datetime import timedelta
                if day > today + timedelta(days=7):
                    continue
            weekday = day.weekday()  # 0=Mon .. 6=Sun
            iso = day.isoformat()
            # Rotate which employees work which shift; fewer staff on weekends.
            week = day.isocalendar()[1]
            staff = emp_ids[:] if weekday < 5 else emp_ids[: len(emp_ids) // 2]
            rng.shuffle(staff)
            # ~80% of the eligible staff get a shift on a given day
            on_duty = staff[: int(len(staff) * 0.8)]
            for idx, emp in enumerate(sorted(on_duty)):
                # rotation index shifts per week and per employee for variety
                sid = (
                    day_shift
                    if (idx % 7 == 0 and weekday < 5)
                    else shift_ids[(idx + week) % len(shift_ids)]
                )
                try:
                    db.delete_schedule_entry(emp, iso)
                except Exception:
                    pass
                try:
                    db.add_schedule_entry(emp, iso, sid)
                    created += 1
                except Exception:
                    skipped += 1
    return {"created": created, "skipped": skipped, "months": months}


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
        f"{result['skipped']} skipped across months {result['months']}"
    )


if __name__ == "__main__":
    main()
