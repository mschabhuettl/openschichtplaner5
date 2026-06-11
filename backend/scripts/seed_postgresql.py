#!/usr/bin/env python3
"""
Seed script: Migrate data from DBF files to PostgreSQL.

Usage:
    DATABASE_URL=postgresql://user:pass@host:5432/sp5 \
    SP5_DB_PATH=/path/to/Daten \
    python -m scripts.seed_postgresql

This reads all data from the DBF files and inserts it into PostgreSQL.
Existing data in PostgreSQL tables is cleared first (full sync).
"""

import json
import logging
import os
import sys

# Add parent dir to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sp5lib.dbf_reader import read_dbf
from sp5lib.orm import (
    Absence,
    Booking,
    Cycle,
    CycleAssignment,
    Employee,
    Group,
    GroupAssignment,
    Holiday,
    LeaveEntitlement,
    LeaveType,
    OvertimeRecord,
    Restriction,
    ScheduleEntry,
    Shift,
    SpecialShift,
    Workplace,
)
from sp5lib.orm.base import Base

# PG-only Modelle (JSON-Sidecar-Ersatz) liegen in models_pg
from sp5lib.orm.models_pg import (
    CycleEntry,
    ExtraCharge,
    HolidayBan,
    Note,
    Settings,
    User,
)
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
_log = logging.getLogger("seed")


def _read_dbf_safe(daten_path: str, table_name: str) -> list[dict]:
    """Read a DBF table, returning empty list on error."""
    path = os.path.join(daten_path, f"5{table_name}.DBF")
    try:
        return read_dbf(path)
    except Exception as exc:
        _log.warning("Could not read %s: %s", path, exc)
        return []


def seed(database_url: str, daten_path: str):
    """Migrate all data from DBF to PostgreSQL."""
    _log.info("Connecting to PostgreSQL: %s", database_url.split("@")[-1] if "@" in database_url else "***")
    engine = create_engine(database_url, pool_pre_ping=True)

    # Create all tables
    Base.metadata.create_all(engine)
    SessionFactory = sessionmaker(bind=engine)

    with SessionFactory() as session:
        # Clear existing data
        _log.info("Clearing existing data...")
        for table in reversed(Base.metadata.sorted_tables):
            session.execute(table.delete())
        session.commit()

        _log.info("Reading DBF files from: %s", daten_path)

        # ── Employees ──
        count = 0
        for r in _read_dbf_safe(daten_path, "EMPL"):
            if not r.get("ID"):
                continue
            session.add(Employee(
                id=r["ID"], position=r.get("POSITION", 0) or 0,
                number=str(r.get("NUMBER") or "").strip(),
                name=str(r.get("NAME") or "").strip(),
                firstname=str(r.get("FIRSTNAME") or "").strip(),
                shortname=str(r.get("SHORTNAME") or "").strip(),
                sex=r.get("SEX", 0) or 0,
                hrsday=float(r.get("HRSDAY", 0) or 0),
                hrsweek=float(r.get("HRSWEEK", 0) or 0),
                hrsmonth=float(r.get("HRSMONTH", 0) or 0),
                workdays=str(r.get("WORKDAYS") or "").strip(),
                salutation=str(r.get("SALUTATION") or "").strip(),
                street=str(r.get("STREET") or "").strip(),
                zip=str(r.get("ZIP") or "").strip(),
                town=str(r.get("TOWN") or "").strip(),
                phone=str(r.get("PHONE") or "").strip(),
                email=str(r.get("EMAIL") or "").strip(),
                function=str(r.get("FUNCTION") or "").strip(),
                birthday=str(r.get("BIRTHDAY") or "").strip() or None,
                empstart=str(r.get("EMPSTART") or "").strip() or None,
                empend=str(r.get("EMPEND") or "").strip() or None,
                hide=bool(r.get("HIDE")),
                note1=str(r.get("NOTE1") or "").strip(),
                note2=str(r.get("NOTE2") or "").strip(),
                note3=str(r.get("NOTE3") or "").strip(),
                note4=str(r.get("NOTE4") or "").strip(),
            ))
            count += 1
        _log.info("  employees: %d", count)

        # ── Groups ──
        count = 0
        for r in _read_dbf_safe(daten_path, "GROUP"):
            if not r.get("ID"):
                continue
            session.add(Group(
                id=r["ID"], name=str(r.get("NAME") or "").strip(),
                shortname=str(r.get("SHORTNAME") or "").strip(),
                super_id=r.get("SUPERID") or None,
                position=r.get("POSITION", 0) or 0,
                hide=bool(r.get("HIDE")),
            ))
            count += 1
        _log.info("  groups: %d", count)

        # ── Group Assignments ──
        # Die DBF-ID in 5GRASG ist NICHT eindeutig (laufender Index je Gruppe) —
        # PK autoincrement lassen, logische Identität ist (employee_id, group_id).
        count = 0
        seen_pairs = set()
        for r in _read_dbf_safe(daten_path, "GRASG"):
            pair = (r.get("EMPLOYEEID"), r.get("GROUPID"))
            if not pair[0] or not pair[1] or pair in seen_pairs:
                continue
            seen_pairs.add(pair)
            session.add(GroupAssignment(employee_id=pair[0], group_id=pair[1]))
            count += 1
        _log.info("  group_assignments: %d", count)

        # ── Shifts ──
        count = 0
        for r in _read_dbf_safe(daten_path, "SHIFT"):
            if not r.get("ID"):
                continue
            sh = Shift(
                id=r["ID"], name=str(r.get("NAME") or "").strip(),
                shortname=str(r.get("SHORTNAME") or "").strip(),
                position=r.get("POSITION", 0) or 0,
                hide=bool(r.get("HIDE")),
                colortext=r.get("COLORTEXT", 0) or 0,
                colorbar=r.get("COLORBAR", 0) or 0,
                colorbk=r.get("COLORBK", 16777215) or 16777215,
                duration0=float(r.get("DURATION0", 0) or 0),
            )
            for i in range(1, 8):
                setattr(sh, f"duration{i}", float(r.get(f"DURATION{i}", 0) or 0))
                setattr(sh, f"startend{i}", str(r.get(f"STARTEND{i}") or "").strip())
            sh.startend0 = str(r.get("STARTEND0") or "").strip()
            session.add(sh)
            count += 1
        _log.info("  shifts: %d", count)

        # ── Leave Types ──
        count = 0
        for r in _read_dbf_safe(daten_path, "LEAVT"):
            if not r.get("ID"):
                continue
            session.add(LeaveType(
                id=r["ID"], name=str(r.get("NAME") or "").strip(),
                shortname=str(r.get("SHORTNAME") or "").strip(),
                position=r.get("POSITION", 0) or 0,
                hide=bool(r.get("HIDE")),
                entitled=bool(r.get("ENTITLED")),
                stdentit=float(r.get("STDENTIT", 0) or 0),
                colortext=r.get("COLORTEXT", 0) or 0,
                colorbar=r.get("COLORBAR", 0) or 0,
                colorbk=r.get("COLORBK", 16777215) or 16777215,
            ))
            count += 1
        _log.info("  leave_types: %d", count)

        # ── Workplaces ──
        count = 0
        for r in _read_dbf_safe(daten_path, "WOPL"):
            if not r.get("ID"):
                continue
            session.add(Workplace(
                id=r["ID"], name=str(r.get("NAME") or "").strip(),
                shortname=str(r.get("SHORTNAME") or "").strip(),
                position=r.get("POSITION", 0) or 0,
                hide=bool(r.get("HIDE")),
                colortext=r.get("COLORTEXT", 0) or 0,
                colorbar=r.get("COLORBAR", 0) or 0,
                colorbk=r.get("COLORBK", 16777215) or 16777215,
            ))
            count += 1
        _log.info("  workplaces: %d", count)

        # ── Holidays ──
        count = 0
        for r in _read_dbf_safe(daten_path, "HOLID"):
            if not r.get("ID"):
                continue
            session.add(Holiday(
                id=r["ID"], date=str(r.get("DATE") or "").strip(),
                name=str(r.get("NAME") or "").strip(),
                interval=r.get("INTERVAL", 0) or 0,
            ))
            count += 1
        _log.info("  holidays: %d", count)

        # ── Schedule (MASHI) ──
        count = 0
        for r in _read_dbf_safe(daten_path, "MASHI"):
            if not r.get("ID"):
                continue
            session.add(ScheduleEntry(
                id=r["ID"], employee_id=r.get("EMPLOYEEID", 0),
                date=str(r.get("DATE") or "").strip(),
                shift_id=r.get("SHIFTID", 0),
                workplace_id=r.get("WORKPLACID", 0) or 0,
            ))
            count += 1
        _log.info("  schedule_entries (MASHI): %d", count)

        # ── Special Shifts (SPSHI) ──
        count = 0
        for r in _read_dbf_safe(daten_path, "SPSHI"):
            if not r.get("ID"):
                continue
            session.add(SpecialShift(
                id=r["ID"], employee_id=r.get("EMPLOYEEID", 0),
                date=str(r.get("DATE") or "").strip(),
                name=str(r.get("NAME") or "").strip(),
                shortname=str(r.get("SHORTNAME") or "").strip(),
                shift_id=r.get("SHIFTID", 0) or 0,
                workplace_id=r.get("WORKPLACID", 0) or 0,
                entry_type=r.get("TYPE", 0) or 0,
                colortext=r.get("COLORTEXT", 0) or 0,
                colorbar=r.get("COLORBAR", 0) or 0,
                colorbk=r.get("COLORBK", 16777215) or 16777215,
                startend=str(r.get("STARTEND") or "").strip(),
                duration=float(r.get("DURATION", 0) or 0),
            ))
            count += 1
        _log.info("  special_shifts (SPSHI): %d", count)

        # ── Absences ──
        count = 0
        for r in _read_dbf_safe(daten_path, "ABSEN"):
            if not r.get("ID"):
                continue
            session.add(Absence(
                id=r["ID"], employee_id=r.get("EMPLOYEEID", 0),
                date=str(r.get("DATE") or "").strip(),
                leave_type_id=r.get("LEAVETYPID", 0),
            ))
            count += 1
        _log.info("  absences: %d", count)

        # ── Users ──
        count = 0
        bcrypt_hashes = {}
        bcrypt_path = os.path.join(daten_path, "5USER_BCRYPT.json")
        if os.path.exists(bcrypt_path):
            try:
                with open(bcrypt_path, encoding="utf-8") as f:
                    bcrypt_hashes = json.load(f)
            except Exception:
                pass

        for r in _read_dbf_safe(daten_path, "USER"):
            if r.get("ID") is None:
                continue
            digest = r.get("DIGEST")
            if isinstance(digest, str):
                digest = digest.encode("latin-1")
            session.add(User(
                id=r["ID"], position=r.get("POSITION", 0) or 0,
                name=str(r.get("NAME") or "").strip(),
                descrip=str(r.get("DESCRIP") or "").strip(),
                admin=bool(r.get("ADMIN")),
                rights=r.get("RIGHTS", 0) or 0,
                digest=digest if isinstance(digest, bytes) else None,
                bcrypt_hash=bcrypt_hashes.get(str(r["ID"])),
                hide=bool(r.get("HIDE")),
                wduties=bool(r.get("WDUTIES")),
                wabsences=bool(r.get("WABSENCES")),
                wovertimes=bool(r.get("WOVERTIMES")),
                wnotes=bool(r.get("WNOTES")),
                wdeviation=bool(r.get("WDEVIATION")),
                wcycleass=bool(r.get("WCYCLEASS")),
                wpast=bool(r.get("WPAST")),
                waccemwnd=bool(r.get("WACCEMWND")),
                waccgrwnd=bool(r.get("WACCGRWND")),
                backup=bool(r.get("BACKUP")),
                accadmwnd=bool(r.get("ACCADMWND")),
            ))
            count += 1
        _log.info("  users: %d", count)

        # ── Notes ──
        count = 0
        for r in _read_dbf_safe(daten_path, "NOTE"):
            if not r.get("ID"):
                continue
            session.add(Note(
                id=r["ID"], employee_id=r.get("EMPLOYEEID", 0),
                date=str(r.get("DATE") or "").strip(),
                text1=str(r.get("TEXT1") or "").strip(),
                text2=str(r.get("TEXT2") or "").strip(),
                category=str(r.get("RESERVED") or "").strip(),
            ))
            count += 1
        _log.info("  notes: %d", count)

        # ── Bookings ──
        count = 0
        for r in _read_dbf_safe(daten_path, "BOOK"):
            if not r.get("ID"):
                continue
            session.add(Booking(
                id=r["ID"], employee_id=r.get("EMPLOYEEID", 0),
                date=str(r.get("DATE") or "").strip(),
                booking_type=r.get("TYPE", 0) or 0,
                value=float(r.get("VALUE", 0) or 0),
                note=str(r.get("NOTE") or "").strip(),
            ))
            count += 1
        _log.info("  bookings: %d", count)

        # ── Overtime Records ──
        count = 0
        for r in _read_dbf_safe(daten_path, "OVER"):
            if not r.get("ID"):
                continue
            session.add(OvertimeRecord(
                id=r["ID"], employee_id=r.get("EMPLOYEEID", 0),
                date=str(r.get("DATE") or "").strip(),
                hours=float(r.get("HOURS", 0) or 0),
            ))
            count += 1
        _log.info("  overtime_records: %d", count)

        # ── Cycles ──
        count = 0
        for r in _read_dbf_safe(daten_path, "CYCLE"):
            if not r.get("ID"):
                continue
            session.add(Cycle(
                id=r["ID"], name=str(r.get("NAME") or "").strip(),
                position=r.get("POSITION", 0) or 0,
                size=r.get("SIZE", 1) or 1, unit=r.get("UNIT", 1) or 1,
                hide=bool(r.get("HIDE")),
            ))
            count += 1
        _log.info("  cycles: %d", count)

        # ── Cycle Entries ──
        count = 0
        for r in _read_dbf_safe(daten_path, "CYENT"):
            if not r.get("ID"):
                continue
            session.add(CycleEntry(
                id=r["ID"], cycle_id=r.get("CYCLEEID", 0),
                index=r.get("INDEX", 0),
                shift_id=r.get("SHIFTID", 0) or 0,
                workplace_id=r.get("WORKPLACID", 0) or 0,
            ))
            count += 1
        _log.info("  cycle_entries: %d", count)

        # ── Cycle Assignments ──
        count = 0
        for r in _read_dbf_safe(daten_path, "CYASS"):
            if not r.get("ID"):
                continue
            session.add(CycleAssignment(
                id=r["ID"], employee_id=r.get("EMPLOYEEID", 0),
                cycle_id=r.get("CYCLEID", 0),
                start=str(r.get("START") or "").strip(),
                end=str(r.get("END") or "").strip(),
                entrance=str(r.get("ENTRANCE") or "").strip(),
            ))
            count += 1
        _log.info("  cycle_assignments: %d", count)

        # ── Leave Entitlements ──
        count = 0
        for r in _read_dbf_safe(daten_path, "LEAEN"):
            if not r.get("ID"):
                continue
            session.add(LeaveEntitlement(
                id=r["ID"], employee_id=r.get("EMPLOYEEID", 0),
                year=r.get("YEAR", 0), leave_type_id=r.get("LEAVETYPID", 0) or 0,
                entitlement=float(r.get("ENTITLEMNT", 0) or 0),
                carry_forward=float(r.get("REST", 0) or 0),
                in_days=bool(r.get("INDAYS", 1)),
            ))
            count += 1
        _log.info("  leave_entitlements: %d", count)

        # ── Restrictions ──
        count = 0
        for r in _read_dbf_safe(daten_path, "RESTR"):
            if not r.get("ID"):
                continue
            session.add(Restriction(
                id=r["ID"], employee_id=r.get("EMPLOYEEID", 0),
                shift_id=r.get("SHIFTID", 0),
                weekday=r.get("WEEKDAY", 0) or 0,
                restrict=r.get("RESTRICT", 1) or 1,
                reason=str(r.get("RESERVED") or "").strip(),
            ))
            count += 1
        _log.info("  restrictions: %d", count)

        # ── Holiday Bans ──
        count = 0
        for r in _read_dbf_safe(daten_path, "HOBAN"):
            if not r.get("ID"):
                continue
            session.add(HolidayBan(
                id=r["ID"], group_id=r.get("GROUPID", 0) or 0,
                start_date=str(r.get("START") or "").strip(),
                end_date=str(r.get("END") or "").strip(),
                restrict=r.get("RESTRICT", 1) or 1,
                description=str(r.get("DESCRIPT") or "").strip(),
            ))
            count += 1
        _log.info("  holiday_bans: %d", count)

        # ── Extra Charges ──
        count = 0
        for r in _read_dbf_safe(daten_path, "XCHAR"):
            if not r.get("ID"):
                continue
            session.add(ExtraCharge(
                id=r["ID"], name=str(r.get("NAME") or "").strip(),
                position=r.get("POSITION", 0) or 0,
                start=r.get("START", 0) or 0, end=r.get("END", 0) or 0,
                validity=r.get("VALIDITY", 0) or 0,
                validdays=str(r.get("VALIDDAYS") or "").strip(),
                holrule=r.get("HOLRULE", 0) or 0,
                hide=bool(r.get("HIDE")),
            ))
            count += 1
        _log.info("  extra_charges: %d", count)

        # ── Settings (USETT) ──
        rows = _read_dbf_safe(daten_path, "USETT")
        if rows:
            r = rows[0]
            session.add(Settings(
                id=0, login=r.get("LOGIN", 0) or 0,
                spshcat=r.get("SPSHCAT", 0) or 0,
                overtcat=r.get("OVERTCAT", 0) or 0,
                anoaname=str(r.get("ANOANAME") or "Abwesend").strip(),
                anoashort=str(r.get("ANOASHORT") or "X").strip(),
            ))
            _log.info("  settings: 1")

        session.commit()

        # Reset sequences to max ID + 1
        _log.info("Resetting PostgreSQL sequences...")
        tables_with_seq = [
            ("employees", "id"), ("groups", "id"), ("group_assignments", "id"),
            ("shifts", "id"), ("leave_types", "id"), ("workplaces", "id"),
            ("holidays", "id"), ("schedule_entries", "id"), ("special_shifts", "id"),
            ("absences", "id"), ("users", "id"), ("cycles", "id"),
            ("cycle_entries", "id"), ("cycle_assignments", "id"),
            ("notes", "id"), ("bookings", "id"), ("overtime_records", "id"),
            ("leave_entitlements", "id"), ("restrictions", "id"),
            ("holiday_bans", "id"), ("extra_charges", "id"),
            ("periods", "id"), ("staffing_requirements", "id"),
        ]
        for table_name, col in tables_with_seq:
            try:
                session.execute(text(
                    f"SELECT setval(pg_get_serial_sequence('{table_name}', '{col}'), "
                    f"COALESCE((SELECT MAX({col}) FROM {table_name}), 0) + 1, false)"
                ))
            except Exception as e:
                _log.debug("Sequence reset for %s failed (may not exist): %s", table_name, e)
                session.rollback()

        session.commit()
        _log.info("Migration complete!")


if __name__ == "__main__":
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL not set")
        print("Usage: DATABASE_URL=postgresql://user:pass@host:5432/sp5 SP5_DB_PATH=/path/to/Daten python -m scripts.seed_postgresql")
        sys.exit(1)

    daten_path = os.environ.get("SP5_DB_PATH")
    if not daten_path:
        daten_path = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "sp5_db", "Daten"))

    if not os.path.isdir(daten_path):
        print(f"ERROR: DBF directory not found: {daten_path}")
        sys.exit(1)

    seed(database_url, daten_path)
