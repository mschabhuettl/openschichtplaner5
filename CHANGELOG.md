# Changelog

All notable changes to OpenSchichtplaner5 are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [1.0.0-rc5] - 2026-03-27

### Added
- **Recurring Shifts (Q066):** New recurring shift system with weekly and biweekly repeat patterns. Endpoints: `POST /api/shifts/recurring` (create), `GET /api/shifts/recurring` (list), `DELETE /api/shifts/recurring/{id}` (remove), `POST /api/shifts/recurring/{id}/generate` (materialize occurrences for a date range). Supports custom intervals, weekday selection, and end dates.
- **Mitarbeiter-Vergleichsansicht (Q067):** Side-by-side employee comparison view accessible via URL parameters (`?compare=id1,id2`) or the new "Compare" button on employee pages. Displays scheduled hours, leave days, overtime, and shift distribution for each selected employee simultaneously.
- **Überstunden-Tracking (Q068):** Dedicated overtime tracking endpoints: `GET /api/v1/employees/{id}/overtime` (per-employee overtime balance with period breakdown) and `GET /api/v1/overtime/summary` (organization-wide summary with top earners and department totals). Overtime is calculated from contract hours vs. actual scheduled hours.
- **Schichtplan-Kommentare (Q069):** Day-level notes for the schedule view. Planners can attach text comments to any day. A 📝 indicator appears on days with notes; clicking opens a popover with the full comment and edit/delete controls. Notes are stored per planning context (location + date).
- **Export-Scheduler (Q070):** Automated weekly report delivery via email. Supports full CRUD for scheduled export jobs (`POST/GET/PUT/DELETE /api/v1/export-scheduler`), configurable recipient lists, report type selection, and a manual trigger endpoint (`POST /api/v1/export-scheduler/{id}/trigger`) for immediate on-demand delivery.

---

## [1.0.0-rc4] - 2026-03-27

### Added
- **Global Search:** New header search bar that searches employees, groups, and shifts simultaneously. Results appear in a categorized dropdown with keyboard navigation support. Accessible via `Ctrl+K` / `Cmd+K`.
- **API Versioning:** All endpoints now available under the `/api/v1/` prefix. Legacy `/api/` routes continue to work but return `Deprecation: true` and `X-API-Version: v1` response headers. Clients should migrate to `/api/v1/`.
- **Improved Print Layout:** Redesigned A4 landscape print stylesheet for the schedule view — cleaner table borders, page headers with company name and date range, repeated table headers across pages, signature line at the bottom. Print via browser `Ctrl+P`.
- **CSV Employee Import:** New endpoint `POST /api/v1/employees/import-csv` for bulk employee creation from a CSV file. Includes field validation, duplicate detection (by employee number), configurable error threshold (default 20%), and a detailed import result report (created / skipped / errors).
- **Performance Dashboard Widget:** New widget on the main dashboard showing live system metrics: API response time, database status, service uptime, memory usage, and disk usage. Data sourced from the extended `/api/health` endpoint.

### Improved
- **Print CSS:** Hides navigation sidebar, header bar, and action buttons during print. Enforces `A4 landscape` page size and avoids page breaks inside table rows.
- **Health Endpoint:** `/api/health` now exposes structured metrics for memory, disk, and uptime — consumed by the new Performance Widget.

---

## [1.0.0-rc3] - 2026-03-10

### Added
- **Two-Factor Authentication (TOTP):** Users can enable 2FA via an authenticator app (QR code setup, backup codes). Admins can reset 2FA for locked accounts.
- **Calendar View:** Schedule now also available as a monthly calendar with colored shift chips per day. Toggle between weekly and calendar view.
- **Undo/Redo in Schedule:** Undo shift assignments (Ctrl+Z) and redo (Ctrl+Y), up to 30 steps.
- **Schedule Templates:** Save weeks as templates and apply to any target week. Templates are stored server-side and visible to all planners.
- **Employee Availability:** Per-employee configurable availability (weekdays + time slots). The auto-planner considers these when generating suggestions.
- **Employee Profile Extended:** New tab for qualifications, availability and contract hours — all editable directly in the profile.
- **Personal Shift Calendar:** Employees (Reader role) get a personal monthly calendar showing their own shifts and can submit shift preferences per day.
- **Printable Schedule Layout:** Optimized print layout (A4 landscape) with hidden navigation, page repeats and signature line.
- **Database Export:** Admins can download the SQLite database backup (optionally compressed). An automatic backup is created before every restore.
- **SQLAlchemy ORM Layer:** Abstraction layer for future PostgreSQL migration — currently used alongside DBF as proof of concept.

### Improved
- **Conflict Detection:** When assigning shifts, duplicate assignments, time overlaps and absences are now checked (HTTP 409 with details).
- **Auto-Planner:** Now considers employee availability, weekly work hour limits and already assigned hours.
- **Loading Animations:** Consistent loading indicators across all pages.
- **Session Expiry:** Automatic logout before JWT expiry with notification toast.
- **Rate Limiting:** API endpoints secured against brute force (login: 5/min, general: 100/min).
- **Input Validation:** Stricter backend validation of all form fields (lengths, formats, required fields).
- **Password Security:** Passwords are hashed with bcrypt. Migration of existing accounts happens automatically on next login.

### Fixed
- Smoke tests updated to use correct auth header (`x-auth-token`) and `/api/version` endpoint.
- Overnight shift overlap detection corrected (modular arithmetic fix).
- Availability partial update no longer loses existing time windows for unchanged days.

---

## [1.0.0-rc2] - 2026-03-06

### Added
- **iCal Export:** Download employee shift schedules as `.ics` files.
- **Subscribable iCal Feed:** Token-based `webcal://` feed for calendar app subscription (Google Calendar, Outlook, Apple Calendar).
- **Email Notifications:** SMTP email notification system with configurable templates and admin settings page.
- **Audit Log:** Full activity log with user tracking, old/new value diffs, and entity-type filtering.

### Improved
- **OpenAPI Documentation:** Complete descriptions and examples for all 162+ API endpoints.
- **Test Coverage:** 1327+ backend tests, 165+ frontend component tests.
- **Structured Logging:** JSON-structured backend logs with request IDs and user context.
- **Security:** Removed hashed passwords from API responses; hardened CORS configuration.

### Fixed
- Test isolation: auth tokens no longer shared across test sessions (203 previously failing tests fixed).
- Mobile column layout and SQLite adapter improvements.

---

## [1.0.0-rc1] - 2026-03-06

First release candidate — marking feature completeness for the core use case.

### Added
- **Swap Exchange (Tauschbörse):** Employees can request shift swaps; partner acceptance workflow with planner notification.
- **Leave Approval Workflow:** Absence requests → planner review → approval/rejection with email notification.
- **Notifications Center:** Bell icon in header with dropdown; full notifications page with filters and mark-all-read.
- **Dark Mode:** Persistent dark/light theme toggle with system preference detection.
- **Keyboard Navigation & Accessibility:** Full keyboard navigation, ARIA labels, focus management.
- **Bulk Operations:** Assign shifts to entire groups for a date range.
- **CSV/Excel Export:** Download employee lists and absence reports as CSV or XLSX.
- **Real-time Updates (SSE):** Live schedule and notification updates via Server-Sent Events.
- **Password Reset Flow:** Self-service password reset for employees.
- **Drag & Drop:** Shift assignment by dragging in the schedule view (permission-gated).
- **Pagination:** Opt-in pagination for employee, absence and changelog endpoints.
- **Offline Indicator:** Graceful degradation and reconnect handling on network loss.

### Improved
- **Statistics Dashboard:** Year-over-year comparisons, monthly breakdowns, group CSV export.
- **Performance:** Lazy loading, code splitting, TTL-based API caching.
- **Security:** CSRF protection, security headers (CSP, HSTS, X-Frame-Options), rate limiting (100 req/min).
- **Mobile UX:** Hamburger menu, touch-friendly targets, responsive tables and bottom navigation.
- **Error Boundaries:** Global React error boundary to prevent full-page crashes.
- **404 Page:** Custom not-found page for unknown routes.
- **Docker:** healthcheck, `.dockerignore`, multi-arch image (amd64 + arm64).

---

## [0.5.0] - 2026-03-01

Major feature expansion — all core Schichtplaner5 features implemented.

### Added
- **Analytics Dashboard:** KPI charts, employee statistics, shift distribution visualization.
- **Capacity Planning:** Staffing requirements and gap analysis.
- **Skill Matrix:** Employee qualification tracking and assignment.
- **Schedule Optimizer:** Automated shift scheduling based on requirements.
- **Conflict Resolution UI:** Visual conflict detection and resolution workflow.
- **Employee Self-Service:** Absence requests, shift preferences, profile management.
- **Configuration Management:** Central settings page with categorized groups (Planning, Notifications, Display).
- **Data Import:** 7 import types (employees, shifts, groups, holidays, leave types, workplaces, special staffing).
- **PWA Support:** Installable as progressive web app with offline caching.
- **Print Export:** Optimized print stylesheets for all major views.
- **Advanced Reporting:** 20+ report types including shift statistics, rotation analysis, year summary.
- **Team Overview:** Group-based planning views with capacity indicators.

### Improved
- **Search & Filter:** Autocomplete search and multi-field filtering across all list views.
- **Data Visualization:** Recharts integration for all statistics pages.
- **Onboarding Tour:** Interactive first-time setup guide.

---

## [0.3.0] - 2026-02-28

Foundation release — core scheduling and employee management.

### Added
- **Schedule View:** Week-based shift schedule with group filtering and date navigation.
- **Employee Management:** Full CRUD for employees, groups, and group assignments.
- **Shift Types:** Create and manage shift templates with color coding.
- **Absence Management:** Vacation and absence tracking with leave type configuration.
- **Master Data:** Workplaces, holidays, pay supplements, staffing requirements.
- **User Management:** Role-based access control (Admin, Planner, Reader) enforced at API and UI level.
- **DBF Compatibility:** Direct read/write of FoxPro `.DBF` files — no migration needed, compatible with original Schichtplaner5.
- **Docker Deployment:** Multi-stage Dockerfile with production compose configuration.
- **CI Pipeline:** GitHub Actions with ruff lint, ESLint, pytest, and Docker build.

---

## [0.2.0] - 2026-02-28

Initial working prototype with basic schedule display and authentication.
