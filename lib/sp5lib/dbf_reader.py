"""Reader for the dBASE III tables of a Schichtplaner 5 database.

SP5 stores text in character fields as UTF-16 LE, terminated by a zero code
unit and padded with spaces. A few character fields hold single-byte text or
raw bytes instead (see ``sp5lib.schema``).
"""

import struct
from dataclasses import dataclass
from datetime import date
from typing import Any

from .schema import ASCII_C_FIELDS, BINARY_C_FIELDS

__all__ = [
    "BINARY_C_FIELDS",
    "DbfHeader",
    "get_table_fields",
    "read_dbf",
    "read_dbf_buffer",
    "read_header",
]

Record = dict[str, Any]
FieldDict = dict[str, Any]
FieldSpec = tuple[str, str, int, int, bool, int]

DELETED = 0x2A


@dataclass(frozen=True)
class DbfHeader:
    """The fixed part of a table header."""

    version: int
    last_update: date | None
    record_count: int
    header_size: int
    record_size: int
    has_index: bool
    codepage: int


def _dedupe_names(names: list[str]) -> list[str]:
    """Make duplicate field names unique by position.

    The header of 5DADEM contains two fields called ``START``. Records are
    returned as dicts, so the second occurrence of a name gets a numeric
    suffix: the end of the period in 5DADEM is ``START2``. The writer uses
    the same convention.
    """
    seen: dict[str, int] = {}
    result = []
    for name in names:
        seen[name] = seen.get(name, 0) + 1
        result.append(name if seen[name] == 1 else f"{name}{seen[name]}")
    return result


def _is_utf16_le(raw: bytes) -> bool:
    """Guess whether raw field bytes are UTF-16 LE text.

    In UTF-16 LE the high byte of every code unit up to U+07FF is below 0x08,
    while single-byte data fields contain only printable bytes. Text made up
    only of characters from U+0800 on is not recognised.
    """
    if len(raw) < 4:
        return len(raw) >= 2 and raw[1] < 0x08
    odd_bytes = raw[1:8:2]
    high_count = sum(1 for b in odd_bytes if b < 0x08)
    return high_count > len(odd_bytes) // 2


def _terminator(raw: bytes) -> int:
    """Offset of the first zero code unit, or -1."""
    for i in range(0, len(raw) - 1, 2):
        if raw[i] == 0 and raw[i + 1] == 0:
            return i
    return -1


def _decode_string(raw: bytes) -> str:
    """Decode a character field without knowing its storage class."""
    if not raw:
        return ""
    if _is_utf16_le(raw):
        end = _terminator(raw)
        chunk = raw if end < 0 else raw[:end]
        try:
            return chunk.decode("utf-16-le").strip()
        except UnicodeDecodeError:
            pass
    return raw.rstrip(b"\x00\x20").decode("latin-1").strip()


def _decode_text(raw: bytes) -> str:
    """Decode a UTF-16 text field.

    The text ends at the terminator. A text that fills the field has none.
    A field without terminator that ends with a space was not written by
    SP5; it is taken as single-byte text if it looks like it.
    """
    end = _terminator(raw)
    if end >= 0:
        raw = raw[:end]
    elif raw.endswith(b"\x20"):
        return _decode_string(raw)
    return raw[: len(raw) & ~1].decode("utf-16-le", errors="replace").strip()


def _parse_date(raw: str) -> str | None:
    """Convert ``YYYYMMDD`` to an ISO date string, ``None`` if it is no date."""
    s = raw.strip()
    if len(s) == 8 and s.isdigit():
        try:
            year, month, day = int(s[:4]), int(s[4:6]), int(s[6:8])
            if year > 0:
                return date(year, month, day).isoformat()
        except ValueError:
            pass
    return None


def _compile_field_specs(fields: list[FieldDict], names: list[str]) -> list[FieldSpec]:
    """Precompute (key, type, length, decimals, is_binary, offset) per field."""
    specs: list[FieldSpec] = []
    offset = 1  # skip the deletion flag
    for field, fname in zip(fields, names, strict=True):
        flen = int(field["len"])
        specs.append(
            (
                fname,
                str(field["type"]),
                flen,
                int(field["dec"]),
                str(field["name"]) in BINARY_C_FIELDS,
                offset,
            )
        )
        offset += flen
    return specs


def _parse_record_specs(raw: bytes, specs: list[FieldSpec]) -> Record:
    """Decode one raw record with precomputed field specs."""
    record: Record = {}
    for fname, ftype, flen, fdec, is_binary, offset in specs:
        chunk = raw[offset : offset + flen]
        val: Any
        if ftype == "C":
            if is_binary:
                val = chunk
            elif fname in ASCII_C_FIELDS or fname.startswith("STARTEND"):
                val = chunk.rstrip(b"\x00\x20").decode("latin-1").strip()
            else:
                val = _decode_text(chunk)
        elif ftype == "D":
            val = _parse_date(chunk.decode("ascii", errors="replace"))
        elif ftype in ("N", "F"):
            s = chunk.decode("ascii", errors="replace").strip()
            try:
                val = float(s) if ftype == "F" or "." in s or fdec > 0 else int(s)
            except ValueError:
                val = 0
        elif ftype == "L":
            val = chunk[:1] in (b"T", b"t", b"Y", b"y", b"1")
        elif ftype == "M":
            val = None  # memo fields do not occur in SP5
        else:
            val = chunk.decode("ascii", errors="replace").strip()
        record[fname] = val
    return record


def _parse_record(raw: bytes, fields: list[FieldDict], names: list[str] | None = None) -> Record:
    """Decode one raw record given the field descriptors."""
    if names is None:
        names = _dedupe_names([str(f["name"]) for f in fields])
    return _parse_record_specs(raw, _compile_field_specs(fields, names))


def _parse_header(data: bytes) -> DbfHeader:
    if len(data) < 32:
        raise ValueError("truncated DBF header")
    count, header_size, record_size = struct.unpack_from("<IHH", data, 4)
    try:
        updated: date | None = date(
            1900 + data[1] if data[1] > 80 else 2000 + data[1], data[2], data[3]
        )
    except ValueError:
        updated = None
    return DbfHeader(
        data[0], updated, count, header_size, record_size, bool(data[28] & 1), data[29]
    )


def _parse_fields(data: bytes) -> list[FieldDict]:
    fields: list[FieldDict] = []
    pos = 32
    while pos + 32 <= len(data) and data[pos] != 0x0D:
        descriptor = data[pos : pos + 32]
        name = descriptor[:11].split(b"\x00")[0].decode("ascii", errors="replace").strip()
        fields.append(
            {
                "name": name,
                "type": chr(descriptor[11]),
                "len": descriptor[16],
                "dec": descriptor[17],
            }
        )
        pos += 32
    return fields


def read_header(filepath: str) -> DbfHeader:
    """Read the header of a table. Raises ``OSError`` or ``ValueError``."""
    with open(filepath, "rb") as f:
        return _parse_header(f.read(32))


def get_table_fields(filepath: str) -> list[FieldDict]:
    """Return the field descriptors of a table as dicts with the keys
    ``name``, ``type``, ``len`` and ``dec``; an empty list if unreadable."""
    try:
        with open(filepath, "rb") as f:
            head = f.read(32)
            if len(head) < 32:
                return []
            header_size = struct.unpack_from("<H", head, 8)[0]
            return _parse_fields(head + f.read(max(header_size - 32, 0)))
    except OSError:
        return []


def read_dbf(filepath: str, encoding_hint: str = "utf-16-le") -> list[Record]:
    """Read all records of a table that are not marked as deleted.

    Dates are ISO strings (``None`` if empty), N fields ``int``, F fields
    ``float``, text ``str`` and binary fields ``bytes``. Returns an empty list
    if the file is missing or damaged. *encoding_hint* is ignored and only
    kept for compatibility.
    """
    try:
        with open(filepath, "rb") as f:
            data = f.read()
    except OSError:
        return []
    return read_dbf_buffer(data)


def read_dbf_buffer(data: bytes) -> list[Record]:
    """Like :func:`read_dbf` for the content of a table already in memory."""
    if len(data) < 32:
        return []
    header = _parse_header(data)
    fields = _parse_fields(data[: header.header_size])
    specs = _compile_field_specs(fields, _dedupe_names([str(f["name"]) for f in fields]))
    records = []
    size = header.record_size
    for i in range(header.record_count):
        raw = data[header.header_size + i * size : header.header_size + (i + 1) * size]
        if len(raw) < size or size == 0:
            break
        if raw[0] != DELETED:
            records.append(_parse_record_specs(raw, specs))
    return records
