"""Write support for the tables of a Schichtplaner 5 database.

Functions:
  append_record(filepath, fields, record)       append a record
  update_record(filepath, fields, index, data)  overwrite fields of a record
  delete_record(filepath, fields, index)        mark a record as deleted
  pack_table(filepath)                          remove deleted records
  find_all_records(filepath, fields, **filters) find records with their index

Field encoding (see ``docs/format.md``):
  * text (C):    UTF-16 LE, a zero code unit as terminator, padded with spaces
  * ascii (C):   single-byte text padded with spaces
  * binary (C):  raw bytes padded with zero bytes
  * RESERVED:    zero bytes
  * date (D):    ``YYYYMMDD``, spaces if empty
  * numeric (N): right-aligned decimal integer
  * float (F):   right-aligned decimal number with four decimals

Every change is also recorded in the journal table (``<table>-L.DBF``) the
way SP5 does it, so that running SP5 clients notice the change.

The index file (``.CDX``) of a changed table is rebuilt after every write.
If it cannot be rebuilt it is deleted; SP5 recreates missing index files
when it opens the database. Set ``WRITE_CDX = False`` to always delete.

Locking: every write holds an exclusive ``flock`` on the file (POSIX only;
there is no locking on other platforms). SP5 itself uses byte-range locks
that this module does not take part in, so do not write while an SP5 client
has the database open.
"""

import logging
import os
import struct
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import date
from typing import IO, Any

from .dbf_reader import (
    DELETED,
    FieldDict,
    Record,
    _compile_field_specs,
    _dedupe_names,
    _parse_record,
    _parse_record_specs,
    get_table_fields,
)
from .schema import ASCII_C_FIELDS, JOURNAL_SUFFIX, TABLES

try:
    import fcntl
except ImportError:  # not available on Windows
    fcntl = None  # type: ignore[assignment]

__all__ = [
    "append_record",
    "delete_record",
    "find_all_records",
    "get_table_fields",
    "pack_table",
    "update_record",
]

logger = logging.getLogger(__name__)

#: Rebuild the .CDX of a table after a write (``SP5_CDX_WRITE=0`` turns it off).
WRITE_CDX = os.environ.get("SP5_CDX_WRITE", "1") != "0"
#: Delete the .CDX after a write if it was not rebuilt, so that SP5 recreates it.
INVALIDATE_CDX = True

JOURNAL_CHANGED = 1
JOURNAL_DELETED = 2


def _is_ascii_c_field(name: str) -> bool:
    return name in ASCII_C_FIELDS or name.startswith("STARTEND")


# --- field encoding ---


def _encode_string(value: str, field_len: int) -> bytes:
    """Encode text as UTF-16 LE + terminator + spaces, cut to the field length."""
    if field_len < 2:
        return b"\x00" * max(field_len, 0)
    encoded = value.encode("utf-16-le") if value else b""
    capacity = (field_len - 2) & ~1
    if len(encoded) > capacity:
        logger.warning(
            "text of %d characters cut to the field capacity of %d", len(value), capacity // 2
        )
        encoded = encoded[:capacity]
    return (encoded + b"\x00\x00").ljust(field_len, b"\x20")


def _encode_field(value: Any, field: FieldDict) -> bytes:
    """Encode one value according to its field descriptor."""
    ftype = field["type"]
    flen = field["len"]
    name = field.get("name", "")

    if ftype == "C":
        if isinstance(value, bytes):
            return value.ljust(flen, b"\x00")[:flen]
        if name == "RESERVED" and not value:
            return b"\x00" * flen
        if _is_ascii_c_field(name):
            encoded = str(value or "").encode("cp1252", errors="replace")
            if len(encoded) > flen:
                logger.warning("value of field %s cut to %d bytes", name, flen)
            return encoded.ljust(flen, b"\x20")[:flen]
        return _encode_string(str(value or ""), flen)

    if value is None:
        return b" " * flen

    if ftype == "D":
        s = value.isoformat() if isinstance(value, date) else str(value).strip()
        s = s[:10].replace("-", "")
        if len(s) == 8 and s.isdigit():
            return s.encode("ascii").ljust(flen)[:flen]
        return b" " * flen

    if ftype in ("N", "F"):
        try:
            if ftype == "F":
                # F fields always carry four decimals although the
                # descriptor declares none.
                s = f"{float(value):>{flen}.4f}"
            elif field["dec"] > 0:
                s = f"{float(value):>{flen}.{field['dec']}f}"
            else:
                s = f"{int(float(value)):>{flen}d}"
        except (ValueError, TypeError):
            return b" " * flen
        if len(s) > flen:
            raise ValueError(
                f"Numeric value {value!r} does not fit field {name or '?'} (len={flen})"
            )
        return s.encode("ascii")

    if ftype == "L":
        return b"T" if value else b"F"
    if ftype == "M":
        return b" " * flen
    return str(value).ljust(flen).encode("ascii", errors="replace")[:flen]


def _encode_record(record: Record, fields: list[FieldDict], names: list[str]) -> bytes:
    row = bytearray(b"\x20")
    for field, fname in zip(fields, names, strict=True):
        row += _encode_field(record.get(fname), field)
    return bytes(row)


# --- header and locking ---


def _read_header_info(filepath: str) -> tuple[int, int, int]:
    """Return (record count, header size, record size)."""
    with open(filepath, "rb") as f:
        hdr = f.read(32)
    if len(hdr) < 32:
        raise ValueError(f"Truncated DBF header: {filepath}")
    return struct.unpack_from("<IHH", hdr, 4)


def _stamp_header(f: IO[bytes]) -> None:
    today = date.today()
    f.seek(1)
    f.write(bytes([today.year % 100, today.month, today.day]))


def _update_record_count(f: IO[bytes], new_count: int) -> None:
    f.seek(4)
    f.write(struct.pack("<I", new_count))


@contextmanager
def _locked(filepath: str, mode: str) -> Iterator[IO[bytes]]:
    """Open a file and hold a lock on it: exclusive for writing, shared for reading."""
    with open(filepath, mode) as f:
        if fcntl is not None:
            fcntl.flock(f.fileno(), fcntl.LOCK_SH if mode == "rb" else fcntl.LOCK_EX)
        try:
            yield f
        finally:
            if fcntl is not None:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)


def _exclusive_open(filepath: str) -> Any:
    return _locked(filepath, "r+b")


# --- journal and index upkeep ---


def _table_stem(filepath: str) -> str:
    return os.path.splitext(os.path.basename(filepath))[0].upper()


def _is_journal_file(filepath: str) -> bool:
    return _table_stem(filepath).endswith(JOURNAL_SUFFIX)


def _journal_path(filepath: str) -> str | None:
    base, ext = os.path.splitext(filepath)
    for suffix in (JOURNAL_SUFFIX, JOURNAL_SUFFIX.lower()):
        if os.path.exists(base + suffix + ext):
            return base + suffix + ext
    return None


def _invalidate_cdx(filepath: str) -> None:
    """Bring the index file in line with the table: rebuild it, else delete it."""
    if WRITE_CDX:
        from . import cdx_writer

        try:
            if cdx_writer.write_cdx(filepath) is not None:
                return
        except (ValueError, OSError) as exc:
            logger.warning("index of %s not rebuilt (%s), deleting it", filepath, exc)
    if not INVALIDATE_CDX:
        return
    base = os.path.splitext(filepath)[0]
    for ext in (".CDX", ".cdx"):
        if os.path.exists(base + ext):
            try:
                os.remove(base + ext)
            except OSError as exc:
                logger.warning("could not remove stale index %s: %s", base + ext, exc)


def _append_journal(filepath: str, record: Record, change: int) -> None:
    """Record a change in the journal table.

    The journal row identifies the record by the fields of the table's index
    key (``CHANGEID1`` to ``CHANGEID3``, unused ones 0).
    """
    jpath = _journal_path(filepath)
    if jpath is None:
        logger.warning("no journal table for %s, change not recorded", filepath)
        return
    table = TABLES.get(_table_stem(filepath))
    keys = table.key_fields if table else ("ID",)
    ids = [int(record.get(k) or 0) for k in keys] + [0, 0]
    row = {
        "NUMBER": 0,
        "CHANGEID1": ids[0],
        "CHANGEID2": ids[1],
        "CHANGEID3": ids[2],
        "CHANGE": change,
    }
    try:
        append_record(jpath, get_table_fields(jpath), row, autoid_field="NUMBER")
    except (OSError, ValueError) as exc:
        logger.warning("journal %s not writable (%s), change not recorded", jpath, exc)


def _after_write(filepath: str, record: Record, change: int) -> None:
    if not _is_journal_file(filepath):
        _append_journal(filepath, record, change)
    _invalidate_cdx(filepath)


# --- public API ---


def _max_id_under_lock(
    f: IO[bytes],
    names: list[str],
    fields: list[FieldDict],
    header_size: int,
    record_size: int,
    num_records: int,
    id_field: str,
    within: Record,
) -> int:
    """Highest value of *id_field* over the records that are not deleted and
    whose fields equal *within*."""
    if id_field not in names:
        raise ValueError(f"autoid field {id_field!r} not present in fields list")
    specs = [s for s in _compile_field_specs(fields, names) if s[0] == id_field or s[0] in within]
    f.seek(header_size)
    area = f.read(num_records * record_size)
    max_id = 0
    for i in range(num_records):
        rec = area[i * record_size : (i + 1) * record_size]
        if len(rec) < record_size or rec[0] == DELETED:
            continue
        values = _parse_record_specs(rec, specs)
        if _matches(values, within):
            max_id = max(max_id, int(values[id_field]))
    return max_id


def append_record(
    filepath: str,
    fields: list[FieldDict],
    record: Record,
    autoid_field: str | None = None,
    autoid_within: tuple[str, ...] = (),
) -> int:
    """Append *record* to the table and return the new record count.

    *fields* are the descriptors from :func:`get_table_fields`. Fields
    missing in *record* are written blank. With *autoid_field* the value of
    that field is set to the highest existing value plus one while the file
    is locked, and written back into *record*. *autoid_within* names fields
    that limit the search to records with the same values as *record*, for
    tables that number their records per employee, group or other owner.
    """
    names = _dedupe_names([str(f["name"]) for f in fields])
    _, header_size, record_size = _read_header_info(filepath)

    with _exclusive_open(filepath) as f:
        f.seek(4)
        num_records = struct.unpack("<I", f.read(4))[0]
        if autoid_field is not None:
            record[autoid_field] = (
                _max_id_under_lock(
                    f,
                    names,
                    fields,
                    header_size,
                    record_size,
                    num_records,
                    autoid_field,
                    {k: record.get(k) for k in autoid_within},
                )
                + 1
            )
        row = _encode_record(record, fields, names)
        if len(row) > record_size:
            raise ValueError(
                f"Record size mismatch for {filepath}: encoded row is {len(row)} bytes, "
                f"header says record_size={record_size}"
            )
        row = row.ljust(record_size, b"\x20")

        # Records end before the end-of-file marker; cutting there also
        # repairs a file with a missing marker or trailing garbage.
        write_pos = header_size + num_records * record_size
        f.seek(write_pos)
        try:
            f.write(row + b"\x1a")
            f.truncate()
            _update_record_count(f, num_records + 1)
            _stamp_header(f)
        except Exception:
            f.seek(write_pos)
            f.write(b"\x1a")
            f.truncate()
            raise

    _after_write(filepath, record, JOURNAL_CHANGED)
    return num_records + 1


def _record_offset(filepath: str, record_index: int) -> tuple[int, int]:
    num_records, header_size, record_size = _read_header_info(filepath)
    if not 0 <= record_index < num_records:
        raise IndexError(
            f"record_index {record_index} out of range (file has {num_records} records)"
        )
    return header_size + record_index * record_size, record_size


def delete_record(filepath: str, fields: list[FieldDict], record_index: int) -> None:
    """Mark the record at *record_index* as deleted.

    *record_index* is the zero-based position in the file, counting deleted
    records, as returned by :func:`find_all_records`.
    """
    offset, record_size = _record_offset(filepath, record_index)
    with _exclusive_open(filepath) as f:
        f.seek(offset)
        raw = f.read(record_size)
        if raw[0] == DELETED:
            return
        f.seek(offset)
        f.write(bytes([DELETED]))
        _stamp_header(f)
    _after_write(filepath, _parse_record(raw, fields), JOURNAL_DELETED)


def update_record(filepath: str, fields: list[FieldDict], record_index: int, data: Record) -> None:
    """Overwrite the fields listed in *data* of the record at *record_index*.

    All other fields keep their bytes. Raises ``ValueError`` if the record
    is deleted.
    """
    offset, record_size = _record_offset(filepath, record_index)
    names = _dedupe_names([str(f["name"]) for f in fields])
    with _exclusive_open(filepath) as f:
        f.seek(offset)
        raw = bytearray(f.read(record_size))
        if raw[0] == DELETED:
            raise ValueError(f"Record {record_index} is already deleted")
        pos = 1
        for field, fname in zip(fields, names, strict=True):
            if fname in data:
                raw[pos : pos + field["len"]] = _encode_field(data[fname], field)
            pos += field["len"]
        f.seek(offset)
        f.write(bytes(raw))
        _stamp_header(f)
    _after_write(filepath, _parse_record(bytes(raw), fields), JOURNAL_CHANGED)


def _zap_journal(filepath: str) -> None:
    """Empty the journal of a table, which makes SP5 clients reload it fully."""
    jpath = _journal_path(filepath)
    if jpath is None:
        return
    header_size = _read_header_info(jpath)[1]
    with _exclusive_open(jpath) as f:
        f.seek(header_size)
        f.write(b"\x1a")
        f.truncate()
        _update_record_count(f, 0)
        _stamp_header(f)
    _invalidate_cdx(jpath)


def pack_table(filepath: str) -> int:
    """Physically remove the deleted records and return how many there were.

    Record positions change, so the journal of the table is emptied and the
    index rebuilt. A table without deleted records is left untouched.
    """
    _, header_size, record_size = _read_header_info(filepath)
    if record_size <= 0:
        return 0
    with _exclusive_open(filepath) as f:
        f.seek(4)
        num_records = struct.unpack("<I", f.read(4))[0]
        f.seek(header_size)
        area = f.read(num_records * record_size)
        records = [area[i : i + record_size] for i in range(0, len(area), record_size)]
        kept = [r for r in records if len(r) == record_size and r[0] != DELETED]
        removed = num_records - len(kept)
        if removed == 0:
            return 0
        f.seek(header_size)
        f.write(b"".join(kept) + b"\x1a")
        f.truncate()
        _update_record_count(f, len(kept))
        _stamp_header(f)

    if not _is_journal_file(filepath):
        _zap_journal(filepath)
    _invalidate_cdx(filepath)
    return removed


def find_all_records(
    filepath: str, fields: list[FieldDict] | None = None, **filters: Any
) -> list[tuple[int, Record]]:
    """Return ``(record_index, record)`` for every record that is not deleted
    and whose fields equal all *filters*.

    *record_index* is the zero-based position in the file, counting deleted
    records; pass it to :func:`update_record` or :func:`delete_record`.
    Returns an empty list if the file is missing or unreadable.
    """
    if fields is None:
        fields = get_table_fields(filepath)
    try:
        num_records, header_size, record_size = _read_header_info(filepath)
    except (OSError, ValueError):
        return []
    specs = _compile_field_specs(fields, _dedupe_names([str(f["name"]) for f in fields]))
    results: list[tuple[int, Record]] = []
    try:
        with _locked(filepath, "rb") as f:
            f.seek(header_size)
            for raw_idx in range(num_records):
                raw = f.read(record_size)
                if len(raw) < record_size:
                    break
                if raw[0] == DELETED:
                    continue
                record = _parse_record_specs(raw, specs)
                if _matches(record, filters):
                    results.append((raw_idx, record))
    except OSError:
        return []
    return results


def _matches(record: Record, filters: Record) -> bool:
    return all(record.get(key) == expected for key, expected in filters.items())
