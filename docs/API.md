# OpenSchichtplaner5 — API Reference

> **Interactive Docs:** The FastAPI backend serves Swagger UI at [`http://localhost:8000/docs`](http://localhost:8000/docs) and ReDoc at [`http://localhost:8000/redoc`](http://localhost:8000/redoc).

All API endpoints are prefixed with `/api/`. Authentication is done via a `Bearer` token in the `Authorization` header.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Employees](#employees)
3. [Schedule](#schedule)
4. [Reports & Export](#reports--export)
5. [Health & Status](#health--status)

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

## Notes

- All dates use ISO 8601 format: `YYYY-MM-DD`
- Tokens expire after **8 hours** (configurable via `TOKEN_EXPIRE_HOURS`)
- Rate limiting: login endpoint is limited to **5 attempts per minute**
- After 5 failed login attempts, the account is locked for **15 minutes**
- Multi-worker deployments require a shared session store (e.g. Redis) — use `--workers 1` for single-node setups
