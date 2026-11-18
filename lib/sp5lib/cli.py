"""Command line tools for Schichtplaner 5 databases.

sp5lib info     /path/to/data
sp5lib dump     /path/to/data 5EMPL [--json|--csv] [--limit N]
sp5lib validate /path/to/data
sp5lib create   /path/to/new/data
"""

import argparse
import csv
import json
import os
import sys
from typing import Any

from . import __version__
from .cdx_writer import _build_keys, _cdx_path, read_cdx
from .dbf_reader import _dedupe_names, get_table_fields, read_dbf, read_header
from .schema import JOURNAL_SUFFIX, TABLES, create_database, table_schema


def _dbf_files(db_dir: str) -> list[str]:
    try:
        return sorted(n for n in os.listdir(db_dir) if n.upper().endswith(".DBF"))
    except OSError:
        return []


def _resolve_table(db_dir: str, table: str) -> str | None:
    wanted = {table.upper(), "5" + table.upper()}
    for name in _dbf_files(db_dir):
        if os.path.splitext(name)[0].upper() in wanted:
            return os.path.join(db_dir, name)
    return None


def _plain(value: Any) -> Any:
    return value.hex() if isinstance(value, bytes) else value


def cmd_info(args: argparse.Namespace) -> int:
    files = _dbf_files(args.db_dir)
    if not files:
        print(f"No .DBF files in {args.db_dir}", file=sys.stderr)
        return 1
    print(f"{'table':<12} {'records':>8} {'deleted':>8} {'fields':>7}  last change")
    for name in files:
        if os.path.splitext(name)[0].upper().endswith(JOURNAL_SUFFIX) and not args.journals:
            continue
        path = os.path.join(args.db_dir, name)
        try:
            header = read_header(path)
        except (OSError, ValueError):
            print(f"{name:<12} unreadable")
            continue
        active = len(read_dbf(path))
        print(
            f"{os.path.splitext(name)[0]:<12} {active:>8} {header.record_count - active:>8} "
            f"{len(get_table_fields(path)):>7}  {header.last_update or '-'}"
        )
    return 0


def cmd_dump(args: argparse.Namespace) -> int:
    path = _resolve_table(args.db_dir, args.table)
    if path is None:
        print(f"Table {args.table} not found in {args.db_dir}", file=sys.stderr)
        return 1
    records = read_dbf(path)
    if args.limit is not None:
        records = records[: args.limit]
    if args.csv:
        names = _dedupe_names([str(f["name"]) for f in get_table_fields(path)])
        writer = csv.DictWriter(sys.stdout, fieldnames=names)
        writer.writeheader()
        for record in records:
            writer.writerow({k: _plain(v) for k, v in record.items()})
    else:
        json.dump(records, sys.stdout, ensure_ascii=False, indent=2, default=_plain)
        print()
    return 0


def _check_table(db_dir: str, name: str) -> list[str]:
    """Compare one table file with the expected layout and its index."""
    path = _resolve_table(db_dir, name)
    if path is None:
        return ["file missing"]
    schema = table_schema(name)
    try:
        header = read_header(path)
    except (OSError, ValueError) as exc:
        return [f"header unreadable: {exc}"]
    problems = []
    if get_table_fields(path) != schema.field_dicts():
        problems.append("fields differ from the SP5 5.0 layout")
    expected = header.header_size + header.record_count * header.record_size
    if os.path.getsize(path) not in (expected, expected + 1):
        problems.append(f"file size is not {expected + 1} bytes as the header implies")
    cdx = _cdx_path(path)
    if cdx is None:
        problems.append("no index file (SP5 recreates it)")
    else:
        try:
            index = read_cdx(cdx)
            if index.entries != _build_keys(path, index.key_expression):
                problems.append("index file does not match the records")
        except (OSError, ValueError) as exc:
            problems.append(f"index file unreadable: {exc}")
    return problems


def cmd_validate(args: argparse.Namespace) -> int:
    failed = 0
    names = [n for name in TABLES for n in (name, name + JOURNAL_SUFFIX)]
    for name in names:
        problems = _check_table(args.db_dir, name)
        failed += bool(problems)
        print(f"{'FAIL' if problems else 'ok':<5}{name:<10}{'; '.join(problems)}")
    print(f"\n{len(names) - failed} of {len(names)} tables without findings")
    return 1 if failed else 0


def cmd_create(args: argparse.Namespace) -> int:
    if _dbf_files(args.db_dir):
        print(f"{args.db_dir} already contains .DBF files", file=sys.stderr)
        return 1
    create_database(args.db_dir)
    print(f"Created {2 * len(TABLES)} empty tables in {args.db_dir}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="sp5lib", description="Inspect and check Schichtplaner 5 databases."
    )
    parser.add_argument("--version", action="version", version=f"sp5lib {__version__}")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("info", help="list the tables with record counts")
    p.add_argument("db_dir")
    p.add_argument("--journals", action="store_true", help="include the -L journal tables")
    p.set_defaults(func=cmd_info)

    p = sub.add_parser("dump", help="print the records of a table as JSON or CSV")
    p.add_argument("db_dir")
    p.add_argument("table", help="table name, for example 5EMPL or EMPL")
    fmt = p.add_mutually_exclusive_group()
    fmt.add_argument("--json", action="store_true", help="JSON output (default)")
    fmt.add_argument("--csv", action="store_true", help="CSV output")
    p.add_argument("--limit", type=int, help="print at most N records")
    p.set_defaults(func=cmd_dump)

    p = sub.add_parser("validate", help="check tables and index files against the SP5 layout")
    p.add_argument("db_dir")
    p.set_defaults(func=cmd_validate)

    p = sub.add_parser("create", help="create a new database with empty tables")
    p.add_argument("db_dir")
    p.set_defaults(func=cmd_create)

    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    sys.exit(main())
