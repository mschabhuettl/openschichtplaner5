"""Access to a Schichtplaner 5 database directory.

:class:`SP5Database` reads the tables as lists of dicts, offers accessors
for the common questions (employees, groups, shifts, the plan of a period)
and writes records by ID.
"""

import os
from collections.abc import Iterable
from datetime import date
from typing import Any

from . import calculations
from .dbf_reader import Record, _dedupe_names, get_table_fields, read_dbf
from .dbf_writer import (
    append_record,
    compact_database,
    delete_record,
    find_all_records,
    update_record,
)
from .schema import JOURNAL_SUFFIX, TABLES, Table, table_schema

__all__ = ["SP5Database"]

DateLike = date | str | None
Key = int | tuple[int, ...]


def _iso(value: DateLike) -> str | None:
    if value is None:
        return None
    return value.isoformat() if isinstance(value, date) else str(value)[:10]


def _in_range(value: str | None, start: str | None, end: str | None) -> bool:
    if value is None:
        return start is None and end is None
    return (start is None or value >= start) and (end is None or value <= end)


def _sorted(records: Iterable[Record], *keys: str) -> list[Record]:
    return sorted(records, key=lambda r: tuple(r.get(k) or 0 for k in keys))


class SP5Database:
    """A Schichtplaner 5 database: a directory with the ``5*.DBF`` tables.

    Table names are accepted with or without the leading ``5`` and in any
    case (``EMPL``, ``5empl``). Records are dicts keyed by field name: dates
    are ISO strings or ``None``, N fields ``int``, F fields ``float``, text
    ``str``. The second ``START`` field of 5DADEM is called ``START2``.
    """

    def __init__(self, path: str | os.PathLike[str]) -> None:
        self.path = os.fspath(path)
        if not os.path.isdir(self.path):
            raise FileNotFoundError(f"not a directory: {self.path}")

    # --- tables ---

    def table_path(self, table: str) -> str:
        """Path of the ``.DBF`` file of a table (existing file names win,
        whatever their case)."""
        name = table_schema(table).name + ".DBF"
        for candidate in (name, name.lower()):
            if os.path.exists(os.path.join(self.path, candidate)):
                return os.path.join(self.path, candidate)
        return os.path.join(self.path, name)

    def tables(self) -> list[str]:
        """Names of the SP5 tables present in the directory."""
        return [name for name in TABLES if os.path.exists(self.table_path(name))]

    def schema(self, table: str) -> Table:
        """The expected layout of a table."""
        return table_schema(table)

    def fields(self, table: str) -> list[dict[str, Any]]:
        """Field descriptors as found in the file."""
        return get_table_fields(self.table_path(table))

    def read(self, table: str) -> list[Record]:
        """All records of a table that are not deleted, in file order."""
        return read_dbf(self.table_path(table))

    def journal(self, table: str) -> list[Record]:
        """The change journal of a table."""
        return read_dbf(self.table_path(table_schema(table).name + JOURNAL_SUFFIX))

    def _find(self, table: str, key: Key) -> list[tuple[int, Record]]:
        values = (key,) if isinstance(key, int) else tuple(key)
        names = table_schema(table).key_fields
        if len(values) > len(names):
            raise KeyError(f"{table_schema(table).name} is keyed by {names}")
        return find_all_records(
            self.table_path(table), None, **dict(zip(names, values, strict=False))
        )

    def get(self, table: str, key: Key) -> Record | None:
        """The record with the given key, or ``None``.

        The key is the ``ID`` for the master data tables. Tables that belong
        to an employee, group, user or cycle number their records per owner;
        there the key is the tuple named by ``schema(table).key_fields``,
        for example ``(ID, EMPLOYEEID)`` for 5MASHI.
        """
        found = self._find(table, key)
        return found[0][1] if len(found) == 1 else None

    # --- master data ---

    def _master(self, table: str, include_hidden: bool) -> list[Record]:
        rows = self.read(table)
        if not include_hidden:
            rows = [r for r in rows if not r.get("HIDE")]
        return _sorted(rows, "POSITION", "ID")

    def get_employees(self, include_hidden: bool = False) -> list[Record]:
        """Employees (5EMPL) in display order."""
        return self._master("EMPL", include_hidden)

    def get_groups(self, include_hidden: bool = False) -> list[Record]:
        """Groups (5GROUP) in display order; ``SUPERID`` is the parent group."""
        return self._master("GROUP", include_hidden)

    def get_group_members(self, group_id: int) -> list[int]:
        """IDs of the employees assigned to a group (5GRASG)."""
        return [r["EMPLOYEEID"] for r in self.read("GRASG") if r["GROUPID"] == group_id]

    def get_employee_groups(self, employee_id: int) -> list[int]:
        """IDs of the groups an employee is assigned to."""
        return [r["GROUPID"] for r in self.read("GRASG") if r["EMPLOYEEID"] == employee_id]

    def get_shifts(self, include_hidden: bool = False) -> list[Record]:
        """Shift types (5SHIFT) in display order."""
        return self._master("SHIFT", include_hidden)

    def get_leave_types(self, include_hidden: bool = False) -> list[Record]:
        """Absence types (5LEAVT) in display order."""
        return self._master("LEAVT", include_hidden)

    def get_workplaces(self, include_hidden: bool = False) -> list[Record]:
        """Workplaces (5WOPL) in display order."""
        return self._master("WOPL", include_hidden)

    def get_extracharges(self, include_hidden: bool = False) -> list[Record]:
        """Time surcharge rules (5XCHAR) in display order."""
        return self._master("XCHAR", include_hidden)

    def get_holidays(self, year: int | None = None) -> list[Record]:
        """Holidays (5HOLID) by date, optionally of one year."""
        rows = [r for r in self.read("HOLID") if r.get("DATE")]
        if year is not None:
            rows = [r for r in rows if r["DATE"].startswith(f"{year:04d}-")]
        return sorted(rows, key=lambda r: r["DATE"])

    def get_cycles(self, include_hidden: bool = False) -> list[Record]:
        """Shift cycles (5CYCLE), each with its entries (5CYENT) under ``entries``."""
        entries = self.read("CYENT")
        cycles = self._master("CYCLE", include_hidden)
        for cycle in cycles:
            cycle["entries"] = _sorted(
                (e for e in entries if e["CYCLEEID"] == cycle["ID"]), "INDEX"
            )
        return cycles

    def get_users(self) -> list[Record]:
        """Users (5USER) without the password digest."""
        users = _sorted(self.read("USER"), "POSITION", "ID")
        for user in users:
            user.pop("DIGEST", None)
        return users

    def get_settings(self) -> Record | None:
        """The global settings record (5USETT)."""
        rows = self.read("USETT")
        return rows[0] if rows else None

    # --- dated data ---

    def _dated(
        self,
        table: str,
        start: DateLike,
        end: DateLike,
        employee_id: int | None,
        field: str = "DATE",
    ) -> list[Record]:
        lo, hi = _iso(start), _iso(end)
        rows = [
            r
            for r in self.read(table)
            if _in_range(r.get(field), lo, hi)
            and (employee_id is None or r.get("EMPLOYEEID") == employee_id)
        ]
        return sorted(rows, key=lambda r: (r.get(field) or "", r.get("EMPLOYEEID") or 0, r["ID"]))

    def get_duties(
        self, start: DateLike = None, end: DateLike = None, employee_id: int | None = None
    ) -> list[Record]:
        """Duties (5MASHI): a shift of an employee on a day."""
        return self._dated("MASHI", start, end, employee_id)

    def get_special_shifts(
        self, start: DateLike = None, end: DateLike = None, employee_id: int | None = None
    ) -> list[Record]:
        """Special shifts (5SPSHI): duties with their own name and times."""
        return self._dated("SPSHI", start, end, employee_id)

    def get_absences(
        self, start: DateLike = None, end: DateLike = None, employee_id: int | None = None
    ) -> list[Record]:
        """Absences (5ABSEN), one record per employee and day."""
        return self._dated("ABSEN", start, end, employee_id)

    def get_notes(
        self, start: DateLike = None, end: DateLike = None, employee_id: int | None = None
    ) -> list[Record]:
        """Notes (5NOTE); ``EMPLOYEEID`` 0 is a note for the day as a whole."""
        return self._dated("NOTE", start, end, employee_id)

    def get_overtimes(
        self, start: DateLike = None, end: DateLike = None, employee_id: int | None = None
    ) -> list[Record]:
        """Overtime entries (5OVER)."""
        return self._dated("OVER", start, end, employee_id)

    def get_bookings(
        self, start: DateLike = None, end: DateLike = None, employee_id: int | None = None
    ) -> list[Record]:
        """Account bookings (5BOOK)."""
        return self._dated("BOOK", start, end, employee_id)

    def get_periods(self, start: DateLike = None, end: DateLike = None) -> list[Record]:
        """Marked periods (5PERIO) overlapping the given range."""
        lo, hi = _iso(start), _iso(end)
        rows = [
            r
            for r in self.read("PERIO")
            if (hi is None or (r.get("START") or "") <= hi)
            and (lo is None or (r.get("END") or "9999") >= lo)
        ]
        return sorted(rows, key=lambda r: (r.get("START") or "", r["ID"]))

    def get_cycle_assignments(self, employee_id: int | None = None) -> list[Record]:
        """Assignments of employees to shift cycles (5CYASS)."""
        rows = self.read("CYASS")
        if employee_id is not None:
            rows = [r for r in rows if r["EMPLOYEEID"] == employee_id]
        return sorted(rows, key=lambda r: (r["EMPLOYEEID"], r.get("START") or "", r["ID"]))

    def get_cycle_duties(self, start: date, end: date) -> list[Record]:
        """Duties that follow from the cycle assignments in a period.

        These are not stored in the database; SP5 derives them from 5CYASS,
        5CYCLE, 5CYENT and 5CYEXC. See
        :func:`sp5lib.calculations.expand_cycle_assignments`.
        """
        return calculations.expand_cycle_assignments(
            self.read("CYASS"),
            cycles=self.read("CYCLE"),
            cycle_entries=self.read("CYENT"),
            cycle_exceptions=self.read("CYEXC"),
            von=start,
            bis=end,
        )

    def get_schedule(
        self, start: DateLike, end: DateLike, employee_id: int | None = None
    ) -> list[Record]:
        """Everything entered for a period, ordered by date and employee.

        Each entry is the stored record plus ``kind``: ``duty`` (5MASHI),
        ``special_shift`` (5SPSHI), ``absence`` (5ABSEN) or ``note`` (5NOTE).
        Duties derived from shift cycles are not included, see
        :meth:`get_cycle_duties`.
        """
        entries: list[Record] = []
        for kind, getter in (
            ("duty", self.get_duties),
            ("special_shift", self.get_special_shifts),
            ("absence", self.get_absences),
            ("note", self.get_notes),
        ):
            entries += [{"kind": kind, **r} for r in getter(start, end, employee_id)]
        return sorted(entries, key=lambda r: (r["DATE"], r["EMPLOYEEID"]))

    # --- writing ---

    def insert(self, table: str, record: Record) -> int:
        """Add a record and return its new ``ID``.

        Fields not given are written as SP5 writes empty values (0, empty
        text, no date). The ``ID`` is the next free number, counted per
        owner in the tables that are keyed by more than the ``ID``; an
        ``ID`` in *record* is ignored.
        """
        schema = table_schema(table)
        path = self.table_path(table)
        row = schema.new_record(record)
        append_record(
            path,
            get_table_fields(path),
            row,
            autoid_field="ID",
            autoid_within=schema.key_fields[1:],
        )
        return int(row["ID"])

    def _index_of(self, table: str, key: Key) -> int:
        found = self._find(table, key)
        if len(found) != 1:
            problem = "no record" if not found else "more than one record"
            raise KeyError(f"{table_schema(table).name} has {problem} with key {key}")
        return found[0][0]

    def update(self, table: str, key: Key, changes: Record) -> None:
        """Change fields of the record with the given key (see :meth:`get`).

        The key fields themselves cannot be changed.
        """
        path = self.table_path(table)
        fields = get_table_fields(path)
        allowed = set(_dedupe_names([f["name"] for f in fields]))
        allowed -= set(table_schema(table).key_fields)
        refused = set(changes) - allowed
        if refused:
            raise KeyError(f"cannot set field {sorted(refused)[0]}")
        update_record(path, fields, self._index_of(table, key), changes)

    def delete(self, table: str, key: Key) -> None:
        """Mark the record with the given key as deleted."""
        path = self.table_path(table)
        delete_record(path, get_table_fields(path), self._index_of(table, key))

    def compact(self) -> int:
        """Remove all deleted records for good and empty the journals, like
        "compress database" in SP5. Returns the number of records removed."""
        return compact_database(self.path)
