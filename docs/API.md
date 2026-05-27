# OpenSchichtplaner5 — API Reference

> **Interactive Docs:** The FastAPI backend serves Swagger UI at [`http://localhost:8000/docs`](http://localhost:8000/docs) and ReDoc at [`http://localhost:8000/redoc`](http://localhost:8000/redoc).

## API Versioning

As of **v1.0.0-rc4**, all endpoints are available under the `/api/v1/` prefix. The legacy `/api/` prefix is still supported for backwards compatibility but is **deprecated**:

- Deprecated routes return the response headers:
  - `Deprecation: true`
  - `X-API-Version: v1`
  - `Link: </api/v1/...>; rel="successor-version"`
- **New integrations should use `/api/v1/` exclusively.**
- The legacy prefix will be removed in a future major release.

Authentication is done via a `Bearer` token in the `Authorization` header.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Employees](#employees)
3. [CSV Employee Import](#csv-employee-import)
4. [Schedule](#schedule)
5. [Reports & Export](#reports--export)
6. [Shift Wishes](#shift-wishes)
7. [ORM Mirror (Admin)](#orm-mirror-admin)
8. [Health & Status](#health--status)

---

## Authentication

### Login

```bash
curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Test1234"}'
```

**Response:**

```json
{
  "token": "eyJhb...",
  "user": {
    "id": 1,
    "NAME": "admin",
    "ROLE": "admin"
  }
}
```

Save the token and use it in subsequent requests:

```bash
export TOKEN="eyJhb..."
```

---

### Current User Info

```bash
curl -s http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**

```json
{
  "id": 1,
  "NAME": "admin",
  "ROLE": "admin"
}
```

---

### Logout

```bash
curl -s -X POST http://localhost:8000/api/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**

```json
{"ok": true}
```

---

### Roles

| Role | Description |
|------|-------------|
| `admin` | Full access: users, settings, backup, import |
| `planer` | Read/write schedule, absences, notes |
| `leser` | Read-only access to all data |

#### Test credentials (demo/dev only)

| Username | Password | Role |
|----------|----------|------|
| `admin` | `Test1234` | admin |
| `planer` | `Test1234` | planer |
| `leser` | `Test1234` | leser |

---

## Employees

### List all employees

```bash
curl -s http://localhost:8000/api/employees \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**

```json
[
  {
    "ID": 1,
    "NAME": "Mustermann",
    "FIRSTNAME": "Max",
    "SHORTNAME": "MMU",
    "NUMBER": "001",
    "HRSWEEK": 38.5,
    "WORKDAYS": "1 1 1 1 1 0 0 0",
    "HIDE": false,
    "EMAIL": "max.mustermann@example.com"
  }
]
```

---

### Get single employee

```bash
curl -s http://localhost:8000/api/employees/1 \
  -H "Authorization: Bearer $TOKEN"
```

---

### Create employee

Requires `planer` or `admin` role.

```bash
curl -s -X POST http://localhost:8000/api/employees \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "NAME": "Musterfrau",
    "FIRSTNAME": "Maria",
    "SHORTNAME": "MMA",
    "NUMBER": "042",
    "HRSDAY": 7.7,
    "HRSWEEK": 38.5,
    "WORKDAYS": "1 1 1 1 1 0 0 0",
    "EMAIL": "maria@example.com"
  }'
```

**Response:**

```json
{
  "ID": 42,
  "NAME": "Musterfrau",
  "FIRSTNAME": "Maria",
  "SHORTNAME": "MMA"
}
```

> `SHORTNAME` is auto-generated from first/last name if omitted.

---

### Update employee

Requires `planer` or `admin` role.

```bash
curl -s -X PUT http://localhost:8000/api/employees/42 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "EMAIL": "neue.adresse@example.com",
    "HRSWEEK": 30.0
  }'
```

**Response:**

```json
{"ok": true}
```

---

### Deactivate (soft-delete) employee

Requires `admin` role.

```bash
curl -s -X DELETE http://localhost:8000/api/employees/42 \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**

```json
{"ok": true}
```

> Employees are soft-deleted (HIDE=true). They remain in the database and can be reactivated.

---

### Get employee groups

```bash
curl -s http://localhost:8000/api/employees/1/groups \
  -H "Authorization: Bearer $TOKEN"
```

---

### List groups

```bash
curl -s http://localhost:8000/api/groups \
  -H "Authorization: Bearer $TOKEN"
```

---

## CSV Employee Import

> **Endpoint:** `POST /api/v1/employees/import-csv`

Bulk-create employees from a CSV file. The file must be uploaded as `multipart/form-data`.

### Required CSV Columns

| Column | Description |
|--------|-------------|
| `PERSNR` | Employee number (string, unique — used for deduplication) |
| `NAME` | Last name |
| `VORNAME` | First name |
| `KURZZEICHEN` | Short code / initials |
| `GRUPPE` | Group name (must match an existing group) |

Additional columns are silently ignored.

### Request

```bash
curl -s -X POST http://localhost:8000/api/v1/employees/import-csv \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@employees.csv"
```

### Optional Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `error_threshold` | float (0–1) | `0.2` | Maximum fraction of rows allowed to fail before the entire import is aborted (e.g. `0.2` = 20%) |
| `dry_run` | bool | `false` | Validate and preview without writing to the database |

### Response

```json
{
  "created": 42,
  "skipped": 3,
  "errors": 1,
  "error_threshold_exceeded": false,
  "details": [
    {
      "row": 12,
      "persnr": "E099",
      "status": "skipped",
      "reason": "duplicate — employee already exists"
    },
    {
      "row": 27,
      "persnr": "E103",
      "status": "error",
      "reason": "group 'Nachtschicht-X' not found"
    }
  ]
}
```

### Status Codes

| Code | Meaning |
|------|---------|
| `200` | Import completed (check `created`/`skipped`/`errors` for details) |
| `400` | Invalid CSV format or error threshold exceeded |
| `401` | Unauthorized |
| `403` | Insufficient permissions (Admin or Planner role required) |
| `422` | Validation error in query parameters |

### Example CSV

```csv
PERSNR,NAME,VORNAME,KURZZEICHEN,GRUPPE
E001,Muster,Max,MM,Frühschicht
E002,Beispiel,Erika,EB,Spätschicht
E003,Neu,Klaus,KN,Nachtschicht
```

---

## Schedule

### Get monthly schedule

Returns shift assignments for all employees for a given month.

```bash
curl -s "http://localhost:8000/api/schedule?year=2026&month=3" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (excerpt):**

```json
[
  {
    "EMPLOYEEID": 1,
    "DATE": "2026-03-03",
    "SHIFTID": 5,
    "SHIFT_NAME": "Frühschicht",
    "SHIFT_SHORT": "F",
    "COLOR": "#4CAF50"
  }
]
```

---

### Get weekly schedule

```bash
curl -s "http://localhost:8000/api/schedule/week?year=2026&week=10" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Get daily schedule

```bash
curl -s "http://localhost:8000/api/schedule/day?date=2026-03-06" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Assign a shift (create schedule entry)

Requires `planer` role.

```bash
curl -s -X POST http://localhost:8000/api/schedule \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": 1,
    "date": "2026-03-10",
    "shift_id": 5
  }'
```

**Response:**

```json
{"ok": true}
```

**Possible errors:**

| Status | Meaning |
|--------|---------|
| 404 | Employee or shift not found |
| 409 | Conflict: entry already exists for this date |
| 403 | Forbidden: employee has a shift restriction |

---

### Delete a schedule entry

Requires `planer` role.

```bash
curl -s -X DELETE \
  "http://localhost:8000/api/schedule/1/2026-03-10" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**

```json
{"ok": true}
```

---

### Bulk assign shifts

Assign the same shift to one employee over a date range.

```bash
curl -s -X POST http://localhost:8000/api/schedule/bulk \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": 1,
    "shift_id": 5,
    "dates": ["2026-03-10", "2026-03-11", "2026-03-12"]
  }'
```

---

### Conflict detection

Returns schedule conflicts (employee has both a shift and an absence on the same day).

```bash
curl -s "http://localhost:8000/api/schedule/conflicts?year=2026&month=3" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**

```json
[
  {
    "EMPLOYEEID": 3,
    "DATE": "2026-03-15",
    "SHIFT_SHORT": "F",
    "ABSENCE_TYPE": "Krank"
  }
]
```

---

### Schedule coverage (staffing levels)

```bash
curl -s "http://localhost:8000/api/schedule/coverage?year=2026&month=3" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Auto-generate schedule

Requires `planer` role. Generates a shift plan based on employee shift cycles.

```bash
curl -s -X POST http://localhost:8000/api/schedule/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2026,
    "month": 4,
    "force": false,
    "employee_ids": []
  }'
```

> Set `force: true` to overwrite existing entries. Use the preview response before committing.

---

## Reports & Export

### Schedule report (CSV)

```bash
curl -s "http://localhost:8000/api/export/schedule?year=2026&month=3&format=csv" \
  -H "Authorization: Bearer $TOKEN" \
  -o schedule_march2026.csv
```

### Schedule report (HTML)

```bash
curl -s "http://localhost:8000/api/export/schedule?year=2026&month=3&format=html" \
  -H "Authorization: Bearer $TOKEN" \
  -o schedule_march2026.html
```

---

### Employee list export (CSV)

```bash
curl -s "http://localhost:8000/api/export/employees?format=csv" \
  -H "Authorization: Bearer $TOKEN" \
  -o employees.csv
```

---

### Absence report

```bash
curl -s "http://localhost:8000/api/export/absences?year=2026&format=csv" \
  -H "Authorization: Bearer $TOKEN" \
  -o absences_2026.csv
```

---

### Statistics (monthly summary)

```bash
curl -s "http://localhost:8000/api/statistics?year=2026&month=3" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (excerpt):**

```json
{
  "employees": [
    {
      "id": 1,
      "name": "Max Mustermann",
      "nominal_hours": 154.0,
      "actual_hours": 160.5,
      "delta": 6.5,
      "absences": 0,
      "vacation_days": 0
    }
  ]
}
```

---

### Per-employee statistics

```bash
curl -s "http://localhost:8000/api/statistics/employee/1?year=2026&month=3" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Monthly report (PDF-ready HTML)

```bash
curl -s "http://localhost:8000/api/reports/monthly?year=2026&month=3" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Overtime report

```bash
curl -s "http://localhost:8000/api/statistics?year=2026" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Shift Wishes

### List wishes (admin)

```bash
curl -s http://localhost:8000/api/wishes \
  -H "Authorization: Bearer $TOKEN"
```

**Response:** Array of wish objects with fields `id`, `employee_id`, `date`, `wish_type`, `status`, `created_at`.

---

### Create wish (admin)

```bash
curl -s -X POST http://localhost:8000/api/wishes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"employee_id": 1, "date": "2026-04-01", "wish_type": "free"}'
```

---

### Approve / reject wish

```bash
curl -s -X POST http://localhost:8000/api/wishes/42/approve \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "approve"}'
```

`action` can be `"approve"` or `"reject"`.

---

### Submit own wish (self-service)

Employees can submit their own wishes without admin role:

```bash
curl -s -X POST http://localhost:8000/api/self/wishes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date": "2026-04-15", "wish_type": "free", "note": "Arzttermin"}'
```

---

## ORM Mirror (Admin)

A **read-only, admin-only** projection of the DBF data, served under `/api/admin/orm`.
The DBF files remain the **single source of truth** — these endpoints expose a queryable
mirror that is materialized from the DBF files on demand and stored in its own
`sp5_orm.db` next to the DBF data directory.

The mirror is backed by the `libopenschichtplaner5` ORM layer (consumed at `>=1.3.0`)
and works identically on SQLite and PostgreSQL. It is the gradual **DBF → ORM migration
path**: additive, never touching the live DBF read/write flows. Two layers are mirrored:

- **Master-data definitions** — shifts, leave types, workplaces (lib 1.2.0).
- **Schedule entries** — shift assignments (`5MASHI`), special shifts (`5SPSHI`) and
  absences (`5ABSEN`) with date-range queries (lib 1.3.0).

**Authentication:** all endpoints require an **admin** session. Pass the admin session
token in the `X-Auth-Token` header (the same token issued by `/api/auth/login`).
Non-admin or unauthenticated callers receive `401`/`403`.

```bash
export ADMIN_TOKEN="eyJhb..."
```

> All list endpoints return DBF-shaped dicts — field names match the FoxPro columns
> (e.g. `ID`, `NAME`, `SHORTNAME`, `DATE`, `EMPLOYEEID`, `SHIFTID`).

---

### Sync the ORM mirror

Upserts the DBF master-data definition tables (shifts, leave types, workplaces) **and**
the schedule-entry tables (shift assignments, special shifts, absences) into the mirror
store, returning per-table row counts. Safe to call repeatedly — the library's sync uses
upsert semantics keyed by the DBF ID, and rows with invalid dates are skipped.

```bash
curl -s -X POST http://localhost:8000/api/admin/orm/sync \
  -H "X-Auth-Token: $ADMIN_TOKEN"
```

**Response:**

```json
{
  "ok": true,
  "synced": {
    "shifts": 12,
    "leave_types": 8,
    "workplaces": 5,
    "shift_assignments": 1840,
    "special_shifts": 14,
    "absences": 263
  }
}
```

---

### List shifts

```bash
curl -s "http://localhost:8000/api/admin/orm/shifts" \
  -H "X-Auth-Token: $ADMIN_TOKEN"
```

| Query parameter | Type | Default | Description |
|-----------------|------|---------|-------------|
| `include_hidden` | bool | `false` | Also return rows flagged as hidden |

**Response (excerpt):**

```json
[
  {
    "ID": 5,
    "NAME": "Frühschicht",
    "SHORTNAME": "F"
  }
]
```

---

### List leave types

```bash
curl -s "http://localhost:8000/api/admin/orm/leave-types" \
  -H "X-Auth-Token: $ADMIN_TOKEN"
```

| Query parameter | Type | Default | Description |
|-----------------|------|---------|-------------|
| `include_hidden` | bool | `false` | Also return rows flagged as hidden |

Returns an array of DBF-shaped leave-type dicts.

---

### List workplaces

```bash
curl -s "http://localhost:8000/api/admin/orm/workplaces" \
  -H "X-Auth-Token: $ADMIN_TOKEN"
```

| Query parameter | Type | Default | Description |
|-----------------|------|---------|-------------|
| `include_hidden` | bool | `false` | Also return rows flagged as hidden |

**Response (excerpt):**

```json
[
  {
    "ID": 1,
    "NAME": "Empfang",
    "SHORTNAME": "EMP"
  }
]
```

---

### List shift assignments

Regular schedule entries (`5MASHI`), filterable by date range and/or employee.

```bash
curl -s "http://localhost:8000/api/admin/orm/shift-assignments?date_from=2026-03-01&date_to=2026-03-31&employee_id=1" \
  -H "X-Auth-Token: $ADMIN_TOKEN"
```

| Query parameter | Type | Default | Description |
|-----------------|------|---------|-------------|
| `date_from` | ISO date | — | Inclusive lower bound (`YYYY-MM-DD`) |
| `date_to` | ISO date | — | Inclusive upper bound (`YYYY-MM-DD`) |
| `employee_id` | int | — | Filter by employee ID |

All filters are optional; omitting them returns every row.

**Response (excerpt):**

```json
[
  {
    "ID": 101,
    "DATE": "2026-03-03",
    "EMPLOYEEID": 1,
    "SHIFTID": 5
  }
]
```

---

### List special shifts

Special / one-off shifts (`5SPSHI`), filterable by date range and/or employee. Accepts
the same `date_from`, `date_to` and `employee_id` query parameters as
[shift assignments](#list-shift-assignments).

```bash
curl -s "http://localhost:8000/api/admin/orm/special-shifts?date_from=2026-03-01&date_to=2026-03-31" \
  -H "X-Auth-Token: $ADMIN_TOKEN"
```

Returns an array of DBF-shaped special-shift dicts.

---

### List absences

Absence / leave entries (`5ABSEN`), filterable by date range and/or employee. Accepts
the same `date_from`, `date_to` and `employee_id` query parameters as
[shift assignments](#list-shift-assignments).

```bash
curl -s "http://localhost:8000/api/admin/orm/absences?date_from=2026-03-01&date_to=2026-03-31&employee_id=1" \
  -H "X-Auth-Token: $ADMIN_TOKEN"
```

**Response (excerpt):**

```json
[
  {
    "ID": 77,
    "DATE": "2026-03-15",
    "EMPLOYEEID": 1
  }
]
```

---

## Health & Status

### Health check

```bash
curl -s http://localhost:8000/api/health
```

**Response:**

```json
{"status": "ok", "db": "connected"}
```

---

### Database statistics

```bash
curl -s http://localhost:8000/api/stats \
  -H "Authorization: Bearer $TOKEN"
```

---

### Dashboard summary

```bash
curl -s http://localhost:8000/api/dashboard/summary \
  -H "Authorization: Bearer $TOKEN"
```

---

### Runtime metrics

```bash
curl -s http://localhost:8000/api/metrics
```

No authentication required when called from localhost. Returns request count, error rate, cache hit rate, average DB-read latency, uptime, and active session count.

**Response:**

```json
{
  "request_count": 1240,
  "error_rate": 0.002,
  "cache_hit_rate": 0.87,
  "avg_db_latency_ms": 3.4,
  "uptime_seconds": 43200.0,
  "active_sessions": 3
}
```

---

### API version

```bash
curl -s http://localhost:8000/api/version
```

No authentication required.

**Response:**

```json
{
  "version": "0.9.5",
  "service": "OpenSchichtplaner5 API",
  "python_version": "3.11.0",
  "build_date": "2026-03-06",
  "min_compatible_frontend": "0.4.0"
}
```

---

## Notes

- All dates use ISO 8601 format: `YYYY-MM-DD`
- Tokens expire after **8 hours** (configurable via `TOKEN_EXPIRE_HOURS`)
- Rate limiting: login endpoint is limited to **5 attempts per minute**
- After 5 failed login attempts, the account is locked for **15 minutes**
- Multi-worker deployments require a shared session store (e.g. Redis) — use `--workers 1` for single-node setups
