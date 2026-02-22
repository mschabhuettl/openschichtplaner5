"""FastAPI application for OpenSchichtplaner5."""
import os
import sys

# Add parent dir to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from sp5lib.database import SP5Database

# ── Config ─────────────────────────────────────────────────────
DB_PATH = os.environ.get(
    'SP5_DB_PATH',
    os.path.join(os.path.dirname(__file__), '..', '..', '..', 'sp5_db', 'Daten')
)
DB_PATH = os.path.normpath(DB_PATH)

app = FastAPI(
    title="OpenSchichtplaner5 API",
    description="Open-source REST API for Schichtplaner5 databases",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db() -> SP5Database:
    return SP5Database(DB_PATH)


# ── Routes ─────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"service": "OpenSchichtplaner5 API", "version": "0.1.0", "backend": "dbf", "db_path": DB_PATH}


@app.get("/api/stats")
def get_stats():
    return get_db().get_stats()


# ── Dashboard Summary ────────────────────────────────────────

@app.get("/api/dashboard/summary")
def get_dashboard_summary(
    year: int = Query(..., description="Year (YYYY)"),
    month: int = Query(..., description="Month (1-12)"),
):
    """Return all KPIs needed for the Dashboard in one request."""
    import calendar as _cal
    from datetime import date, timedelta, datetime as _dt
    from collections import defaultdict
    from sp5lib.color_utils import bgr_to_hex

    if not (1 <= month <= 12):
        raise HTTPException(status_code=400, detail="Month must be 1-12")

    db = get_db()
    today = date.today()
    today_str = today.isoformat()
    prefix = f"{year:04d}-{month:02d}"

    # ── Month label ───────────────────────────────────────────
    month_names_de = [
        "Januar", "Februar", "März", "April", "Mai", "Juni",
        "Juli", "August", "September", "Oktober", "November", "Dezember",
    ]
    month_label = f"{month_names_de[month - 1]} {year}"

    # ── Employees ─────────────────────────────────────────────
    employees = db.get_employees(include_hidden=False)
    total_employees = len(employees)

    # ── Groups ───────────────────────────────────────────────
    groups = db.get_groups()

    # ── Shifts today ─────────────────────────────────────────
    today_entries = db.get_schedule_day(today_str)
    shifts_today_count = sum(
        1 for e in today_entries if e["kind"] in ("shift", "special_shift")
    )
    # Group by shift short name
    shift_groups: dict = defaultdict(lambda: {"count": 0, "color": "#6B7280"})
    for e in today_entries:
        if e["kind"] in ("shift", "special_shift"):
            key = e.get("display_name") or e.get("shift_short") or "?"
            shift_groups[key]["count"] += 1
            shift_groups[key]["color"] = e.get("color_bk", "#6B7280")

    by_shift = [
        {"name": k, "count": v["count"], "color": v["color"]}
        for k, v in shift_groups.items()
    ]
    by_shift.sort(key=lambda x: -x["count"])

    # ── Shifts + absences this month ─────────────────────────
    mashi_count = sum(
        1 for r in db._read("MASHI") if r.get("DATE", "").startswith(prefix)
    )
    spshi_count = sum(
        1 for r in db._read("SPSHI") if r.get("DATE", "").startswith(prefix)
    )
    total_shifts_scheduled = mashi_count + spshi_count

    # Count working days for coverage %
    num_days = _cal.monthrange(year, month)[1]
    working_days = sum(
        1 for d in range(1, num_days + 1)
        if _dt(year, month, d).weekday() < 5
    )
    max_possible = total_employees * working_days if working_days > 0 else 1
    coverage_pct = (
        round((total_shifts_scheduled / max_possible) * 100)
        if max_possible > 0 else 0
    )

    # ── Absences this month ───────────────────────────────────
    lt_map = {lt["ID"]: lt for lt in db.get_leave_types(include_hidden=True)}
    abs_by_type: dict = defaultdict(lambda: {"count": 0, "name": "", "color": "#6B7280"})
    total_absences_month = 0

    for r in db._read("ABSEN"):
        if r.get("DATE", "").startswith(prefix):
            total_absences_month += 1
            ltid = r.get("LEAVETYPID")
            lt = lt_map.get(ltid) if ltid else None
            key = lt.get("SHORTNAME") or lt.get("NAME", "?") if lt else "?"
            abs_by_type[key]["count"] += 1
            if lt:
                abs_by_type[key]["name"] = lt.get("NAME", key)
                abs_by_type[key]["color"] = bgr_to_hex(lt.get("COLORBK", 16777215))
            else:
                abs_by_type[key]["name"] = key

    absences_by_type_list = [
        {"short": k, "name": v["name"], "count": v["count"], "color": v["color"]}
        for k, v in abs_by_type.items()
    ]
    absences_by_type_list.sort(key=lambda x: -x["count"])

    # ── Zeitkonto alerts (employees with > 8h deficit this month) ─────────────
    try:
        stats = db.get_statistics(year, month)
        zeitkonto_alerts = []
        for s in stats:
            if s["overtime_hours"] < -8:
                zeitkonto_alerts.append({
                    "employee": s["employee_name"],
                    "employee_short": s["employee_short"],
                    "hours_diff": round(s["overtime_hours"], 1),
                })
        zeitkonto_alerts.sort(key=lambda x: x["hours_diff"])
        zeitkonto_alerts = zeitkonto_alerts[:10]
    except Exception:
        zeitkonto_alerts = []

    # ── Upcoming birthdays (next 14 days) ─────────────────────
    upcoming_birthdays = []
    for emp in employees:
        bday_raw = emp.get("BIRTHDAY")
        if not bday_raw or len(bday_raw) < 10:
            continue
        try:
            bday_month = int(bday_raw[5:7])
            bday_day = int(bday_raw[8:10])
            bday_this_year = date(today.year, bday_month, bday_day)
            if bday_this_year < today:
                bday_this_year = date(today.year + 1, bday_month, bday_day)
            days_until = (bday_this_year - today).days
            if 0 <= days_until <= 14:
                name = f"{emp.get('NAME', '')}, {emp.get('FIRSTNAME', '')}".strip(", ")
                upcoming_birthdays.append({
                    "name": name,
                    "date": bday_raw[5:],  # MM-DD
                    "days_until": days_until,
                })
        except (ValueError, IndexError):
            continue
    upcoming_birthdays.sort(key=lambda x: x["days_until"])

    # ── Staffing warnings (next 7 days vs SHDEM) ──────────────
    staffing_warnings = []
    try:
        staffing_req = db.get_staffing_requirements()
        shift_reqs = staffing_req.get("shift_requirements", [])

        if shift_reqs:
            for day_offset in range(7):
                check_date = today + timedelta(days=day_offset)
                check_str = check_date.isoformat()
                weekday = check_date.weekday()  # 0=Mon..6=Sun

                day_ents = db.get_schedule_day(check_str)
                actual_by_shift: dict = defaultdict(int)
                for e in day_ents:
                    if e["kind"] in ("shift", "special_shift") and e.get("shift_id"):
                        actual_by_shift[e["shift_id"]] += 1

                for req in shift_reqs:
                    if req.get("weekday") != weekday:
                        continue
                    min_req = req.get("min", 0) or 0
                    if min_req == 0:
                        continue
                    shift_id = req.get("shift_id")
                    actual = actual_by_shift.get(shift_id, 0)
                    if actual < min_req:
                        staffing_warnings.append({
                            "date": check_str,
                            "shift": req.get("shift_short") or req.get("shift_name", "?"),
                            "shift_name": req.get("shift_name", "?"),
                            "actual": actual,
                            "required": min_req,
                            "color": req.get("color_bk", "#EF4444"),
                        })
        staffing_warnings.sort(key=lambda x: x["date"])
    except Exception:
        pass

    return {
        "employees": {"total": total_employees, "active": total_employees},
        "shifts_today": {"count": shifts_today_count, "by_shift": by_shift},
        "shifts_this_month": {
            "scheduled": total_shifts_scheduled,
            "absent": total_absences_month,
            "coverage_pct": coverage_pct,
        },
        "absences_this_month": {
            "total": total_absences_month,
            "by_type": absences_by_type_list,
        },
        "zeitkonto_alerts": zeitkonto_alerts,
        "upcoming_birthdays": upcoming_birthdays,
        "staffing_warnings": staffing_warnings,
        "groups": len(groups),
        "month_label": month_label,
    }


@app.get("/api/employees")
def get_employees(include_hidden: bool = False):
    return get_db().get_employees(include_hidden=include_hidden)


@app.get("/api/employees/{emp_id}")
def get_employee(emp_id: int):
    e = get_db().get_employee(emp_id)
    if e is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    return e


@app.get("/api/groups")
def get_groups(include_hidden: bool = False):
    db = get_db()
    groups = db.get_groups(include_hidden=include_hidden)
    for g in groups:
        g['member_count'] = len(db.get_group_members(g['ID']))
    return groups


@app.get("/api/groups/{group_id}/members")
def get_group_members(group_id: int):
    db = get_db()
    member_ids = db.get_group_members(group_id)
    employees = db.get_employees(include_hidden=True)
    emp_map = {e['ID']: e for e in employees}
    return [emp_map[mid] for mid in member_ids if mid in emp_map]


@app.get("/api/shifts")
def get_shifts(include_hidden: bool = False):
    return get_db().get_shifts(include_hidden=include_hidden)


@app.get("/api/leave-types")
def get_leave_types(include_hidden: bool = False):
    return get_db().get_leave_types(include_hidden=include_hidden)


@app.get("/api/workplaces")
def get_workplaces(include_hidden: bool = False):
    return get_db().get_workplaces(include_hidden=include_hidden)


@app.get("/api/holidays")
def get_holidays(year: Optional[int] = None):
    return get_db().get_holidays(year=year)


@app.get("/api/schedule")
def get_schedule(
    year: int = Query(..., description="Year"),
    month: int = Query(..., description="Month (1-12)"),
    group_id: Optional[int] = Query(None, description="Filter by group ID")
):
    if not (1 <= month <= 12):
        raise HTTPException(status_code=400, detail="Month must be 1-12")
    return get_db().get_schedule(year=year, month=month, group_id=group_id)


@app.get("/api/users")
def get_users():
    return get_db().get_users()


# ── User Management (CRUD) ───────────────────────────────────

class UserCreate(BaseModel):
    NAME: str
    DESCRIP: Optional[str] = ''
    PASSWORD: str
    role: str = 'Leser'   # Admin | Planer | Leser


class UserUpdate(BaseModel):
    NAME: Optional[str] = None
    DESCRIP: Optional[str] = None
    PASSWORD: Optional[str] = None
    role: Optional[str] = None   # Admin | Planer | Leser


class LoginBody(BaseModel):
    username: str
    password: str


@app.post("/api/users")
def create_user(body: UserCreate):
    if body.role not in ('Admin', 'Planer', 'Leser'):
        raise HTTPException(status_code=400, detail="role must be Admin, Planer, or Leser")
    try:
        result = get_db().create_user(body.model_dump())
        return {"ok": True, "record": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/users/{user_id}")
def update_user(user_id: int, body: UserUpdate):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    if 'role' in data and data['role'] not in ('Admin', 'Planer', 'Leser'):
        raise HTTPException(status_code=400, detail="role must be Admin, Planer, or Leser")
    try:
        result = get_db().update_user(user_id, data)
        return {"ok": True, "record": result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/users/{user_id}")
def delete_user(user_id: int):
    try:
        count = get_db().delete_user(user_id)
        if count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        return {"ok": True, "hidden": count}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ChangePasswordBody(BaseModel):
    new_password: str


@app.post("/api/users/{user_id}/change-password")
def change_user_password(user_id: int, body: ChangePasswordBody):
    if not body.new_password or len(body.new_password.strip()) < 1:
        raise HTTPException(status_code=400, detail="Passwort darf nicht leer sein")
    try:
        ok = get_db().change_password(user_id, body.new_password)
        if not ok:
            raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/auth/login")
def login(body: LoginBody):
    """Simple login: verify username+password against 5USER.DBF."""
    import secrets
    user = get_db().verify_user_password(body.username, body.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Ungültiger Benutzername oder Passwort")
    # Generate a simple session token (not persisted — stateless for simplicity)
    token = secrets.token_hex(32)
    return {
        "ok": True,
        "token": token,
        "user": user,
    }


@app.get("/api/cycles")
def get_cycles():
    return get_db().get_cycles()


# ── Staffing requirements ────────────────────────────────────
@app.get("/api/staffing")
def get_staffing(
    year: int = Query(...),
    month: int = Query(...),
):
    return get_db().get_staffing(year, month)


# ── Day schedule ─────────────────────────────────────────────
@app.get("/api/schedule/day")
def get_schedule_day(
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    group_id: Optional[int] = Query(None),
):
    try:
        from datetime import datetime
        datetime.strptime(date, '%Y-%m-%d')
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")
    return get_db().get_schedule_day(date, group_id=group_id)


# ── Week schedule ────────────────────────────────────────────
@app.get("/api/schedule/week")
def get_schedule_week(
    date: str = Query(..., description="Any date within the target week (YYYY-MM-DD)"),
    group_id: Optional[int] = Query(None),
):
    try:
        from datetime import datetime
        datetime.strptime(date, '%Y-%m-%d')
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")
    return get_db().get_schedule_week(date, group_id=group_id)


# ── Monthly statistics ───────────────────────────────────────
@app.get("/api/statistics")
def get_statistics(
    year: int = Query(...),
    month: int = Query(...),
    group_id: Optional[int] = Query(None),
):
    if not (1 <= month <= 12):
        raise HTTPException(status_code=400, detail="Month must be 1-12")
    return get_db().get_statistics(year, month, group_id=group_id)


# ── Year overview ────────────────────────────────────────────
@app.get("/api/schedule/year")
def get_schedule_year(
    year: int = Query(...),
    employee_id: int = Query(...),
):
    return get_db().get_schedule_year(year, employee_id)


@app.get("/api/schedule/conflicts")
def get_schedule_conflicts(
    year: int = Query(..., description="Year (YYYY)"),
    month: int = Query(..., description="Month (1-12)"),
    group_id: Optional[int] = Query(None, description="Group ID filter"),
):
    """Return all scheduling conflicts for a given month."""
    if not (1 <= month <= 12):
        raise HTTPException(status_code=400, detail="Month must be 1-12")
    conflicts = get_db().get_schedule_conflicts(year, month, group_id)
    return {"conflicts": conflicts}


# ── Shift Cycles ─────────────────────────────────────────────

@app.get("/api/shift-cycles")
def get_shift_cycles():
    return get_db().get_shift_cycles()


@app.get("/api/shift-cycles/assign")
def get_cycle_assignments():
    return get_db().get_cycle_assignments()


@app.get("/api/shift-cycles/{cycle_id}")
def get_shift_cycle(cycle_id: int):
    c = get_db().get_shift_cycle(cycle_id)
    if c is None:
        raise HTTPException(status_code=404, detail="Cycle not found")
    return c


class CycleAssignBody(BaseModel):
    employee_id: int
    cycle_id: int
    start_date: str


@app.post("/api/shift-cycles/assign")
def assign_cycle(body: CycleAssignBody):
    try:
        from datetime import datetime
        datetime.strptime(body.start_date, '%Y-%m-%d')
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")
    try:
        result = get_db().assign_cycle(body.employee_id, body.cycle_id, body.start_date)
        return {"ok": True, "record": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/shift-cycles/assign/{employee_id}")
def remove_cycle_assignment(employee_id: int):
    try:
        count = get_db().remove_cycle_assignment(employee_id)
        return {"ok": True, "removed": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Shift Cycle CRUD ──────────────────────────────────────────

class ShiftCycleCreateBody(BaseModel):
    name: str
    size_weeks: int


class CycleEntryItem(BaseModel):
    index: int
    shift_id: Optional[int] = None


class ShiftCycleUpdateBody(BaseModel):
    name: str
    size_weeks: int
    entries: List[CycleEntryItem] = []


@app.post("/api/shift-cycles")
def create_shift_cycle(body: ShiftCycleCreateBody):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Name darf nicht leer sein")
    if body.size_weeks < 1 or body.size_weeks > 52:
        raise HTTPException(status_code=400, detail="Anzahl Wochen muss zwischen 1 und 52 liegen")
    try:
        result = get_db().create_shift_cycle(body.name.strip(), body.size_weeks)
        return {"ok": True, "cycle": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/shift-cycles/{cycle_id}")
def update_shift_cycle(cycle_id: int, body: ShiftCycleUpdateBody):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Name darf nicht leer sein")
    if body.size_weeks < 1 or body.size_weeks > 52:
        raise HTTPException(status_code=400, detail="Anzahl Wochen muss zwischen 1 und 52 liegen")
    db = get_db()
    try:
        db.update_shift_cycle(cycle_id, body.name.strip(), body.size_weeks)
        # Replace all entries: clear old ones, write new ones
        db.clear_cycle_entries(cycle_id)
        for entry in body.entries:
            if entry.shift_id:
                db.set_cycle_entry(cycle_id, entry.index, entry.shift_id)
        cycle = db.get_shift_cycle(cycle_id)
        return {"ok": True, "cycle": cycle}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/shift-cycles/{cycle_id}")
def delete_shift_cycle(cycle_id: int):
    try:
        count = get_db().delete_shift_cycle(cycle_id)
        if count == 0:
            raise HTTPException(status_code=404, detail="Zyklus nicht gefunden")
        return {"ok": True, "deleted": cycle_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Staffing Requirements ─────────────────────────────────────

@app.get("/api/staffing-requirements")
def get_staffing_requirements(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    group_id: Optional[int] = Query(None, description="Filter by group ID"),
):
    data = get_db().get_staffing_requirements(year=year, month=month)
    if group_id is not None:
        data['shift_requirements'] = [
            r for r in data['shift_requirements']
            if r.get('group_id') is None or r.get('group_id') == group_id
        ]
    return data


# ── Notes ─────────────────────────────────────────────────────

@app.get("/api/notes")
def get_notes(
    date: Optional[str] = Query(None, description="Filter by date YYYY-MM-DD"),
    employee_id: Optional[int] = Query(None),
    year: Optional[int] = Query(None, description="Filter by year (use with month)"),
    month: Optional[int] = Query(None, description="Filter by month 1-12 (use with year)"),
):
    if year is not None and month is not None:
        import calendar as _cal
        last_day = _cal.monthrange(year, month)[1]
        date_from = f"{year:04d}-{month:02d}-01"
        date_to = f"{year:04d}-{month:02d}-{last_day:02d}"
        all_notes = get_db().get_notes(date=None, employee_id=employee_id)
        return [n for n in all_notes if date_from <= (n.get('date') or '') <= date_to]
    return get_db().get_notes(date=date, employee_id=employee_id)


class NoteCreate(BaseModel):
    date: str
    text: str
    employee_id: Optional[int] = 0
    text2: Optional[str] = ''


@app.post("/api/notes")
def add_note(body: NoteCreate):
    try:
        from datetime import datetime
        datetime.strptime(body.date, '%Y-%m-%d')
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")
    try:
        result = get_db().add_note(
            date=body.date,
            text=body.text,
            employee_id=body.employee_id or 0,
            text2=body.text2 or '',
        )
        return {"ok": True, "record": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class NoteUpdate(BaseModel):
    text: Optional[str] = None
    text2: Optional[str] = None
    employee_id: Optional[int] = None
    date: Optional[str] = None


@app.put("/api/notes/{note_id}")
def update_note(note_id: int, body: NoteUpdate):
    if body.date is not None:
        try:
            from datetime import datetime as _dt
            _dt.strptime(body.date, '%Y-%m-%d')
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")
    try:
        result = get_db().update_note(
            note_id=note_id,
            text1=body.text,
            text2=body.text2,
            employee_id=body.employee_id,
            date=body.date,
        )
        if result is None:
            raise HTTPException(status_code=404, detail="Note not found")
        return {"ok": True, "record": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/notes/{note_id}")
def delete_note(note_id: int):
    try:
        count = get_db().delete_note(note_id)
        return {"ok": True, "deleted": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Periods ───────────────────────────────────────────────────

@app.get("/api/periods")
def get_periods(
    group_id: Optional[int] = Query(None),
):
    return get_db().get_periods(group_id=group_id)


class PeriodCreate(BaseModel):
    group_id: int
    start: str  # YYYY-MM-DD
    end: str    # YYYY-MM-DD
    description: str = ''


@app.post("/api/periods")
def create_period(body: PeriodCreate):
    try:
        from datetime import datetime
        datetime.strptime(body.start, '%Y-%m-%d')
        datetime.strptime(body.end, '%Y-%m-%d')
    except ValueError:
        raise HTTPException(status_code=400, detail="Ungültiges Datumsformat, erwartet YYYY-MM-DD")
    if body.end < body.start:
        raise HTTPException(status_code=400, detail="end muss >= start sein")
    try:
        result = get_db().create_period({
            'group_id': body.group_id,
            'start': body.start,
            'end': body.end,
            'description': body.description,
        })
        return {"ok": True, "record": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/periods/{period_id}")
def delete_period(period_id: int):
    try:
        count = get_db().delete_period(period_id)
        return {"ok": True, "deleted": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Staffing Requirements Write ──────────────────────────────

class StaffingRequirementSet(BaseModel):
    shift_id: int
    weekday: int
    min: int
    max: int
    group_id: int


@app.post("/api/staffing-requirements")
def set_staffing_requirement(body: StaffingRequirementSet):
    if not (0 <= body.weekday <= 6):
        raise HTTPException(status_code=400, detail="weekday muss zwischen 0 (Mo) und 6 (So) liegen")
    if body.min < 0:
        raise HTTPException(status_code=400, detail="min darf nicht negativ sein")
    if body.max < body.min:
        raise HTTPException(status_code=400, detail="max muss >= min sein")
    try:
        result = get_db().set_staffing_requirement(
            shift_id=body.shift_id,
            weekday=body.weekday,
            min_staff=body.min,
            max_staff=body.max,
            group_id=body.group_id,
        )
        return {"ok": True, "record": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Write: schedule entry ────────────────────────────────────
class ScheduleEntryCreate(BaseModel):
    employee_id: int
    date: str
    shift_id: int


@app.post("/api/schedule")
def create_schedule_entry(body: ScheduleEntryCreate):
    try:
        from datetime import datetime
        datetime.strptime(body.date, '%Y-%m-%d')
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")
    try:
        result = get_db().add_schedule_entry(body.employee_id, body.date, body.shift_id)
        return {"ok": True, "record": result}
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/schedule/{employee_id}/{date}")
def delete_schedule_entry(employee_id: int, date: str):
    try:
        from datetime import datetime
        datetime.strptime(date, '%Y-%m-%d')
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")
    try:
        count = get_db().delete_schedule_entry(employee_id, date)
        return {"ok": True, "deleted": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Generate schedule from cycle ────────────────────────────
class ScheduleGenerateRequest(BaseModel):
    year: int
    month: int
    employee_ids: Optional[List[int]] = None
    force: bool = False


@app.post("/api/schedule/generate")
def generate_schedule(body: ScheduleGenerateRequest):
    """Generate schedule entries for a month based on cycle assignments."""
    if not (1 <= body.month <= 12):
        raise HTTPException(status_code=400, detail="Month must be 1-12")
    try:
        result = get_db().generate_schedule_from_cycle(
            year=body.year,
            month=body.month,
            employee_ids=body.employee_ids,
            force=body.force,
        )
        created = result['created']
        skipped = result['skipped']
        errors = result.get('errors', [])
        message = f"{created} Einträge erstellt, {skipped} übersprungen"
        if errors:
            message += f", {len(errors)} Fehler"
        return {
            'created': created,
            'skipped': skipped,
            'errors': errors,
            'message': message,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Write: absence ───────────────────────────────────────────
class AbsenceCreate(BaseModel):
    employee_id: int
    date: str
    leave_type_id: int


@app.get("/api/absences")
def list_absences(
    year: Optional[int] = Query(None),
    employee_id: Optional[int] = Query(None),
    leave_type_id: Optional[int] = Query(None),
):
    """List all absences with optional filters."""
    return get_db().get_absences_list(year=year, employee_id=employee_id, leave_type_id=leave_type_id)


@app.get("/api/group-assignments")
def get_all_group_assignments():
    """Return all group assignments (employee_id, group_id pairs)."""
    return get_db().get_all_group_assignments()


@app.post("/api/absences")
def create_absence(body: AbsenceCreate):
    try:
        from datetime import datetime
        datetime.strptime(body.date, '%Y-%m-%d')
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")
    try:
        result = get_db().add_absence(body.employee_id, body.date, body.leave_type_id)
        return {"ok": True, "record": result}
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Write: Employees ─────────────────────────────────────────

class EmployeeCreate(BaseModel):
    NAME: str
    FIRSTNAME: str = ''
    SHORTNAME: str = ''
    NUMBER: str = ''
    SEX: int = 0
    HRSDAY: float = 0.0
    HRSWEEK: float = 0.0
    HRSMONTH: float = 0.0
    HRSTOTAL: float = 0.0
    WORKDAYS: str = '1 1 1 1 1 0 0 0'
    HIDE: bool = False
    BOLD: int = 0
    # Personal data
    SALUTATION: str = ''
    STREET: str = ''
    ZIP: str = ''
    TOWN: str = ''
    PHONE: str = ''
    EMAIL: str = ''
    FUNCTION: str = ''
    BIRTHDAY: str = ''
    EMPSTART: str = ''
    EMPEND: str = ''
    # Calculation settings
    CALCBASE: int = 0
    DEDUCTHOL: int = 0
    # Free text fields
    NOTE1: str = ''
    NOTE2: str = ''
    NOTE3: str = ''
    NOTE4: str = ''
    ARBITR1: str = ''
    ARBITR2: str = ''
    ARBITR3: str = ''
    # Colors (BGR int: 0=black, 16777215=white)
    CFGLABEL: Optional[int] = None
    CBKLABEL: Optional[int] = None
    CBKSCHED: Optional[int] = None


class EmployeeUpdate(BaseModel):
    NAME: Optional[str] = None
    FIRSTNAME: Optional[str] = None
    SHORTNAME: Optional[str] = None
    NUMBER: Optional[str] = None
    SEX: Optional[int] = None
    HRSDAY: Optional[float] = None
    HRSWEEK: Optional[float] = None
    HRSMONTH: Optional[float] = None
    HRSTOTAL: Optional[float] = None
    WORKDAYS: Optional[str] = None
    HIDE: Optional[bool] = None
    BOLD: Optional[int] = None
    POSITION: Optional[int] = None
    # Personal data
    SALUTATION: Optional[str] = None
    STREET: Optional[str] = None
    ZIP: Optional[str] = None
    TOWN: Optional[str] = None
    PHONE: Optional[str] = None
    EMAIL: Optional[str] = None
    FUNCTION: Optional[str] = None
    BIRTHDAY: Optional[str] = None
    EMPSTART: Optional[str] = None
    EMPEND: Optional[str] = None
    # Calculation settings
    CALCBASE: Optional[int] = None
    DEDUCTHOL: Optional[int] = None
    # Free text fields
    NOTE1: Optional[str] = None
    NOTE2: Optional[str] = None
    NOTE3: Optional[str] = None
    NOTE4: Optional[str] = None
    ARBITR1: Optional[str] = None
    ARBITR2: Optional[str] = None
    ARBITR3: Optional[str] = None
    # Colors (BGR int)
    CFGLABEL: Optional[int] = None
    CBKLABEL: Optional[int] = None
    CBKSCHED: Optional[int] = None


@app.post("/api/employees")
def create_employee(body: EmployeeCreate):
    if not body.NAME or not body.NAME.strip():
        raise HTTPException(status_code=400, detail="NAME darf nicht leer sein")
    # Validate optional date fields
    for field_name, val in [('BIRTHDAY', body.BIRTHDAY), ('EMPSTART', body.EMPSTART), ('EMPEND', body.EMPEND)]:
        if val:
            try:
                from datetime import datetime as _dtt
                _dtt.strptime(val, '%Y-%m-%d')
            except ValueError:
                raise HTTPException(status_code=400, detail=f"{field_name} muss im Format YYYY-MM-DD sein")
    try:
        result = get_db().create_employee(body.model_dump())
        return {"ok": True, "record": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/employees/{emp_id}")
def update_employee(emp_id: int, body: EmployeeUpdate):
    try:
        data = {k: v for k, v in body.model_dump().items() if v is not None}
        result = get_db().update_employee(emp_id, data)
        return {"ok": True, "record": result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/employees/{emp_id}")
def delete_employee(emp_id: int):
    try:
        count = get_db().delete_employee(emp_id)
        return {"ok": True, "hidden": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Employee Photo Upload ─────────────────────────────────────

_PHOTOS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'uploads', 'photos')


@app.get("/api/employees/{emp_id}/photo")
async def get_employee_photo(emp_id: int):
    from fastapi.responses import FileResponse as _FileResponse
    import pathlib
    photos_dir = pathlib.Path(_PHOTOS_DIR)
    for ext in ('.jpg', '.jpeg', '.png', '.gif'):
        p = photos_dir / f"{emp_id}{ext}"
        if p.exists():
            return _FileResponse(str(p))
    raise HTTPException(status_code=404, detail="Kein Foto vorhanden")


# ── Write: Groups ─────────────────────────────────────────────

class GroupCreate(BaseModel):
    NAME: str
    SHORTNAME: str = ''
    SUPERID: int = 0
    HIDE: bool = False
    BOLD: int = 0
    DAILYDEM: int = 0
    ARBITR: str = ''
    CFGLABEL: Optional[int] = None
    CBKLABEL: Optional[int] = None
    CBKSCHED: Optional[int] = None


class GroupUpdate(BaseModel):
    NAME: Optional[str] = None
    SHORTNAME: Optional[str] = None
    SUPERID: Optional[int] = None
    POSITION: Optional[int] = None
    HIDE: Optional[bool] = None
    BOLD: Optional[int] = None
    DAILYDEM: Optional[int] = None
    ARBITR: Optional[str] = None
    CFGLABEL: Optional[int] = None
    CBKLABEL: Optional[int] = None
    CBKSCHED: Optional[int] = None


class GroupMemberBody(BaseModel):
    employee_id: int


@app.post("/api/groups")
def create_group(body: GroupCreate):
    if not body.NAME or not body.NAME.strip():
        raise HTTPException(status_code=400, detail="NAME darf nicht leer sein")
    try:
        result = get_db().create_group(body.model_dump())
        return {"ok": True, "record": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/groups/{group_id}")
def update_group(group_id: int, body: GroupUpdate):
    try:
        data = {k: v for k, v in body.model_dump().items() if v is not None}
        result = get_db().update_group(group_id, data)
        return {"ok": True, "record": result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/groups/{group_id}")
def delete_group(group_id: int):
    try:
        count = get_db().delete_group(group_id)
        return {"ok": True, "hidden": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/groups/{group_id}/members")
def add_group_member(group_id: int, body: GroupMemberBody):
    try:
        result = get_db().add_group_member(group_id, body.employee_id)
        return {"ok": True, "record": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/groups/{group_id}/members/{emp_id}")
def remove_group_member(group_id: int, emp_id: int):
    try:
        count = get_db().remove_group_member(group_id, emp_id)
        return {"ok": True, "removed": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Write: Shifts ─────────────────────────────────────────────

class ShiftCreate(BaseModel):
    NAME: str
    SHORTNAME: str = ''
    COLORBK: int = 16777215
    COLORTEXT: int = 0
    COLORBAR: int = 0
    DURATION0: float = 0.0
    DURATION1: Optional[float] = None
    DURATION2: Optional[float] = None
    DURATION3: Optional[float] = None
    DURATION4: Optional[float] = None
    DURATION5: Optional[float] = None
    DURATION6: Optional[float] = None
    DURATION7: Optional[float] = None
    STARTEND0: Optional[str] = None
    STARTEND1: Optional[str] = None
    STARTEND2: Optional[str] = None
    STARTEND3: Optional[str] = None
    STARTEND4: Optional[str] = None
    STARTEND5: Optional[str] = None
    STARTEND6: Optional[str] = None
    STARTEND7: Optional[str] = None
    HIDE: bool = False


class ShiftUpdate(BaseModel):
    NAME: Optional[str] = None
    SHORTNAME: Optional[str] = None
    COLORBK: Optional[int] = None
    COLORTEXT: Optional[int] = None
    COLORBAR: Optional[int] = None
    DURATION0: Optional[float] = None
    DURATION1: Optional[float] = None
    DURATION2: Optional[float] = None
    DURATION3: Optional[float] = None
    DURATION4: Optional[float] = None
    DURATION5: Optional[float] = None
    DURATION6: Optional[float] = None
    DURATION7: Optional[float] = None
    STARTEND0: Optional[str] = None
    STARTEND1: Optional[str] = None
    STARTEND2: Optional[str] = None
    STARTEND3: Optional[str] = None
    STARTEND4: Optional[str] = None
    STARTEND5: Optional[str] = None
    STARTEND6: Optional[str] = None
    STARTEND7: Optional[str] = None
    POSITION: Optional[int] = None
    HIDE: Optional[bool] = None


@app.post("/api/shifts")
def create_shift(body: ShiftCreate):
    if not body.NAME or not body.NAME.strip():
        raise HTTPException(status_code=400, detail="NAME darf nicht leer sein")
    try:
        result = get_db().create_shift(body.model_dump())
        return {"ok": True, "record": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/shifts/{shift_id}")
def update_shift(shift_id: int, body: ShiftUpdate):
    try:
        data = {k: v for k, v in body.model_dump().items() if v is not None}
        result = get_db().update_shift(shift_id, data)
        return {"ok": True, "record": result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/shifts/{shift_id}")
def hide_shift(shift_id: int):
    try:
        count = get_db().hide_shift(shift_id)
        return {"ok": True, "hidden": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Write: Leave Types ────────────────────────────────────────

class LeaveTypeCreate(BaseModel):
    NAME: str
    SHORTNAME: str = ''
    COLORBK: int = 16777215
    COLORTEXT: int = 0
    COLORBAR: int = 0
    ENTITLED: bool = False
    STDENTIT: float = 0.0
    HIDE: bool = False


class LeaveTypeUpdate(BaseModel):
    NAME: Optional[str] = None
    SHORTNAME: Optional[str] = None
    COLORBK: Optional[int] = None
    COLORTEXT: Optional[int] = None
    COLORBAR: Optional[int] = None
    ENTITLED: Optional[bool] = None
    STDENTIT: Optional[float] = None
    POSITION: Optional[int] = None
    HIDE: Optional[bool] = None


@app.post("/api/leave-types")
def create_leave_type(body: LeaveTypeCreate):
    if not body.NAME or not body.NAME.strip():
        raise HTTPException(status_code=400, detail="NAME darf nicht leer sein")
    try:
        result = get_db().create_leave_type(body.model_dump())
        return {"ok": True, "record": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/leave-types/{lt_id}")
def update_leave_type(lt_id: int, body: LeaveTypeUpdate):
    try:
        data = {k: v for k, v in body.model_dump().items() if v is not None}
        result = get_db().update_leave_type(lt_id, data)
        return {"ok": True, "record": result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/leave-types/{lt_id}")
def hide_leave_type(lt_id: int):
    try:
        count = get_db().hide_leave_type(lt_id)
        return {"ok": True, "hidden": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Write: Holidays ───────────────────────────────────────────

class HolidayCreate(BaseModel):
    DATE: str
    NAME: str
    INTERVAL: int = 0


class HolidayUpdate(BaseModel):
    DATE: Optional[str] = None
    NAME: Optional[str] = None
    INTERVAL: Optional[int] = None


@app.post("/api/holidays")
def create_holiday(body: HolidayCreate):
    if not body.NAME or not body.NAME.strip():
        raise HTTPException(status_code=400, detail="NAME darf nicht leer sein")
    try:
        from datetime import datetime as _dtt
        _dtt.strptime(body.DATE, '%Y-%m-%d')
    except ValueError:
        raise HTTPException(status_code=400, detail="DATE muss im Format YYYY-MM-DD sein")
    try:
        result = get_db().create_holiday(body.model_dump())
        return {"ok": True, "record": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/holidays/{holiday_id}")
def update_holiday(holiday_id: int, body: HolidayUpdate):
    try:
        data = {k: v for k, v in body.model_dump().items() if v is not None}
        result = get_db().update_holiday(holiday_id, data)
        return {"ok": True, "record": result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/holidays/{holiday_id}")
def delete_holiday(holiday_id: int):
    try:
        count = get_db().delete_holiday(holiday_id)
        return {"ok": True, "deleted": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Write: Workplaces ─────────────────────────────────────────

class WorkplaceCreate(BaseModel):
    NAME: str
    SHORTNAME: str = ''
    COLORBK: int = 16777215
    COLORTEXT: int = 0
    COLORBAR: int = 0
    HIDE: bool = False


class WorkplaceUpdate(BaseModel):
    NAME: Optional[str] = None
    SHORTNAME: Optional[str] = None
    COLORBK: Optional[int] = None
    COLORTEXT: Optional[int] = None
    COLORBAR: Optional[int] = None
    POSITION: Optional[int] = None
    HIDE: Optional[bool] = None


@app.post("/api/workplaces")
def create_workplace(body: WorkplaceCreate):
    if not body.NAME or not body.NAME.strip():
        raise HTTPException(status_code=400, detail="NAME darf nicht leer sein")
    try:
        result = get_db().create_workplace(body.model_dump())
        return {"ok": True, "record": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/workplaces/{wp_id}")
def update_workplace(wp_id: int, body: WorkplaceUpdate):
    try:
        data = {k: v for k, v in body.model_dump().items() if v is not None}
        result = get_db().update_workplace(wp_id, data)
        return {"ok": True, "record": result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/workplaces/{wp_id}")
def hide_workplace(wp_id: int):
    try:
        count = get_db().hide_workplace(wp_id)
        return {"ok": True, "hidden": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Workplace ↔ Employee Assignments ──────────────────────────

@app.get("/api/workplaces/{wp_id}/employees")
def get_workplace_employees(wp_id: int):
    """Return employees assigned to a workplace."""
    try:
        return get_db().get_workplace_employees(wp_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/workplaces/{wp_id}/employees/{employee_id}")
def assign_employee_to_workplace(wp_id: int, employee_id: int):
    """Assign an employee to a workplace."""
    try:
        added = get_db().assign_employee_to_workplace(employee_id, wp_id)
        return {"ok": True, "added": added}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/workplaces/{wp_id}/employees/{employee_id}")
def remove_employee_from_workplace(wp_id: int, employee_id: int):
    """Remove an employee from a workplace."""
    try:
        removed = get_db().remove_employee_from_workplace(employee_id, wp_id)
        return {"ok": True, "removed": removed}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Extra Charges (Zeitzuschläge) ─────────────────────────────

class ExtraChargeCreate(BaseModel):
    NAME: str
    START: int = 0      # minutes from midnight
    END: int = 0        # minutes from midnight
    VALIDDAYS: str = '0000000'  # 7 chars: 0=inactive, 1=active per weekday (Mon-Sun)
    HOLRULE: int = 0    # 0=no holiday rule, 1=holidays only, 2=not on holidays
    VALIDITY: int = 0
    HIDE: bool = False


class ExtraChargeUpdate(BaseModel):
    NAME: Optional[str] = None
    START: Optional[int] = None
    END: Optional[int] = None
    VALIDDAYS: Optional[str] = None
    HOLRULE: Optional[int] = None
    VALIDITY: Optional[int] = None
    POSITION: Optional[int] = None
    HIDE: Optional[bool] = None


@app.get("/api/extracharges")
def get_extracharges(include_hidden: bool = False):
    return get_db().get_extracharges(include_hidden=include_hidden)


@app.post("/api/extracharges")
def create_extracharge(body: ExtraChargeCreate):
    if not body.NAME or not body.NAME.strip():
        raise HTTPException(status_code=400, detail="NAME darf nicht leer sein")
    if len(body.VALIDDAYS) != 7 or not all(c in '01' for c in body.VALIDDAYS):
        raise HTTPException(status_code=400, detail="VALIDDAYS muss genau 7 Zeichen lang sein und nur '0' oder '1' enthalten (z.B. '1111100')")
    if body.START < 0 or body.START > 1440:
        raise HTTPException(status_code=400, detail="START muss zwischen 0 und 1440 Minuten liegen")
    if body.END < 0 or body.END > 1440:
        raise HTTPException(status_code=400, detail="END muss zwischen 0 und 1440 Minuten liegen")
    try:
        result = get_db().create_extracharge(body.model_dump())
        return {"ok": True, "record": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/extracharges/summary")
def get_extracharges_summary(
    year: int = Query(...),
    month: int = Query(...),
    employee_id: Optional[int] = Query(None),
):
    """Calculate surcharge hours per ExtraCharge rule for a given month."""
    try:
        result = get_db().calculate_extracharge_hours(year, month, employee_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/extracharges/{xc_id}")
def update_extracharge(xc_id: int, body: ExtraChargeUpdate):
    try:
        data = {k: v for k, v in body.model_dump().items() if v is not None}
        result = get_db().update_extracharge(xc_id, data)
        return {"ok": True, "record": result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/extracharges/{xc_id}")
def delete_extracharge(xc_id: int):
    try:
        count = get_db().delete_extracharge(xc_id)
        return {"ok": True, "hidden": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Leave Entitlements ────────────────────────────────────────

@app.get("/api/leave-entitlements")
def get_leave_entitlements(
    year: Optional[int] = Query(None),
    employee_id: Optional[int] = Query(None),
):
    return get_db().get_leave_entitlements(year=year, employee_id=employee_id)


class LeaveEntitlementCreate(BaseModel):
    employee_id: int
    year: int
    days: float
    carry_forward: Optional[float] = 0
    leave_type_id: Optional[int] = 0


@app.post("/api/leave-entitlements")
def set_leave_entitlement(body: LeaveEntitlementCreate):
    try:
        result = get_db().set_leave_entitlement(
            employee_id=body.employee_id,
            year=body.year,
            days=body.days,
            carry_forward=body.carry_forward or 0,
            leave_type_id=body.leave_type_id or 0,
        )
        return {"ok": True, "record": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/leave-balance")
def get_leave_balance(
    year: int = Query(...),
    employee_id: int = Query(...),
):
    return get_db().get_leave_balance(employee_id=employee_id, year=year)


@app.get("/api/leave-balance/group")
def get_leave_balance_group(
    year: int = Query(...),
    group_id: int = Query(...),
):
    return get_db().get_leave_balance_group(year=year, group_id=group_id)


# ── Holiday Bans ──────────────────────────────────────────────

@app.get("/api/holiday-bans")
def get_holiday_bans(
    group_id: Optional[int] = Query(None),
):
    return get_db().get_holiday_bans(group_id=group_id)


class HolidayBanCreate(BaseModel):
    group_id: int
    start_date: str
    end_date: str
    reason: Optional[str] = ''


@app.post("/api/holiday-bans")
def create_holiday_ban(body: HolidayBanCreate):
    try:
        from datetime import datetime
        datetime.strptime(body.start_date, '%Y-%m-%d')
        datetime.strptime(body.end_date, '%Y-%m-%d')
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")
    if body.end_date < body.start_date:
        raise HTTPException(status_code=400, detail="end_date must be >= start_date")
    try:
        result = get_db().create_holiday_ban(
            group_id=body.group_id,
            start_date=body.start_date,
            end_date=body.end_date,
            reason=body.reason or '',
        )
        return {"ok": True, "record": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/holiday-bans/{ban_id}")
def delete_holiday_ban(ban_id: int):
    try:
        count = get_db().delete_holiday_ban(ban_id)
        return {"ok": True, "deleted": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Annual Close ──────────────────────────────────────────────

@app.get("/api/annual-close/preview")
def annual_close_preview(
    year: int = Query(...),
    group_id: Optional[int] = Query(None),
    max_carry_forward_days: float = Query(10),
):
    return get_db().get_annual_close_preview(
        year=year,
        group_id=group_id,
        carry_forward_days=max_carry_forward_days,
    )


class AnnualCloseBody(BaseModel):
    year: int
    group_id: Optional[int] = None
    max_carry_forward_days: Optional[float] = 10


@app.post("/api/annual-close")
def run_annual_close(body: AnnualCloseBody):
    try:
        result = get_db().run_annual_close(
            year=body.year,
            group_id=body.group_id,
            carry_forward_days=body.max_carry_forward_days or 10,
        )
        return {"ok": True, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Export endpoints ─────────────────────────────────────────

import io
import csv
import calendar as _calendar
from datetime import datetime as _dt
from fastapi.responses import Response as _Response


def _int_to_rgb(color_int: int) -> str:
    """Convert BGR int to #RRGGBB hex."""
    b = (color_int >> 16) & 0xFF
    g = (color_int >> 8) & 0xFF
    r = color_int & 0xFF
    return f"#{r:02X}{g:02X}{b:02X}"


def _csv_response(rows: list, filename: str) -> _Response:
    buf = io.StringIO()
    if rows:
        writer = csv.DictWriter(buf, fieldnames=rows[0].keys(), lineterminator='\r\n')
        writer.writeheader()
        writer.writerows(rows)
    content = buf.getvalue()
    return _Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/export/schedule")
def export_schedule(
    month: str = Query(..., description="Month in YYYY-MM format"),
    group_id: Optional[int] = Query(None),
    format: str = Query("csv", description="csv or html"),
):
    try:
        dt = _dt.strptime(month, "%Y-%m")
        year, mon = dt.year, dt.month
    except ValueError:
        raise HTTPException(status_code=400, detail="month must be YYYY-MM")

    db = get_db()
    entries = db.get_schedule(year=year, month=mon, group_id=group_id)
    employees = db.get_employees(include_hidden=False)
    if group_id is not None:
        member_ids = set(db.get_group_members(group_id))
        employees = [e for e in employees if e['ID'] in member_ids]
    employees.sort(key=lambda x: x.get('POSITION', 0))

    # Build lookup: (emp_id, date) -> entry
    entry_map: dict = {}
    for e in entries:
        key = (e['employee_id'], e['date'])
        entry_map[key] = e

    num_days = _calendar.monthrange(year, mon)[1]
    days = [f"{year:04d}-{mon:02d}-{d:02d}" for d in range(1, num_days + 1)]

    if format == "csv":
        rows = []
        for emp in employees:
            row: dict = {
                "Mitarbeiter": f"{emp.get('NAME', '')}, {emp.get('FIRSTNAME', '')}".strip(', '),
                "Kürzel": emp.get('SHORTNAME', ''),
            }
            for date in days:
                day_num = int(date.split('-')[2])
                e = entry_map.get((emp['ID'], date))
                row[str(day_num)] = e['display_name'] if e else ''
            rows.append(row)
        return _csv_response(rows, f"dienstplan_{month}.csv")
    else:
        # HTML export
        month_name = _dt(year, mon, 1).strftime("%B %Y")
        day_headers = ""
        for d in range(1, num_days + 1):
            wd = _dt(year, mon, d).weekday()
            wd_abbr = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"][wd]
            is_weekend = wd >= 5
            cls = "weekend" if is_weekend else ""
            day_headers += f'<th class="day-header {cls}">{d}<br><span style="font-weight:normal;font-size:9px">{wd_abbr}</span></th>'

        rows_html = ""
        for emp in employees:
            emp_name = f"{emp.get('NAME', '')}, {emp.get('FIRSTNAME', '')}".strip(', ')
            short = emp.get('SHORTNAME', '')
            rows_html += f'<tr><td class="emp-name">{emp_name}</td><td class="emp-short">{short}</td>'
            for date in days:
                wd = _dt(year, mon, int(date.split('-')[2])).weekday()
                is_weekend = wd >= 5
                e = entry_map.get((emp['ID'], date))
                if e:
                    bg = e.get('color_bk', '#4A90D9')
                    fg = e.get('color_text', '#FFFFFF')
                    display = e.get('display_name', '')
                    rows_html += f'<td class="day-cell" style="background:{bg};color:{fg}"><span title="{e.get("shift_name", e.get("leave_name", display))}">{display}</span></td>'
                else:
                    weekend_style = 'background:#f0f0f0;' if is_weekend else ''
                    rows_html += f'<td class="day-cell" style="{weekend_style}"></td>'
            rows_html += '</tr>\n'

        html = f"""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Dienstplan {month_name}</title>
<style>
  body {{ font-family: Arial, sans-serif; font-size: 11px; margin: 20px; }}
  h1 {{ font-size: 16px; margin-bottom: 8px; color: #1e293b; }}
  table {{ border-collapse: collapse; width: 100%; }}
  th, td {{ border: 1px solid #d1d5db; padding: 3px 4px; white-space: nowrap; }}
  th {{ background: #1e293b; color: white; text-align: center; font-size: 10px; }}
  .emp-name {{ background: #f8fafc; font-weight: bold; min-width: 120px; }}
  .emp-short {{ background: #f8fafc; text-align: center; min-width: 36px; color: #64748b; }}
  .day-header {{ min-width: 28px; }}
  .day-cell {{ text-align: center; font-size: 10px; font-weight: bold; }}
  .weekend {{ background: #475569 !important; }}
  @media print {{
    body {{ margin: 5mm; }}
    .no-print {{ display: none; }}
  }}
</style>
</head>
<body>
<h1>📅 Dienstplan — {month_name}</h1>
<p class="no-print" style="color:#64748b;font-size:11px">Gedruckt am {_dt.now().strftime("%d.%m.%Y %H:%M")}</p>
<table>
<thead>
<tr>
  <th style="text-align:left;min-width:130px">Mitarbeiter</th>
  <th style="min-width:36px">Kürzel</th>
  {day_headers}
</tr>
</thead>
<tbody>
{rows_html}
</tbody>
</table>
</body>
</html>"""
        return _Response(
            content=html,
            media_type="text/html; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="dienstplan_{month}.html"'},
        )


@app.get("/api/export/statistics")
def export_statistics(
    year: int = Query(...),
    group_id: Optional[int] = Query(None),
    format: str = Query("csv", description="csv or html"),
):
    db = get_db()
    rows_data = []
    for mon in range(1, 13):
        month_stats = db.get_statistics(year=year, month=mon, group_id=group_id)
        for s in month_stats:
            rows_data.append({
                "Monat": mon,
                "Mitarbeiter": s['employee_name'],
                "Kürzel": s['employee_short'],
                "Soll (h)": s['target_hours'],
                "Ist (h)": s['actual_hours'],
                "Überstunden (h)": s['overtime_hours'],
                "Abwesenheitstage": s['absence_days'],
                "Urlaubstage": s['vacation_used'],
            })

    # Also build a summary per employee (sum over year)
    from collections import defaultdict
    summary: dict = defaultdict(lambda: {
        "Mitarbeiter": "", "Kürzel": "",
        "Soll (h)": 0.0, "Ist (h)": 0.0, "Überstunden (h)": 0.0,
        "Abwesenheitstage": 0, "Urlaubstage": 0,
    })
    for r in rows_data:
        k = r["Mitarbeiter"]
        summary[k]["Mitarbeiter"] = r["Mitarbeiter"]
        summary[k]["Kürzel"] = r["Kürzel"]
        summary[k]["Soll (h)"] += r["Soll (h)"]
        summary[k]["Ist (h)"] += r["Ist (h)"]
        summary[k]["Überstunden (h)"] += r["Überstunden (h)"]
        summary[k]["Abwesenheitstage"] += r["Abwesenheitstage"]
        summary[k]["Urlaubstage"] += r["Urlaubstage"]

    if format == "csv":
        return _csv_response(rows_data, f"statistiken_{year}.csv")
    else:
        MONTHS_DE = ["", "Januar", "Februar", "März", "April", "Mai", "Juni",
                     "Juli", "August", "September", "Oktober", "November", "Dezember"]

        # Build summary table rows
        summary_rows = ""
        for s in summary.values():
            ot = s["Überstunden (h)"]
            ot_color = "#16a34a" if ot >= 0 else "#dc2626"
            summary_rows += (
                f'<tr>'
                f'<td class="name">{s["Mitarbeiter"]}</td>'
                f'<td class="center">{s["Kürzel"]}</td>'
                f'<td class="num">{s["Soll (h)"]:.1f}</td>'
                f'<td class="num">{s["Ist (h)"]:.1f}</td>'
                f'<td class="num" style="color:{ot_color};font-weight:bold">{"+" if ot>=0 else ""}{ot:.1f}</td>'
                f'<td class="num">{s["Abwesenheitstage"]}</td>'
                f'<td class="num">{s["Urlaubstage"]}</td>'
                f'</tr>\n'
            )

        # Build monthly detail rows
        detail_rows = ""
        for r in rows_data:
            ot = r["Überstunden (h)"]
            ot_color = "#16a34a" if ot >= 0 else "#dc2626"
            detail_rows += (
                f'<tr>'
                f'<td class="center">{MONTHS_DE[r["Monat"]]}</td>'
                f'<td class="name">{r["Mitarbeiter"]}</td>'
                f'<td class="center">{r["Kürzel"]}</td>'
                f'<td class="num">{r["Soll (h)"]:.1f}</td>'
                f'<td class="num">{r["Ist (h)"]:.1f}</td>'
                f'<td class="num" style="color:{ot_color};font-weight:bold">{"+" if ot>=0 else ""}{ot:.1f}</td>'
                f'<td class="num">{r["Abwesenheitstage"]}</td>'
                f'<td class="num">{r["Urlaubstage"]}</td>'
                f'</tr>\n'
            )

        html = f"""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Statistiken {year}</title>
<style>
  body {{ font-family: Arial, sans-serif; font-size: 11px; margin: 20px; }}
  h1 {{ font-size: 16px; color: #1e293b; margin-bottom: 4px; }}
  h2 {{ font-size: 13px; color: #334155; margin: 18px 0 6px; }}
  table {{ border-collapse: collapse; width: 100%; margin-bottom: 24px; }}
  th, td {{ border: 1px solid #d1d5db; padding: 4px 6px; }}
  th {{ background: #1e293b; color: white; text-align: center; }}
  .name {{ font-weight: bold; }}
  .center {{ text-align: center; }}
  .num {{ text-align: right; }}
  tr:nth-child(even) {{ background: #f8fafc; }}
  @media print {{ body {{ margin: 5mm; }} }}
</style>
</head>
<body>
<h1>📈 Statistiken — {year}</h1>
<p style="color:#64748b;font-size:11px">Erstellt am {_dt.now().strftime("%d.%m.%Y %H:%M")}</p>

<h2>Jahresübersicht (gesamt)</h2>
<table>
<thead>
<tr>
  <th style="text-align:left">Mitarbeiter</th>
  <th>Kürzel</th>
  <th>Soll (h)</th>
  <th>Ist (h)</th>
  <th>Überstunden</th>
  <th>Abwesenheiten</th>
  <th>Urlaub</th>
</tr>
</thead>
<tbody>
{summary_rows}
</tbody>
</table>

<h2>Monatsdetail</h2>
<table>
<thead>
<tr>
  <th>Monat</th>
  <th style="text-align:left">Mitarbeiter</th>
  <th>Kürzel</th>
  <th>Soll (h)</th>
  <th>Ist (h)</th>
  <th>Überstunden</th>
  <th>Abwesenheiten</th>
  <th>Urlaub</th>
</tr>
</thead>
<tbody>
{detail_rows}
</tbody>
</table>
</body>
</html>"""
        return _Response(
            content=html,
            media_type="text/html; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="statistiken_{year}.html"'},
        )


@app.get("/api/export/employees")
def export_employees(
    format: str = Query("csv"),
):
    db = get_db()
    employees = db.get_employees(include_hidden=False)
    rows = []
    for emp in employees:
        rows.append({
            "ID": emp.get('ID', ''),
            "Name": emp.get('NAME', ''),
            "Vorname": emp.get('FIRSTNAME', ''),
            "Kürzel": emp.get('SHORTNAME', ''),
            "Personalnummer": emp.get('NUMBER', ''),
            "Std/Tag": emp.get('HRSDAY', 0),
            "Std/Woche": emp.get('HRSWEEK', 0),
            "Std/Monat": emp.get('HRSMONTH', 0),
            "Arbeitstage": emp.get('WORKDAYS', ''),
        })
    if format == "html":
        headers_html = "".join(f"<th>{h}</th>" for h in rows[0].keys()) if rows else ""
        rows_html = ""
        for i, row in enumerate(rows):
            bg = "#f8fafc" if i % 2 == 0 else "#ffffff"
            rows_html += f'<tr style="background:{bg}">' + "".join(f"<td>{v}</td>" for v in row.values()) + "</tr>\n"
        html = f"""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Mitarbeiterliste</title>
<style>
  body {{ font-family: Arial, sans-serif; font-size: 11px; margin: 20px; }}
  h1 {{ font-size: 16px; margin-bottom: 12px; }}
  table {{ border-collapse: collapse; width: 100%; }}
  th {{ background: #1e293b; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; }}
  td {{ padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }}
  @media print {{ @page {{ size: A4 landscape; margin: 10mm; }} }}
</style>
</head>
<body>
<h1>Mitarbeiterliste</h1>
<table><thead><tr>{headers_html}</tr></thead><tbody>
{rows_html}
</tbody></table>
</body></html>"""
        return _Response(
            content=html,
            media_type="text/html; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="mitarbeiter.html"'},
        )
    return _csv_response(rows, "mitarbeiter.csv")


@app.get("/api/export/absences")
def export_absences(
    year: int = Query(...),
    group_id: Optional[int] = Query(None),
    format: str = Query("csv"),
):
    db = get_db()
    employees = db.get_employees(include_hidden=False)
    emp_map = {e['ID']: e for e in employees}
    lt_map = {lt['ID']: lt for lt in db.get_leave_types(include_hidden=True)}

    if group_id is not None:
        member_ids = set(db.get_group_members(group_id))
        emp_map = {k: v for k, v in emp_map.items() if k in member_ids}

    year_str = str(year)
    raw_absences = db._read('ABSEN')

    rows = []
    for r in raw_absences:
        d = r.get('DATE', '')
        if not (d and d.startswith(year_str)):
            continue
        eid = r.get('EMPLOYEEID')
        if eid not in emp_map:
            continue
        emp = emp_map[eid]
        ltid = r.get('LEAVETYPID')
        lt = lt_map.get(ltid) if ltid else None
        rows.append({
            "Datum": d,
            "Mitarbeiter": f"{emp.get('NAME', '')}, {emp.get('FIRSTNAME', '')}".strip(', '),
            "Kürzel": emp.get('SHORTNAME', ''),
            "Abwesenheitsart": lt.get('NAME', '') if lt else '',
            "Kürzel Art": lt.get('SHORTNAME', '') if lt else '',
        })

    rows.sort(key=lambda x: (x['Datum'], x['Mitarbeiter']))
    if format == "html":
        headers_html = "".join(f"<th>{h}</th>" for h in rows[0].keys()) if rows else ""
        rows_html = ""
        for i, row in enumerate(rows):
            bg = "#f8fafc" if i % 2 == 0 else "#ffffff"
            rows_html += f'<tr style="background:{bg}">' + "".join(f"<td>{v}</td>" for v in row.values()) + "</tr>\n"
        html = f"""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Abwesenheiten {year}</title>
<style>
  body {{ font-family: Arial, sans-serif; font-size: 11px; margin: 20px; }}
  h1 {{ font-size: 16px; margin-bottom: 12px; }}
  table {{ border-collapse: collapse; width: 100%; }}
  th {{ background: #1e293b; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; }}
  td {{ padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }}
  @media print {{ @page {{ size: A4 portrait; margin: 10mm; }} }}
</style>
</head>
<body>
<h1>Abwesenheiten {year}</h1>
<table><thead><tr>{headers_html}</tr></thead><tbody>
{rows_html}
</tbody></table>
</body></html>"""
        return _Response(
            content=html,
            media_type="text/html; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="abwesenheiten_{year}.html"'},
        )
    return _csv_response(rows, f"abwesenheiten_{year}.csv")


# ── Zeitkonto / Überstunden ──────────────────────────────────

@app.get("/api/zeitkonto")
def get_zeitkonto(
    year: int = Query(..., description="Year"),
    group_id: Optional[int] = Query(None, description="Filter by group ID"),
    employee_id: Optional[int] = Query(None, description="Filter by employee ID"),
):
    return get_db().get_zeitkonto(year=year, group_id=group_id, employee_id=employee_id)


@app.get("/api/zeitkonto/detail")
def get_zeitkonto_detail(
    year: int = Query(..., description="Year"),
    employee_id: int = Query(..., description="Employee ID"),
):
    db = get_db()
    result = db.calculate_time_balance(employee_id=employee_id, year=year)
    if not result:
        raise HTTPException(status_code=404, detail="Employee not found")
    return result


@app.get("/api/zeitkonto/summary")
def get_zeitkonto_summary(
    year: int = Query(..., description="Year"),
    group_id: Optional[int] = Query(None, description="Filter by group ID"),
):
    rows = get_db().get_zeitkonto(year=year, group_id=group_id)
    total_target = sum(r['total_target_hours'] for r in rows)
    total_actual = sum(r['total_actual_hours'] for r in rows)
    total_saldo = sum(r['total_saldo'] for r in rows)
    pos = sum(1 for r in rows if r['total_saldo'] >= 0)
    neg = len(rows) - pos
    return {
        'year': year,
        'group_id': group_id,
        'employee_count': len(rows),
        'total_target_hours': round(total_target, 2),
        'total_actual_hours': round(total_actual, 2),
        'total_saldo': round(total_saldo, 2),
        'positive_count': pos,
        'negative_count': neg,
    }


@app.get("/api/bookings")
def get_bookings(
    year: Optional[int] = Query(None, description="Filter by year"),
    month: Optional[int] = Query(None, description="Filter by month (1-12), use with year"),
    employee_id: Optional[int] = Query(None, description="Filter by employee ID"),
):
    return get_db().get_bookings(year=year, month=month, employee_id=employee_id)


class BookingCreate(BaseModel):
    employee_id: int
    date: str
    type: int = 0   # 0 = Iststundenkonto, 1 = Sollstundenkonto
    value: float
    note: Optional[str] = ''


@app.post("/api/bookings")
def create_booking(body: BookingCreate):
    try:
        from datetime import datetime
        datetime.strptime(body.date, '%Y-%m-%d')
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")
    if body.type not in (0, 1):
        raise HTTPException(status_code=400, detail="type must be 0 (Ist) or 1 (Soll)")
    try:
        result = get_db().create_booking(
            employee_id=body.employee_id,
            date_str=body.date,
            booking_type=body.type,
            value=body.value,
            note=body.note or '',
        )
        return {"ok": True, "record": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/bookings/{booking_id}")
def delete_booking(booking_id: int):
    try:
        count = get_db().delete_booking(booking_id)
        if count == 0:
            raise HTTPException(status_code=404, detail="Booking not found")
        return {"ok": True, "deleted": booking_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Carry Forward (Saldo-Übertrag) ────────────────────────────

@app.get("/api/bookings/carry-forward")
def get_carry_forward(employee_id: int = Query(...), year: int = Query(...)):
    try:
        return get_db().get_carry_forward(employee_id=employee_id, year=year)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class CarryForwardSet(BaseModel):
    employee_id: int
    year: int
    hours: float


@app.post("/api/bookings/carry-forward")
def set_carry_forward(body: CarryForwardSet):
    try:
        result = get_db().set_carry_forward(
            employee_id=body.employee_id,
            year=body.year,
            hours=body.hours,
        )
        return {"ok": True, "record": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class AnnualStatementBody(BaseModel):
    employee_id: int
    year: int


@app.post("/api/bookings/annual-statement")
def annual_statement(body: AnnualStatementBody):
    try:
        result = get_db().calculate_annual_statement(
            employee_id=body.employee_id,
            year=body.year,
        )
        return {"ok": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Restrictions ──────────────────────────────────────────────

@app.get("/api/restrictions")
def get_restrictions(employee_id: Optional[int] = Query(None)):
    """Return all shift restrictions, optionally filtered by employee_id."""
    return get_db().get_restrictions(employee_id=employee_id)


class RestrictionCreate(BaseModel):
    employee_id: int
    shift_id: int
    reason: Optional[str] = ''
    weekday: Optional[int] = 0


@app.post("/api/restrictions")
def set_restriction(body: RestrictionCreate):
    """Add a shift restriction for an employee."""
    weekday = body.weekday or 0
    if not (0 <= weekday <= 6):
        raise HTTPException(status_code=400, detail="weekday muss zwischen 0 (Mo) und 6 (So) liegen (0 = alle Wochentage)")
    try:
        result = get_db().set_restriction(
            employee_id=body.employee_id,
            shift_id=body.shift_id,
            reason=body.reason or '',
            weekday=weekday,
        )
        return {"ok": True, "record": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/restrictions/{employee_id}/{shift_id}")
def remove_restriction(
    employee_id: int,
    shift_id: int,
    weekday: int = Query(0),
):
    """Remove a shift restriction for an employee."""
    try:
        count = get_db().remove_restriction(
            employee_id=employee_id, shift_id=shift_id, weekday=weekday
        )
        return {"ok": True, "removed": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Settings (USETT) ─────────────────────────────────────────

@app.get("/api/settings")
def get_settings():
    """Return global settings from 5USETT.DBF."""
    try:
        return get_db().get_usett()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class SettingsUpdate(BaseModel):
    ANOANAME: Optional[str] = None
    ANOASHORT: Optional[str] = None
    ANOACRTXT: Optional[int] = None
    ANOACRBAR: Optional[int] = None
    ANOACRBK: Optional[int] = None
    ANOABOLD: Optional[int] = None
    BACKUPFR: Optional[int] = None


@app.put("/api/settings")
def update_settings(body: SettingsUpdate):
    """Update global settings in 5USETT.DBF."""
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    try:
        result = get_db().update_usett(data)
        return {"ok": True, "record": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Special Staffing Requirements (SPDEM) ────────────────────

@app.get("/api/staffing-requirements/special")
def get_special_staffing(
    date: Optional[str] = Query(None, description="Date filter YYYY-MM-DD"),
    group_id: Optional[int] = Query(None, description="Group ID filter"),
):
    """Return date-specific staffing requirements from 5SPDEM.DBF."""
    try:
        return get_db().get_special_staffing(date=date, group_id=group_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class SpecialStaffingCreate(BaseModel):
    group_id: int
    date: str
    shift_id: int
    workplace_id: int = 0
    min: int = 0
    max: int = 0


class SpecialStaffingUpdate(BaseModel):
    group_id: Optional[int] = None
    date: Optional[str] = None
    shift_id: Optional[int] = None
    workplace_id: Optional[int] = None
    min: Optional[int] = None
    max: Optional[int] = None


@app.post("/api/staffing-requirements/special")
def create_special_staffing(body: SpecialStaffingCreate):
    """Create a date-specific staffing requirement."""
    try:
        from datetime import datetime
        datetime.strptime(body.date, '%Y-%m-%d')
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")
    try:
        result = get_db().create_special_staffing(
            groupid=body.group_id,
            date=body.date,
            shiftid=body.shift_id,
            workplacid=body.workplace_id,
            min_staff=body.min,
            max_staff=body.max,
        )
        return {"ok": True, "record": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/staffing-requirements/special/{record_id}")
def update_special_staffing(record_id: int, body: SpecialStaffingUpdate):
    """Update a date-specific staffing requirement."""
    data = {k.upper(): v for k, v in body.model_dump().items() if v is not None}
    # Rename keys to match DBF field names
    rename = {'GROUP_ID': 'GROUPID', 'SHIFT_ID': 'SHIFTID', 'WORKPLACE_ID': 'WORKPLACID'}
    data = {rename.get(k, k): v for k, v in data.items()}
    try:
        result = get_db().update_special_staffing(record_id, data)
        return {"ok": True, "record": result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/staffing-requirements/special/{record_id}")
def delete_special_staffing(record_id: int):
    """Delete a date-specific staffing requirement."""
    try:
        count = get_db().delete_special_staffing(record_id)
        if count == 0:
            raise HTTPException(status_code=404, detail="Record not found")
        return {"ok": True, "deleted": count}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/overtime-records")
def get_overtime_records(
    year: Optional[int] = Query(None, description="Filter by year"),
    employee_id: Optional[int] = Query(None, description="Filter by employee ID"),
):
    return get_db().get_overtime_records(year=year, employee_id=employee_id)



# ── Import endpoints ─────────────────────────────────────────

from fastapi import UploadFile, File


@app.post("/api/employees/{emp_id}/photo")
async def upload_employee_photo(emp_id: int, file: UploadFile = File(...)):
    """Upload a photo for an employee (JPG/PNG/GIF)."""
    import pathlib
    photos_dir = pathlib.Path(_PHOTOS_DIR)
    photos_dir.mkdir(parents=True, exist_ok=True)

    db = get_db()
    emp = db.get_employee(emp_id)
    if not emp:
        raise HTTPException(status_code=404, detail=f"Mitarbeiter {emp_id} nicht gefunden")

    ct = (file.content_type or '').lower()
    allowed = ('image/jpeg', 'image/png', 'image/gif')
    if ct not in allowed:
        raise HTTPException(status_code=400, detail="Nur JPG, PNG oder GIF erlaubt")

    ext = '.jpg'
    if ct == 'image/png':
        ext = '.png'
    elif ct == 'image/gif':
        ext = '.gif'

    # Remove old photos for this employee
    for old in photos_dir.glob(f"{emp_id}.*"):
        try:
            old.unlink()
        except OSError:
            pass

    dest = photos_dir / f"{emp_id}{ext}"
    content = await file.read()
    dest.write_bytes(content)

    rel_path = f"uploads/photos/{emp_id}{ext}"
    try:
        db.update_employee(emp_id, {'PHOTO': rel_path})
    except Exception:
        pass  # best effort

    return {"ok": True, "photo_url": f"/api/employees/{emp_id}/photo", "path": rel_path}


def _decode_csv(content: bytes) -> str:
    """Try UTF-8 with BOM first, then latin-1."""
    try:
        return content.decode('utf-8-sig')
    except UnicodeDecodeError:
        return content.decode('latin-1')


@app.post("/api/import/employees")
async def import_employees(file: UploadFile = File(...)):
    """Import employees from CSV. Required columns: NAME or NACHNAME.
    Accepted column aliases: VORNAME/FIRSTNAME, NACHNAME/NAME, KURZZEICHEN/SHORTNAME,
    NUMBER/PERSONALNUMMER, HRSDAY, HRSWEEK, HRSMONTH, SEX."""
    content = await file.read()
    text = _decode_csv(content)
    reader = csv.DictReader(io.StringIO(text))

    imported = 0
    skipped = 0
    errors = []
    db = get_db()

    for i, row in enumerate(reader, start=2):  # row 1 = header
        # Normalize keys
        row = {k.strip().upper(): v.strip() for k, v in row.items() if k}

        # Alias mapping
        name = row.get('NAME') or row.get('NACHNAME') or ''
        firstname = row.get('FIRSTNAME') or row.get('VORNAME') or ''
        shortname = row.get('SHORTNAME') or row.get('KURZZEICHEN') or ''
        number = row.get('NUMBER') or row.get('PERSONALNUMMER') or ''

        if not name:
            errors.append(f"Zeile {i}: NAME/NACHNAME fehlt — übersprungen")
            skipped += 1
            continue

        try:
            data = {
                'NAME': name,
                'FIRSTNAME': firstname,
                'SHORTNAME': shortname,
                'NUMBER': number,
                'SEX': int(row.get('SEX') or 0),
                'HRSDAY': float(row.get('HRSDAY') or 0),
                'HRSWEEK': float(row.get('HRSWEEK') or 0),
                'HRSMONTH': float(row.get('HRSMONTH') or 0),
                'WORKDAYS': row.get('WORKDAYS') or '1 1 1 1 1 0 0 0',
                'HIDE': False,
            }
            db.create_employee(data)
            imported += 1
        except Exception as e:
            errors.append(f"Zeile {i} ({name}): {e}")

    return {"imported": imported, "errors": errors, "skipped": skipped}


@app.post("/api/import/shifts")
async def import_shifts(file: UploadFile = File(...)):
    """Import shifts from CSV. Required: NAME.
    Optional: KURZZEICHEN/SHORTNAME, FARBE/COLORBK (hex #RRGGBB or int BGR), DURATION0."""
    content = await file.read()
    text = _decode_csv(content)
    reader = csv.DictReader(io.StringIO(text))

    imported = 0
    skipped = 0
    errors = []
    db = get_db()

    def _parse_color(val: str) -> int:
        """Parse #RRGGBB hex to BGR int, or pass-through int."""
        if not val:
            return 16777215  # white
        val = val.strip()
        if val.startswith('#') and len(val) == 7:
            try:
                r = int(val[1:3], 16)
                g = int(val[3:5], 16)
                b = int(val[5:7], 16)
                return (b << 16) | (g << 8) | r
            except ValueError:
                return 16777215
        try:
            return int(val)
        except ValueError:
            return 16777215

    for i, row in enumerate(reader, start=2):
        row = {k.strip().upper(): v.strip() for k, v in row.items() if k}

        name = row.get('NAME') or ''
        if not name:
            errors.append(f"Zeile {i}: NAME fehlt — übersprungen")
            skipped += 1
            continue

        shortname = row.get('SHORTNAME') or row.get('KURZZEICHEN') or ''
        colorbk_raw = row.get('COLORBK') or row.get('FARBE') or row.get('HINTERGRUNDFARBE') or ''
        colortext_raw = row.get('COLORTEXT') or row.get('TEXTFARBE') or ''

        try:
            data = {
                'NAME': name,
                'SHORTNAME': shortname,
                'COLORBK': _parse_color(colorbk_raw),
                'COLORTEXT': _parse_color(colortext_raw) if colortext_raw else 0,
                'COLORBAR': 0,
                'DURATION0': float(row.get('DURATION0') or row.get('DAUER') or 0),
                'HIDE': False,
            }
            db.create_shift(data)
            imported += 1
        except Exception as e:
            errors.append(f"Zeile {i} ({name}): {e}")

    return {"imported": imported, "errors": errors, "skipped": skipped}


@app.post("/api/import/absences")
async def import_absences(file: UploadFile = File(...)):
    """Import absences from CSV. Required: EMPLOYEE_ID, DATE (YYYY-MM-DD), LEAVE_TYPE_ID."""
    content = await file.read()
    text = _decode_csv(content)
    reader = csv.DictReader(io.StringIO(text))

    imported = 0
    skipped = 0
    errors = []
    db = get_db()

    for i, row in enumerate(reader, start=2):
        row = {k.strip().upper(): v.strip() for k, v in row.items() if k}

        emp_id_raw = row.get('EMPLOYEE_ID') or row.get('MITARBEITER_ID') or ''
        date_raw = row.get('DATE') or row.get('DATUM') or ''
        lt_id_raw = row.get('LEAVE_TYPE_ID') or row.get('ABWESENHEITSART_ID') or ''

        if not emp_id_raw or not date_raw or not lt_id_raw:
            errors.append(f"Zeile {i}: Pflichtfelder fehlen (EMPLOYEE_ID, DATE, LEAVE_TYPE_ID) — übersprungen")
            skipped += 1
            continue

        try:
            from datetime import datetime
            datetime.strptime(date_raw, '%Y-%m-%d')
        except ValueError:
            errors.append(f"Zeile {i}: Ungültiges Datum '{date_raw}' (erwartet YYYY-MM-DD) — übersprungen")
            skipped += 1
            continue

        try:
            emp_id = int(emp_id_raw)
            lt_id = int(lt_id_raw)
            db.add_absence(emp_id, date_raw, lt_id)
            imported += 1
        except Exception as e:
            errors.append(f"Zeile {i}: {e}")

    return {"imported": imported, "errors": errors, "skipped": skipped}


@app.post("/api/import/holidays")
async def import_holidays(file: UploadFile = File(...)):
    """Import holidays from CSV. Required: DATE (YYYY-MM-DD), NAME.
    Optional: INTERVAL (0=einmalig, 1=jährlich), REGION (ignored, for info only)."""
    content = await file.read()
    text = _decode_csv(content)
    reader = csv.DictReader(io.StringIO(text))

    imported = 0
    skipped = 0
    errors = []
    db = get_db()

    for i, row in enumerate(reader, start=2):
        row = {k.strip().upper(): v.strip() for k, v in row.items() if k}

        date_raw = row.get('DATE') or row.get('DATUM') or ''
        name = row.get('NAME') or row.get('BEZEICHNUNG') or ''

        if not date_raw or not name:
            errors.append(f"Zeile {i}: DATE und NAME sind Pflicht — übersprungen")
            skipped += 1
            continue

        try:
            from datetime import datetime
            datetime.strptime(date_raw, '%Y-%m-%d')
        except ValueError:
            errors.append(f"Zeile {i}: Ungültiges Datum '{date_raw}' (erwartet YYYY-MM-DD) — übersprungen")
            skipped += 1
            continue

        try:
            interval_raw = row.get('INTERVAL') or row.get('JAEHRLICH') or '0'
            data = {
                'DATE': date_raw,
                'NAME': name,
                'INTERVAL': int(interval_raw) if interval_raw.isdigit() else 0,
            }
            db.create_holiday(data)
            imported += 1
        except Exception as e:
            errors.append(f"Zeile {i} ({name}): {e}")

    return {"imported": imported, "errors": errors, "skipped": skipped}


# ── Backup / Restore endpoints ───────────────────────────────

import zipfile
from datetime import datetime as _backup_dt
from fastapi.responses import StreamingResponse


@app.get("/api/backup/download")
def backup_download():
    """Create a ZIP of all .DBF / .FPT / .CDX files and return as download."""
    allowed_ext = {'.DBF', '.FPT', '.CDX'}

    buf = io.BytesIO()
    files_added: list[str] = []

    with zipfile.ZipFile(buf, mode='w', compression=zipfile.ZIP_DEFLATED) as zf:
        for fname in os.listdir(DB_PATH):
            ext = os.path.splitext(fname)[1].upper()
            if ext in allowed_ext:
                full_path = os.path.join(DB_PATH, fname)
                if os.path.isfile(full_path):
                    zf.write(full_path, arcname=fname)
                    files_added.append(fname)

    buf.seek(0)
    ts = _backup_dt.now().strftime('%Y%m%d_%H%M')
    filename = f"sp5_backup_{ts}.zip"

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/api/backup/restore")
async def backup_restore(file: UploadFile = File(...)):
    """Restore .DBF / .FPT / .CDX files from an uploaded ZIP."""
    allowed_ext = {'.DBF', '.FPT', '.CDX'}

    content = await file.read()

    try:
        zf = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Ungültige ZIP-Datei")

    names_in_zip = zf.namelist()
    dbf_files = [n for n in names_in_zip if os.path.splitext(n)[1].upper() == '.DBF']
    if not dbf_files:
        raise HTTPException(status_code=400, detail="ZIP enthält keine .DBF Dateien")

    safe_db_path = os.path.abspath(DB_PATH)
    restored: list[str] = []
    with zf:
        for name in names_in_zip:
            ext = os.path.splitext(name)[1].upper()
            if ext not in allowed_ext:
                continue
            basename = os.path.basename(name)
            if not basename:
                continue
            # Extra safety: ensure the resolved destination is inside DB_PATH
            dest = os.path.normpath(os.path.join(safe_db_path, basename))
            if not dest.startswith(safe_db_path + os.sep) and dest != safe_db_path:
                # Should never happen since basename has no path separators, but
                # guard against exotic os.path.join edge cases on all platforms.
                continue
            data = zf.read(name)
            with open(dest, 'wb') as fout:
                fout.write(data)
            restored.append(basename)

    return {"restored": len(restored), "files": restored}


# ── Bulk Schedule Operations ─────────────────────────────────

class BulkEntry(BaseModel):
    employee_id: int
    date: str
    shift_id: Optional[int] = None


class BulkScheduleBody(BaseModel):
    entries: List[BulkEntry]
    overwrite: bool = True


@app.post("/api/schedule/bulk")
def bulk_schedule(body: BulkScheduleBody):
    """Bulk create/update/delete schedule entries in a single request.
    If shift_id is null the entry is deleted; otherwise created or overwritten."""
    from datetime import datetime as _dt2
    created = 0
    updated = 0
    deleted = 0
    db = get_db()
    for entry in body.entries:
        try:
            _dt2.strptime(entry.date, '%Y-%m-%d')
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid date format: {entry.date}")
        try:
            if entry.shift_id is None:
                count = db.delete_schedule_entry(entry.employee_id, entry.date)
                if count > 0:
                    deleted += 1
            else:
                if body.overwrite:
                    old_count = db.delete_schedule_entry(entry.employee_id, entry.date)
                else:
                    old_count = 0
                db.add_schedule_entry(entry.employee_id, entry.date, entry.shift_id)
                if old_count > 0:
                    updated += 1
                else:
                    created += 1
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return {"created": created, "updated": updated, "deleted": deleted}


# ── Einsatzplan Write (SPSHI) ────────────────────────────────

class EinsatzplanCreate(BaseModel):
    employee_id: int
    date: str
    name: Optional[str] = ''
    shortname: Optional[str] = ''
    shift_id: Optional[int] = 0
    workplace_id: Optional[int] = 0
    startend: Optional[str] = ''
    duration: Optional[float] = 0.0
    colortext: Optional[int] = 0
    colorbar: Optional[int] = 0
    colorbk: Optional[int] = 16777215


class EinsatzplanUpdate(BaseModel):
    name: Optional[str] = None
    shortname: Optional[str] = None
    shift_id: Optional[int] = None
    workplace_id: Optional[int] = None
    startend: Optional[str] = None
    duration: Optional[float] = None
    colortext: Optional[int] = None
    colorbar: Optional[int] = None
    colorbk: Optional[int] = None


class DeviationCreate(BaseModel):
    employee_id: int
    date: str
    name: Optional[str] = 'Arbeitszeitabweichung'
    shortname: Optional[str] = 'AZA'
    startend: Optional[str] = ''   # e.g. "07:00-15:30"
    duration: Optional[float] = 0.0  # minutes or hours (stores raw)
    colortext: Optional[int] = 0
    colorbar: Optional[int] = 0
    colorbk: Optional[int] = 16744448  # orange-ish default


@app.post("/api/einsatzplan")
def create_einsatzplan_entry(body: EinsatzplanCreate):
    """Create a Sonderdienst entry in SPSHI (TYPE=0)."""
    try:
        from datetime import datetime
        datetime.strptime(body.date, '%Y-%m-%d')
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")
    try:
        result = get_db().add_spshi_entry(
            employee_id=body.employee_id,
            date_str=body.date,
            name=body.name or '',
            shortname=body.shortname or '',
            shift_id=body.shift_id or 0,
            workplace_id=body.workplace_id or 0,
            entry_type=0,
            startend=body.startend or '',
            duration=body.duration or 0.0,
            colortext=body.colortext or 0,
            colorbar=body.colorbar or 0,
            colorbk=body.colorbk if body.colorbk is not None else 16777215,
        )
        return {"ok": True, "record": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/einsatzplan/{entry_id}")
def update_einsatzplan_entry(entry_id: int, body: EinsatzplanUpdate):
    """Update an existing SPSHI entry."""
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    # Map frontend keys to DBF field names
    key_map = {
        'name': 'NAME', 'shortname': 'SHORTNAME', 'shift_id': 'SHIFTID',
        'workplace_id': 'WORKPLACID', 'startend': 'STARTEND', 'duration': 'DURATION',
        'colortext': 'COLORTEXT', 'colorbar': 'COLORBAR', 'colorbk': 'COLORBK',
    }
    mapped = {key_map.get(k, k.upper()): v for k, v in data.items()}
    try:
        result = get_db().update_spshi_entry(entry_id, mapped)
        return {"ok": True, "record": result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/einsatzplan/{entry_id}")
def delete_einsatzplan_entry(entry_id: int):
    """Delete a SPSHI entry by ID."""
    try:
        count = get_db().delete_spshi_entry_by_id(entry_id)
        if count == 0:
            raise HTTPException(status_code=404, detail="SPSHI entry not found")
        return {"ok": True, "deleted": entry_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/einsatzplan/deviation")
def create_deviation(body: DeviationCreate):
    """Create an Arbeitszeitabweichung entry in SPSHI (TYPE=1)."""
    try:
        from datetime import datetime
        datetime.strptime(body.date, '%Y-%m-%d')
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")
    try:
        result = get_db().add_spshi_entry(
            employee_id=body.employee_id,
            date_str=body.date,
            name=body.name or 'Arbeitszeitabweichung',
            shortname=body.shortname or 'AZA',
            shift_id=0,
            workplace_id=0,
            entry_type=1,
            startend=body.startend or '',
            duration=body.duration or 0.0,
            colortext=body.colortext or 0,
            colorbar=body.colorbar or 0,
            colorbk=body.colorbk if body.colorbk is not None else 16744448,
        )
        return {"ok": True, "record": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/einsatzplan")
def get_einsatzplan(
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    group_id: Optional[int] = Query(None),
):
    """Return SPSHI entries for a specific date (Sonderdienste + Abweichungen)."""
    try:
        from datetime import datetime
        datetime.strptime(date, '%Y-%m-%d')
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")
    return get_db().get_spshi_entries_for_day(date, group_id=group_id)


# ── Cycle Exceptions ─────────────────────────────────────────

class CycleExceptionSet(BaseModel):
    employee_id: int
    cycle_assignment_id: int
    date: str
    type: int = 1  # 1=skip, 0=normal


@app.get("/api/cycle-exceptions")
def get_cycle_exceptions(
    employee_id: Optional[int] = Query(None),
    cycle_assignment_id: Optional[int] = Query(None),
):
    """Get cycle exceptions (date overrides in assigned cycles)."""
    return get_db().get_cycle_exceptions(employee_id=employee_id,
                                          cycle_assignment_id=cycle_assignment_id)


@app.post("/api/cycle-exceptions")
def set_cycle_exception(body: CycleExceptionSet):
    """Set a cycle exception for a specific date."""
    try:
        result = get_db().set_cycle_exception(
            employee_id=body.employee_id,
            cycle_assignment_id=body.cycle_assignment_id,
            date_str=body.date,
            exc_type=body.type,
        )
        return {"ok": True, "record": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/cycle-exceptions/{exception_id}")
def delete_cycle_exception(exception_id: int):
    """Delete a cycle exception by ID."""
    count = get_db().delete_cycle_exception(exception_id)
    if count == 0:
        raise HTTPException(status_code=404, detail="Cycle exception not found")
    return {"ok": True, "deleted": exception_id}


# ── Employee / Group Access Rights ───────────────────────────

class EmployeeAccessSet(BaseModel):
    user_id: int
    employee_id: int
    rights: int = 0


class GroupAccessSet(BaseModel):
    user_id: int
    group_id: int
    rights: int = 0


@app.get("/api/employee-access")
def get_employee_access(user_id: Optional[int] = Query(None)):
    """Get employee-level access restrictions."""
    return get_db().get_employee_access(user_id=user_id)


@app.post("/api/employee-access")
def set_employee_access(body: EmployeeAccessSet):
    """Set employee-level access for a user."""
    try:
        result = get_db().set_employee_access(body.user_id, body.employee_id, body.rights)
        return {"ok": True, "record": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/employee-access/{access_id}")
def delete_employee_access(access_id: int):
    """Remove an employee access entry."""
    count = get_db().delete_employee_access(access_id)
    if count == 0:
        raise HTTPException(status_code=404, detail="Access record not found")
    return {"ok": True, "deleted": access_id}


@app.get("/api/group-access")
def get_group_access(user_id: Optional[int] = Query(None)):
    """Get group-level access restrictions."""
    return get_db().get_group_access(user_id=user_id)


@app.post("/api/group-access")
def set_group_access(body: GroupAccessSet):
    """Set group-level access for a user."""
    try:
        result = get_db().set_group_access(body.user_id, body.group_id, body.rights)
        return {"ok": True, "record": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/group-access/{access_id}")
def delete_group_access(access_id: int):
    """Remove a group access entry."""
    count = get_db().delete_group_access(access_id)
    if count == 0:
        raise HTTPException(status_code=404, detail="Access record not found")
    return {"ok": True, "deleted": access_id}


# ── Absence Status (approval workflow) ───────────────────────────────────────

import json as _json

_STATUS_FILE = os.path.join(os.path.dirname(__file__), '..', 'absence_status.json')

def _load_absence_status() -> dict:
    try:
        if os.path.exists(_STATUS_FILE):
            with open(_STATUS_FILE, 'r', encoding='utf-8') as f:
                return _json.load(f)
    except Exception:
        pass
    return {}

def _save_absence_status(data: dict) -> None:
    try:
        with open(_STATUS_FILE, 'w', encoding='utf-8') as f:
            _json.dump(data, f, indent=2)
    except Exception:
        pass


@app.get("/api/absences/status")
def get_all_absence_statuses():
    """Return the status dict for all absences (id → status)."""
    return _load_absence_status()


class AbsenceStatusPatch(BaseModel):
    status: str  # 'pending' | 'approved' | 'rejected'


@app.patch("/api/absences/{absence_id}/status")
def patch_absence_status(absence_id: int, body: AbsenceStatusPatch):
    """Update approval status for an absence record."""
    allowed = {'pending', 'approved', 'rejected'}
    if body.status not in allowed:
        raise HTTPException(status_code=400, detail=f"status must be one of {allowed}")
    data = _load_absence_status()
    data[str(absence_id)] = body.status
    _save_absence_status(data)
    return {"ok": True, "id": absence_id, "status": body.status}


# ── Admin: Compact database ───────────────────────────────────────────────────

@app.post("/api/admin/compact")
def compact_database():
    """
    Compact all .DBF files in SP5_DB_PATH by rewriting them without deleted records.
    Deleted records have 0x2A ('*') as the first byte of their data row.
    Each file is exclusively locked during the operation to prevent concurrent corruption.
    Returns a summary of files processed and records removed.
    """
    import struct as _struct
    import fcntl as _fcntl
    from datetime import date as _date

    db_path = os.environ.get('SP5_DB_PATH', '')
    if not db_path or not os.path.isdir(db_path):
        raise HTTPException(status_code=500, detail=f"SP5_DB_PATH not set or not a directory: {db_path!r}")

    dbf_files = [f for f in os.listdir(db_path) if f.upper().endswith('.DBF')]
    results = []
    total_removed = 0

    for fname in sorted(dbf_files):
        fpath = os.path.join(db_path, fname)
        try:
            # Open for read+write and hold an exclusive lock for the entire
            # read-modify-write cycle to prevent concurrent write corruption.
            with open(fpath, 'r+b') as f:
                _fcntl.flock(f.fileno(), _fcntl.LOCK_EX)
                try:
                    raw = f.read()

                    if len(raw) < 32:
                        results.append({'file': fname, 'skipped': 'too small / corrupt'})
                        continue

                    # Parse DBF header
                    num_records = _struct.unpack_from('<I', raw, 4)[0]
                    header_size = _struct.unpack_from('<H', raw, 8)[0]
                    record_size = _struct.unpack_from('<H', raw, 10)[0]

                    if record_size == 0:
                        results.append({'file': fname, 'skipped': 'record_size=0'})
                        continue

                    # Separate header bytes from record area
                    header_bytes = bytearray(raw[:header_size])
                    records_area = raw[header_size:]

                    # Remove trailing EOF marker for processing
                    if records_area and records_area[-1] == 0x1A:
                        records_area = records_area[:-1]

                    # Split into individual records and filter out deleted ones
                    active_records = []
                    deleted_count = 0
                    for i in range(num_records):
                        start = i * record_size
                        end = start + record_size
                        if end > len(records_area):
                            break
                        rec = records_area[start:end]
                        if rec[0:1] == b'\x2a':  # deleted marker
                            deleted_count += 1
                        else:
                            active_records.append(rec)

                    if deleted_count == 0:
                        results.append({'file': fname, 'removed': 0, 'active': len(active_records)})
                        continue

                    # Update header: new record count + today's date
                    today = _date.today()
                    header_bytes[1] = today.year % 100
                    header_bytes[2] = today.month
                    header_bytes[3] = today.day
                    _struct.pack_into('<I', header_bytes, 4, len(active_records))

                    # Write compacted file (truncate then rewrite)
                    f.seek(0)
                    f.truncate()
                    f.write(bytes(header_bytes))
                    for rec in active_records:
                        f.write(rec)
                    f.write(b'\x1a')  # EOF marker
                    f.flush()
                finally:
                    _fcntl.flock(f.fileno(), _fcntl.LOCK_UN)

            total_removed += deleted_count
            results.append({'file': fname, 'removed': deleted_count, 'active': len(active_records)})

        except Exception as e:
            results.append({'file': fname, 'error': str(e)})

    return {
        'ok': True,
        'files_processed': len(results),
        'total_records_removed': total_removed,
        'details': results,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
