"""The FastAPI application.

``create_app(db_path)`` returns an application that serves one database
directory. Records are returned as stored: field names as in the tables,
dates as ISO strings, colours as integers (see ``docs/format.md``).

Settings (arguments of :func:`create_app` or environment variables):

  SP5_DB_PATH    directory with the 5*.DBF files
  SP5_API_TOKEN  if set, every request must send ``Authorization: Bearer <token>``
  SP5_READONLY   ``0`` enables the write endpoints (default: read only)
"""

import hmac
import os
from datetime import date
from typing import Annotated, Any

from fastapi import Body, Depends, FastAPI, HTTPException, Query, Request

from sp5lib import __version__ as lib_version
from sp5lib.database import SP5Database
from sp5lib.dbf_reader import read_header
from sp5lib.schema import TABLES, table_schema

from . import __version__

Record = dict[str, Any]

#: Tables the write endpoints do not touch: accounts and the database identity.
PROTECTED_TABLES = frozenset({"5USER", "5BUILD"})

Day = Annotated[date | None, Query(description="ISO date")]
Hidden = Annotated[bool, Query(description="include records marked as hidden")]
Employee = Annotated[int | None, Query(description="only this employee")]


def _plain(value: Any) -> Any:
    if isinstance(value, bytes):
        return value.hex()
    if isinstance(value, list):
        return [_plain(v) for v in value]
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    return value


def _parse_key(key: str) -> int | tuple[int, ...]:
    try:
        parts = tuple(int(p) for p in key.split(","))
    except ValueError:
        raise HTTPException(422, "key must be an ID or comma-separated IDs") from None
    return parts[0] if len(parts) == 1 else parts


def create_app(
    db_path: str | None = None, token: str | None = None, readonly: bool | None = None
) -> FastAPI:
    db_path = db_path or os.environ.get("SP5_DB_PATH")
    if not db_path:
        raise RuntimeError("SP5_DB_PATH is not set")
    token = token if token is not None else os.environ.get("SP5_API_TOKEN") or None
    if readonly is None:
        readonly = os.environ.get("SP5_READONLY", "1") != "0"
    db = SP5Database(db_path)

    def check_token(request: Request) -> None:
        if token is None:
            return
        sent = request.headers.get("Authorization", "")
        if not hmac.compare_digest(sent.encode(), f"Bearer {token}".encode()):
            raise HTTPException(401, "missing or wrong token", {"WWW-Authenticate": "Bearer"})

    def table_name(table: str) -> str:
        try:
            return table_schema(table).name
        except KeyError:
            raise HTTPException(404, f"unknown table {table}") from None

    def writable(table: str) -> str:
        if readonly:
            raise HTTPException(403, "the API is read only")
        name = table_name(table)
        if name in PROTECTED_TABLES or name not in TABLES:
            raise HTTPException(403, f"{name} cannot be written through the API")
        return name

    app = FastAPI(
        title="OpenSchichtplaner5 API",
        version=__version__,
        description="Read (and optionally write) a Schichtplaner 5 database.",
        dependencies=[Depends(check_token)],
    )

    @app.get("/api/health")
    def health() -> Record:
        return {
            "status": "ok",
            "version": __version__,
            "sp5lib": lib_version,
            "tables": len(db.tables()),
            "readonly": readonly,
        }

    # --- generic table access ---

    @app.get("/api/tables")
    def tables() -> list[Record]:
        result = []
        for name in db.tables():
            header = read_header(db.table_path(name))
            result.append(
                {
                    "name": name,
                    "records": len(db.read(name)),
                    "last_update": header.last_update,
                    "key": list(table_schema(name).key_fields),
                    "fields": db.fields(name),
                }
            )
        return result

    @app.get("/api/tables/{table}")
    def table_records(table: str) -> list[Record]:
        name = table_name(table)
        if name == "5USER":
            return db.get_users()
        return _plain(db.journal(name[:-2]) if name.endswith("-L") else db.read(name))

    @app.get("/api/tables/{table}/{key}")
    def table_record(table: str, key: str) -> Record:
        name = table_name(table)
        record = db.get(name, _parse_key(key)) if name in TABLES else None
        if record is None:
            raise HTTPException(404, f"no record {key} in {name}")
        record.pop("DIGEST", None)
        return _plain(record)

    @app.post("/api/tables/{table}", status_code=201)
    def insert_record(table: str, record: Annotated[Record, Body()]) -> Record:
        name = writable(table)
        try:
            new_id = db.insert(name, record)
        except (KeyError, ValueError) as exc:
            raise HTTPException(422, str(exc.args[0])) from None
        key = [new_id] + [record.get(f, 0) for f in table_schema(name).key_fields[1:]]
        return {"ID": new_id, "key": ",".join(str(k) for k in key)}

    @app.put("/api/tables/{table}/{key}")
    def update_record(table: str, key: str, changes: Annotated[Record, Body()]) -> Record:
        name = writable(table)
        parsed = _parse_key(key)
        if db.get(name, parsed) is None:
            raise HTTPException(404, f"no record {key} in {name}")
        try:
            db.update(name, parsed, changes)
        except (KeyError, ValueError) as exc:
            raise HTTPException(422, str(exc.args[0])) from None
        return _plain(db.get(name, parsed))

    @app.delete("/api/tables/{table}/{key}", status_code=204)
    def delete_record(table: str, key: str) -> None:
        name = writable(table)
        try:
            db.delete(name, _parse_key(key))
        except KeyError:
            raise HTTPException(404, f"no record {key} in {name}") from None

    # --- master data ---

    @app.get("/api/employees")
    def employees(include_hidden: Hidden = False, group_id: int | None = None) -> list[Record]:
        rows = db.get_employees(include_hidden)
        if group_id is not None:
            members = set(db.get_group_members(group_id))
            rows = [r for r in rows if r["ID"] in members]
        return rows

    @app.get("/api/employees/{employee_id}")
    def employee(employee_id: int) -> Record:
        record = db.get("EMPL", employee_id)
        if record is None:
            raise HTTPException(404, f"no employee {employee_id}")
        return record | {"groups": db.get_employee_groups(employee_id)}

    @app.get("/api/groups")
    def groups(include_hidden: Hidden = False) -> list[Record]:
        return [
            g | {"members": db.get_group_members(g["ID"])} for g in db.get_groups(include_hidden)
        ]

    @app.get("/api/shifts")
    def shifts(include_hidden: Hidden = False) -> list[Record]:
        return db.get_shifts(include_hidden)

    @app.get("/api/leave-types")
    def leave_types(include_hidden: Hidden = False) -> list[Record]:
        return db.get_leave_types(include_hidden)

    @app.get("/api/workplaces")
    def workplaces(include_hidden: Hidden = False) -> list[Record]:
        return db.get_workplaces(include_hidden)

    @app.get("/api/extracharges")
    def extracharges(include_hidden: Hidden = False) -> list[Record]:
        return db.get_extracharges(include_hidden)

    @app.get("/api/holidays")
    def holidays(year: int | None = None) -> list[Record]:
        return db.get_holidays(year)

    @app.get("/api/cycles")
    def cycles(include_hidden: Hidden = False) -> list[Record]:
        return db.get_cycles(include_hidden)

    @app.get("/api/cycle-assignments")
    def cycle_assignments(employee_id: Employee = None) -> list[Record]:
        return db.get_cycle_assignments(employee_id)

    @app.get("/api/users")
    def users() -> list[Record]:
        return db.get_users()

    @app.get("/api/settings")
    def settings() -> Record:
        record = db.get_settings()
        if record is None:
            raise HTTPException(404, "the database has no settings record")
        return record

    # --- dated data ---

    @app.get("/api/duties")
    def duties(start: Day = None, end: Day = None, employee_id: Employee = None) -> list[Record]:
        return db.get_duties(start, end, employee_id)

    @app.get("/api/special-shifts")
    def special_shifts(
        start: Day = None, end: Day = None, employee_id: Employee = None
    ) -> list[Record]:
        return db.get_special_shifts(start, end, employee_id)

    @app.get("/api/absences")
    def absences(start: Day = None, end: Day = None, employee_id: Employee = None) -> list[Record]:
        return db.get_absences(start, end, employee_id)

    @app.get("/api/notes")
    def notes(start: Day = None, end: Day = None, employee_id: Employee = None) -> list[Record]:
        return db.get_notes(start, end, employee_id)

    @app.get("/api/overtimes")
    def overtimes(start: Day = None, end: Day = None, employee_id: Employee = None) -> list[Record]:
        return db.get_overtimes(start, end, employee_id)

    @app.get("/api/bookings")
    def bookings(start: Day = None, end: Day = None, employee_id: Employee = None) -> list[Record]:
        return db.get_bookings(start, end, employee_id)

    @app.get("/api/periods")
    def periods(start: Day = None, end: Day = None) -> list[Record]:
        return db.get_periods(start, end)

    @app.get("/api/schedule")
    def schedule(
        start: date,
        end: date,
        employee_id: Employee = None,
        include_cycles: Annotated[
            bool, Query(description="add the duties that follow from shift cycles")
        ] = False,
    ) -> list[Record]:
        if end < start:
            raise HTTPException(422, "end is before start")
        entries = db.get_schedule(start, end, employee_id)
        if include_cycles:
            derived = [
                {"kind": "cycle_duty", **r}
                for r in db.get_cycle_duties(start, end)
                if employee_id is None or r.get("EMPLOYEEID") == employee_id
            ]
            entries = sorted(entries + derived, key=lambda r: (r["DATE"], r["EMPLOYEEID"]))
        return entries

    return app
