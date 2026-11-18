# Changelog

## 1.0.0

First release of the combined repository. `sp5lib` continues the earlier
library of the same name (last version 1.32.3), `sp5api` replaces the
earlier `openschichtplaner5-api`. Both were rebuilt around the file format
and checked against Schichtplaner 5.0.13; version numbers start again at 1.0.

Known limits: references between records are not checked, although
Schichtplaner 5 refuses a database with a reference to a missing record; a
cycle assignment without end is read as open, while Schichtplaner 5 showed
no duties for one. See `docs/format.md`, sections 7 and 8.

### sp5lib

Added

- `sp5lib.schema`: the layout of all 30 tables and their journals, and
  `create_database` / `create_table` for new databases.
- `sp5lib.cdx_writer.read_cdx` reads index files; `sp5lib validate` checks
  every table and index of a database; `sp5lib create` makes an empty one.
- `SP5Database.insert`, `update`, `delete` by record key, `compact`, and
  accessors for all kinds of entries.
- Index files for tables of any size: trees with several levels and leaf
  entries sized for the number of records.
- `append_record(..., autoid_within=...)` numbers records per owner, as the
  original program does.
- `docs/format.md`, a description of the file format.

Changed, to match what the original program writes

- The index file of a table is always rebuilt after a write, and created if
  it is missing. Earlier versions deleted it by default; Schichtplaner 5
  does not open a database with a missing index file.
- The journal records a new record with `CHANGE` 0 (was 1); 1 is a changed
  record, 2 a deleted one.
- Every write raises the counter in the index header and the change counter
  of the database (`5BUILD.CHANGE`).
- `RESERVED` fields are written as zero bytes, empty text fields with their
  terminator.
- The date in the table header is no longer changed.
- Text fields are decoded by their terminator, which also reads text made
  up only of characters beyond U+07FF.
- The index is rebuilt while the table is locked. Concurrent writers could
  lose the index file before.

Removed

- `SP5Database` as the backend of the former web application: schedule
  views, statistics, conflict checks, user and password management, wishes,
  swap requests, templates, comments, iCal tokens and other data kept in
  JSON files next to the database. The new `SP5Database` covers the
  database itself.
- `sp5lib.orm`, `pg_database`, `sqlite_adapter`, `db_factory`, `db_config`,
  `auto_migrate` (mirror to SQLite and PostgreSQL) and `email_service`.
  The package has no dependencies any more.
- `sp5lib sync`.
- The switches `WRITE_CDX`, `INVALIDATE_CDX` and the environment variable
  `SP5_CDX_WRITE`.

Compatibility with 1.32

- Unchanged: `read_dbf`, `read_dbf_buffer`, `get_table_fields`,
  `append_record`, `update_record`, `delete_record`, `find_all_records`,
  `pack_table`, `build_cdx_bytes`, `write_cdx`, `bgr_to_hex`, `bgr_to_rgb`,
  `is_light_color` and all functions of `sp5lib.calculations`.
- `calculations.is_eligible_replacement` returns its reasons in English.
- Requires Python 3.11.

### sp5api

- New, small API: read endpoints for all tables and the common views, and
  optional write endpoints for single records. Read only unless enabled.
- Not carried over from the earlier API: login, sessions, two-factor
  authentication and roles, wishes and swap requests, iCal feeds,
  notifications and webhooks, e-mail, skills and qualification matrix,
  uploads, companies, reports and exports, scheduled reports, work time
  rule checks, automatic scheduling, the PostgreSQL mirror and the bundled
  web front end.
