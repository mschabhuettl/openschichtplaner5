# OpenSchichtplaner5

[![CI](https://github.com/mschabhuettl/openschichtplaner5/actions/workflows/ci.yml/badge.svg)](https://github.com/mschabhuettl/openschichtplaner5/actions/workflows/ci.yml)

Read and write the database files of **Schichtplaner 5**, the Windows shift
planning program by RPS Planungssysteme, from Python and over HTTP.

Schichtplaner 5 keeps its data in a directory of dBASE tables (`5EMPL.DBF`,
`5SHIFT.DBF`, ...) with FoxPro index files. This repository contains two
Python packages for that format:

| Package | Distribution | What it is |
|---|---|---|
| `sp5lib` | `libopenschichtplaner5` | The library: reads and writes tables, index files and change journals. Standard library only. |
| `sp5api` | `openschichtplaner5-api` | A small REST API on top of `sp5lib` (FastAPI). |

and a description of the file format: [docs/format.md](docs/format.md).

This is an independent project. It is not affiliated with, endorsed by or
supported by RPS Planungssysteme GmbH. "Schichtplaner" is a product name of
its owner and is used here only to say what the software works with. The
project contains no code, files or data of the original program.

## Status

- Tested against Schichtplaner 5.0.13 and the sample database it ships with.
- Reading: all 30 tables, their journals and index files.
- Writing: adding, changing and deleting records, including index, journal
  and change counter. For the cases compared so far the files are byte for
  byte what Schichtplaner 5 writes itself, and Schichtplaner 5 opens the
  changed database. See "Writing" below for the limits.
- Python 3.11 or newer.

## Install

The packages are not on PyPI. Install the wheels attached to a
[release](https://github.com/mschabhuettl/openschichtplaner5/releases), or
straight from the repository:

```sh
# the library only
pip install "libopenschichtplaner5 @ git+https://github.com/mschabhuettl/openschichtplaner5#subdirectory=lib"

# the API (needs the library)
pip install "libopenschichtplaner5 @ git+https://github.com/mschabhuettl/openschichtplaner5#subdirectory=lib" \
            "openschichtplaner5-api @ git+https://github.com/mschabhuettl/openschichtplaner5#subdirectory=api"
```

## The library

```python
from sp5lib.database import SP5Database

db = SP5Database("/path/to/Daten")

for employee in db.get_employees():
    print(employee["ID"], employee["NAME"], employee["FIRSTNAME"])

shifts = {s["ID"]: s for s in db.get_shifts(include_hidden=True)}
for duty in db.get_duties("2024-01-01", "2024-01-31"):
    print(duty["DATE"], duty["EMPLOYEEID"], shifts[duty["SHIFTID"]]["SHORTNAME"])

# any table as a list of dicts
holidays = db.read("5HOLID")
```

Records are dicts keyed by the field names of the tables. Dates are ISO
strings (`None` if unset), numbers `int` or `float`, colours integers
(`sp5lib.color_utils.bgr_to_hex` converts them). What the fields mean is
described in [docs/format.md](docs/format.md).

Modules:

| Module | Content |
|---|---|
| `sp5lib.database` | `SP5Database`: accessors for employees, groups, shifts, duties, absences and so on; `insert`, `update`, `delete`, `compact` |
| `sp5lib.schema` | the layout of all tables; `create_database`, `create_table` |
| `sp5lib.dbf_reader` | `read_dbf`, `get_table_fields`, `read_header` |
| `sp5lib.dbf_writer` | `append_record`, `update_record`, `delete_record`, `pack_table`, `find_all_records` |
| `sp5lib.cdx_writer` | `read_cdx`, `write_cdx`, `build_cdx` for the index files |
| `sp5lib.calculations` | working time arithmetic on the records: nominal and actual hours, absence accounts, surcharges, shift cycles |
| `sp5lib.color_utils` | colour conversion |

### Writing

```python
employee = db.get_employees()[0]["ID"]
number = db.insert("MASHI", {"EMPLOYEEID": employee, "DATE": "2024-02-01", "SHIFTID": 1})
db.update("MASHI", (number, employee), {"SHIFTID": 2})
db.delete("MASHI", (number, employee))
```

Master data tables are keyed by `ID`. The other tables number their records
per employee, group, user or cycle, so their key is a tuple;
`db.schema("MASHI").key_fields` names its parts.

Please note:

- Make a backup first. The write path was checked against the original
  program for adding and deleting duties, for changing a shift and for
  index files of large tables; other tables go through the same code but
  were not each checked.
- Refer only to records that exist. Schichtplaner 5 refuses to open a
  database in which, for example, an absence names a missing leave type.
  The library does not check this.
- Do not write while Schichtplaner 5 is changing the same database. The
  library does not take part in the file locks of the original program.
- The library does not check that a record makes sense (that a shift or
  employee exists, that a day has only one duty). It writes what it is given.

### Command line

```sh
sp5lib info /path/to/Daten                 # tables, record counts, last change
sp5lib dump /path/to/Daten 5EMPL           # records as JSON
sp5lib dump /path/to/Daten SHIFT --csv     # or CSV
sp5lib validate /path/to/Daten             # layout and index of every table
sp5lib create /path/to/new                 # a new database with empty tables
```

## The API

```sh
sp5api /path/to/Daten                      # http://127.0.0.1:8000, read only
sp5api /path/to/Daten --write              # with the write endpoints
```

or with Docker:

```sh
docker build -t sp5api .
docker run --rm -p 8000:8000 -v /path/to/Daten:/data:ro sp5api
```

Interactive documentation of all endpoints is at `/docs`. The main ones:

| Endpoint | Returns |
|---|---|
| `GET /api/health` | status and versions |
| `GET /api/tables`, `/api/tables/{table}`, `/api/tables/{table}/{key}` | every table, raw |
| `GET /api/employees`, `/groups`, `/shifts`, `/leave-types`, `/workplaces`, `/holidays`, `/cycles`, `/extracharges` | master data |
| `GET /api/duties`, `/absences`, `/special-shifts`, `/notes`, `/overtimes`, `/bookings`, `/periods` | entries, filtered with `start`, `end`, `employee_id` |
| `GET /api/schedule?start=&end=` | all entries of a period; `include_cycles=true` adds the duties from shift cycles |
| `POST /api/tables/{table}`, `PUT` and `DELETE /api/tables/{table}/{key}` | add, change, delete a record (only with `--write`) |

Settings, as environment variables: `SP5_DB_PATH` (the database directory),
`SP5_API_TOKEN` (if set, requests need `Authorization: Bearer <token>`),
`SP5_READONLY=0` (enable writing). The API has no user management. It never
returns password digests and does not write the user table. The notes on
writing above apply to the write endpoints as well: deleting a record that
others refer to can leave a database that Schichtplaner 5 refuses to open.
Put it behind a
reverse proxy with TLS if it is reachable from other machines.

## Development

```sh
python -m venv .venv && . .venv/bin/activate
pip install -e ./lib -e ./api -r requirements-dev.txt
ruff check . && ruff format --check . && mypy lib/sp5lib api/sp5api
pytest
```

The tests generate their own database with invented content
(`tests/sp5gen.py`). To also run the checks against the sample database of
the original program, install or unpack Schichtplaner 5.0.13 and point
`SP5_SAMPLE_DB` to its data directory:

```sh
SP5_SAMPLE_DB=/path/to/sample pytest
```

No file of the original program is part of this repository, and none may be
added.

## Deutsch

OpenSchichtplaner5 liest und schreibt die Datenbankdateien von
Schichtplaner 5 (RPS Planungssysteme). Das Repository enthält zwei
Python-Pakete: die Bibliothek `sp5lib` (Tabellen, Indexdateien und
Änderungsjournale lesen und schreiben, ohne weitere Abhängigkeiten) und die
REST-API `sp5api`, die darauf aufbaut. Das Dateiformat ist in
[docs/format.md](docs/format.md) beschrieben (englisch).

Das Projekt ist unabhängig und steht in keiner Verbindung zur RPS
Planungssysteme GmbH. Vor dem Schreiben in eine echte Datenbank bitte eine
Sicherung anlegen und nicht schreiben, während Schichtplaner 5 dieselbe
Datenbank ändert.

## License

MIT, see [LICENSE](LICENSE).
