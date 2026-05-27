# Changelog

All notable changes to OpenSchichtplaner5 are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- **ORM-Mirror Admin API (#131):** New admin-only router under `/api/admin/orm` exposing a read-only ORM projection of the DBF master-data definition tables (shifts, leave types, workplaces). `POST /api/admin/orm/sync` materializes the mirror into its own `sp5_orm.db`; `GET /api/admin/orm/shifts`, `/leave-types`, `/workplaces` list the definitions (with an `include_hidden` query). The DBF files remain the source of truth — this is the gradual DBF → ORM migration path. Consumes `libopenschichtplaner5 >=1.2.0` (Shift/LeaveType/Workplace models + repositories + sync).
- **ORM-Mirror Schedule Entries (#133):** Extended the ORM mirror with schedule-entry endpoints — `GET /api/admin/orm/shift-assignments` (`5MASHI`), `/special-shifts` (`5SPSHI`) and `/absences` (`5ABSEN`) — each filterable via `date_from`/`date_to` (inclusive ISO dates) and `employee_id` query params. `POST /api/admin/orm/sync` now covers all six tables. Bumps the `libopenschichtplaner5` consumption to `>=1.3.0` (schedule-entry models with date-range repositories; `sync_all` is now dangling-FK tolerant on dirty data).

---

## [1.1.0] - 2026-03-28

### Added
- **Scheduled Reports (Q094):** Automatic report generation and email delivery on configurable schedules (daily, weekly, monthly). Supports PDF/XLSX formats with recipient management.
- **Keyboard Navigation (Q093):** Complete keyboard accessibility across all views — arrow keys for schedule navigation, Tab for form controls, Enter/Space for actions, Escape to close modals.
- **Rate-Limit Dashboard (Q092):** Admin dashboard showing API rate-limit status, top consumers, and throttle statistics with real-time updates.
- **Employee Photo Upload (Q091):** Profile photo upload with client-side crop/resize. Photos stored efficiently and displayed in employee lists and profiles.
- **Auto DB Migration (Q090):** Automatic database schema migration on version updates — detects schema changes and applies them safely on startup.
- **Drag & Drop Calendar (Q089):** Drag & drop shift assignment in the calendar view for intuitive schedule editing.
- **API Versioning (Q088):** Versioned API routes under `/api/v1/` with OpenAPI docs. Unversioned routes return deprecation headers with sunset dates.
- **PostgreSQL Support (Q086):** PostgreSQL as an alternative database backend alongside SQLite/DBF. Full feature parity with connection pooling and optimized queries.

### Improved
- **Dark Mode (Q087):** Improved dark mode consistency across all components — unified color variables, better contrast ratios, and system preference detection.
- **2FA Screenshots:** Accurate profile screenshots showing 2FA setup section.
- **Documentation Screenshots:** Fresh screenshots for all 74+ pages.

### Fixed
- **Post-v1.0.0 Stabilization (S004):** Comprehensive test coverage improvements, resource warning fixes, and edge case handling.

---

## [1.0.0] - 2026-03-27

### 🎉 Production Release

OpenSchichtplaner5 v1.0.0 — the first stable production release. A fully-featured, open-source web replacement for the proprietary Windows software Schichtplaner5, reading and writing the original DBF database files directly.

### Added
- **Onboarding Checklist (Q085):** Non-blocking checklist card on the Dashboard for new admins. Tracks setup progress (company, shift types, employees, first schedule) with localStorage persistence and dismiss button. Auto-detects completion via API checks.
- **Qualifikations-Matrix (Q084):** Backend API for employee qualifications/skills matrix with CRUD endpoints. Enables tracking of certifications, training, and skill levels per employee.
- **Konflikt-Report UI (Q083):** Dedicated conflict report page with summary bar, type filters (overlap, understaffing, rule violations), and CSV/XLSX export.
- **Schedule PDF Export (Q082):** Print-optimized HTML-based PDF export endpoint for schedule data.
- **Arbeitszeit-Regelwerk UI (Q081):** Frontend interface for configuring working time rules (max hours/day, minimum rest, max consecutive days) with violation highlighting in schedule view.
- **Notification Settings (Q080):** Per-user email notification preferences with toggleable event types (shift changes, swaps, approvals, comments).
- **Arbeitszeit-Regelwerk Backend (Q079):** Configurable rule engine for working time compliance with automated violation detection.
- **Mitarbeiter-Timeline (Q078):** Horizontal CSS timeline showing shifts and absences per employee on a unified time axis.
- **Schicht-Konflikt-Report Backend (Q077):** Automated conflict detection covering overlap, double-booking, and understaffed periods with severity indicators.
- **Abwesenheits-Statistiken UI (Q076):** Multi-tab absence statistics with overview, group, and employee views. CSS-based charts for type distribution and monthly trends.
- **Export-Scheduler UI (Q075):** Full CRUD interface for scheduled report exports with recipient management and manual trigger.
- **Abwesenheits-Statistiken Backend (Q074):** Per-employee breakdown, group comparison, and organization-wide absence statistics.
- **Recurring Shifts UI (Q073):** Frontend for managing recurring shift templates (weekly/biweekly) with 🔁 badge on auto-generated instances.
- **Schicht-Tausch Erweiterungen (Q072):** Swap request notifications (in-app + email), full status history log, auto-expiry after configurable days.
- **Überstunden-Dashboard (Q071):** Visual bar chart with color-coded overtime balances per employee (green/yellow/red).
- **Export-Scheduler Backend (Q070):** Automated weekly report delivery via email with CRUD and manual trigger endpoints.
- **Schichtplan-Kommentare (Q069):** Day-level notes with 📝 indicator and inline popover editor.
- **Überstunden-Tracking (Q068):** Per-employee overtime balance and organization-wide summary endpoints.
- **Mitarbeiter-Vergleichsansicht (Q067):** Side-by-side employee comparison via URL params or Compare button.
- **Recurring Shifts Backend (Q066):** Weekly/biweekly repeat patterns with generate endpoint.
- **Dashboard Performance-Widget (Q065):** Live system metrics (API response time, DB status, memory, disk).
- **CSV Employee Import (Q064):** Bulk employee creation from CSV with validation and duplicate detection.
- **Print Layout Improvements (Q063):** Enhanced A4 landscape print stylesheet.
- **In-App Changelog (Q060):** Changelog page accessible from within the application.
- **Soft-Delete Employees (Q059):** Active/inactive filter with soft-delete support.
- **Keyboard Shortcuts (Q058):** Global keyboard shortcuts with help modal.
- **Structured Logging (Q057):** JSON logging with request IDs for backend.
- **Empty State Illustrations (Q056):** Friendly empty states for all major list pages.
- **Content-Security-Policy (Q054):** CSP headers + Subresource Integrity (SRI).
- **Extended Health Check (Q053):** Structured metrics for monitoring.
- **Bulk Import UX (Q052):** Drag-and-drop file upload with validation preview.
- **Excel Export (Q051):** XLSX export for all data endpoints.
- **Responsive Tables (Q050):** Horizontal scroll on mobile for all data tables.
- **Webhook System (Q049):** Backend webhook delivery for integration with external systems.
- **Dashboard Company Context (Q048):** Active company display in dashboard header.
- **Production Docker Compose (Q047):** Nginx reverse proxy + production-hardened Docker setup.
- **Playwright E2E in CI (Q046):** End-to-end tests running in GitHub Actions.
- **Multi-Tenant Companies (Q044):** Company CRUD API with tenant isolation.

### Improved
- 8 stabilization batches (S003–S012) with comprehensive bug fixes and test coverage
- API versioning under `/api/v1/` with deprecation headers on legacy routes
- Global search bar (`Ctrl+K`) across employees, groups, and shifts
- Enhanced conflict detection with HTTP 409 responses
- Improved auto-planner considering availability, weekly limits, and assigned hours
- Consistent loading animations and error states across all pages
- Rate limiting on all API endpoints
- Stricter input validation on all form fields

### Changed
- Full CI/CD pipeline with pytest, ruff, ESLint, TypeScript checks, and Playwright E2E
- Docker multi-arch builds (amd64 + arm64)
- Automated GitHub Container Registry publishing
- SQLite backup/restore with automatic pre-restore backups

---

## [1.0.0-rc7] - 2026-03-27

### Added
- **Abwesenheits-Statistiken UI (Q076):** New multi-tab absence statistics interface with overview, group, and employee tabs. CSS-based charts display absence distribution by type (vacation, sick leave, other) and monthly trends. Accessible from the Statistics section.
- **Schicht-Konflikt-Report (Q077):** Automated shift conflict detection covering overlap, double-booking, and understaffed periods. Results are displayed in a conflict report view with severity indicators. Supports CSV and XLSX export for further analysis.
- **Mitarbeiter-Timeline (Q078):** Horizontal CSS timeline view per employee showing shifts and absences on a unified time axis. Enables at-a-glance review of individual workload and absence patterns across a configurable date range.
- **Arbeitszeit-Regelwerk (Q079):** Working time rule engine with configurable limits: maximum hours per day, minimum rest between shifts, and maximum consecutive working days. A dedicated checker highlights violations in the schedule and employee views.
- **Notification-Settings (Q080):** Per-user email notification preferences. Users can independently toggle notifications for each event type (shift assigned, shift changed, swap requested/approved/rejected, vacation approved/rejected, schedule comment added) via the profile settings page.

---

## [1.0.0-rc6] - 2026-03-27

### Added
- **Überstunden-Dashboard (Q071):** Visual bar chart on the overtime dashboard showing per-employee overtime balances at a glance. Color-coded bars (green/yellow/red) indicate healthy, borderline, and critical overtime levels. Integrates with existing `/api/v1/overtime/summary` endpoint.
- **Schicht-Tausch Erweiterungen (Q072):** Shift swap requests now include in-app and email notifications for both parties on status changes. Full status history log (requested → accepted/rejected → approved/denied) displayed in the swap detail view. Auto-expiry: open swap requests automatically expire after a configurable number of days (default: 7).
- **Recurring Shifts UI (Q073):** Frontend interface for managing recurring shift templates. Users can create, view, and delete recurring shift rules (weekly/biweekly) directly from the schedule view. A recurring badge (🔁) marks auto-generated shift instances.
- **Abwesenheits-Statistiken (Q074):** New absence statistics views — per-employee breakdown, group comparison, and organization-wide overview. Charts show absence days by type (vacation, sick leave, other), month-by-month trends, and team absence calendars. Accessible via the Statistics section.
- **Export-Scheduler UI (Q075):** Full CRUD interface for managing scheduled report exports. Users can create, edit, and delete export jobs with configurable recipient lists, report types, and schedules. A manual trigger button allows immediate on-demand delivery. Integrates with the existing `/api/v1/export-scheduler` backend.

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
