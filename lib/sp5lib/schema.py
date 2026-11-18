"""Table layout of a Schichtplaner 5 database and creation of empty tables.

A database is a directory with 30 dBASE III tables (``5EMPL.DBF`` ...), each
with a change journal (``5EMPL-L.DBF``) and one compound index file (``.CDX``)
per table. The layout below was taken from the sample database that ships
with Schichtplaner 5.0.13. See ``docs/format.md`` for the meaning of the
fields.
"""

import os
import struct
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from typing import Any

#: C fields holding plain single-byte text (space-separated lists, times).
ASCII_C_FIELDS = frozenset({"WORKDAYS", "VALIDDAYS", "DAILYDEM", "CATEGORY", "REPORT"})
#: C fields holding raw bytes.
BINARY_C_FIELDS = frozenset({"DIGEST", "CREATIME", "UUID"})

FOR_EXPRESSION = ".NOT. DELETED()"
TABLE_TAG = "ID_TAG"
JOURNAL_TAG = "NUMBER_TAG"
JOURNAL_KEY = "NUMBER"
JOURNAL_SUFFIX = "-L"


@dataclass(frozen=True)
class Field:
    """One column of a table."""

    name: str
    type: str  # "N" numeric, "C" character, "D" date, "F" float
    length: int

    @property
    def kind(self) -> str:
        """Storage class: ``number``, ``float``, ``date``, ``text`` (UTF-16),
        ``ascii`` (single-byte text), ``binary`` or ``reserved``."""
        if self.type == "C":
            if self.name in BINARY_C_FIELDS:
                return "binary"
            if self.name == "RESERVED":
                return "reserved"
            if self.name in ASCII_C_FIELDS or self.name.startswith("STARTEND"):
                return "ascii"
            return "text"
        return {"N": "number", "F": "float", "D": "date"}[self.type]

    def as_dict(self) -> dict[str, Any]:
        """Field descriptor in the form used by ``dbf_reader`` and ``dbf_writer``."""
        return {"name": self.name, "type": self.type, "len": self.length, "dec": 0}


@dataclass(frozen=True)
class Table:
    """One table: its name, fields and the key expression of its index tag."""

    name: str
    key_expression: str
    fields: tuple[Field, ...]
    tag: str = TABLE_TAG

    @property
    def key_fields(self) -> tuple[str, ...]:
        """Fields of the index key, which also identify a record in the journal."""
        if "(" not in self.key_expression:
            return (self.key_expression,)
        return tuple(term[4:].split(",")[0] for term in self.key_expression.split("+"))

    @property
    def record_size(self) -> int:
        return 1 + sum(f.length for f in self.fields)

    @property
    def header_size(self) -> int:
        return 32 + 32 * len(self.fields) + 1

    def field_dicts(self) -> list[dict[str, Any]]:
        return [f.as_dict() for f in self.fields]

    def new_record(self, values: dict[str, Any]) -> dict[str, Any]:
        """A complete record: *values* plus the empty value of every other
        field as SP5 writes it (0, empty text, no date).

        The second of two fields with the same name gets the suffix ``2``.
        Raises ``KeyError`` for a name that is not a field of the table.
        """
        defaults: dict[str, Any] = {"number": 0, "float": 0.0, "date": None, "binary": b""}
        record: dict[str, Any] = {}
        for field in self.fields:
            key = f"{field.name}2" if field.name in record else field.name
            record[key] = values.get(key, defaults.get(field.kind, ""))
        unknown = set(values) - set(record)
        if unknown:
            raise KeyError(f"{self.name} has no field {sorted(unknown)[0]}")
        return record


_LAYOUT: dict[str, tuple[str, tuple[tuple[str, str, int], ...]]] = {
    "5ABSEN": (
        "STR(ID,11)+STR(EMPLOYEEID,11)",
        (
            ("ID", "N", 11),
            ("EMPLOYEEID", "N", 11),
            ("DATE", "D", 8),
            ("LEAVETYPID", "N", 11),
            ("TYPE", "N", 5),
            ("INTERVAL", "N", 5),
            ("START", "N", 5),
            ("END", "N", 5),
            ("RESERVED", "C", 20),
        ),
    ),
    "5BOOK": (
        "STR(ID,11)+STR(EMPLOYEEID,11)",
        (
            ("ID", "N", 11),
            ("EMPLOYEEID", "N", 11),
            ("DATE", "D", 8),
            ("TYPE", "N", 5),
            ("VALUE", "F", 19),
            ("NOTE", "C", 200),
            ("RESERVED", "C", 20),
        ),
    ),
    "5BUILD": (
        "ID",
        (
            ("ID", "N", 11),
            ("BUILD", "N", 11),
            ("CHANGE", "N", 11),
            ("CREATIME", "C", 8),
            ("UUID", "C", 16),
            ("HELPER", "N", 11),
            ("RESERVED", "C", 200),
        ),
    ),
    "5CYASS": (
        "STR(ID,11)+STR(EMPLOYEEID,11)",
        (
            ("ID", "N", 11),
            ("EMPLOYEEID", "N", 11),
            ("CYCLEID", "N", 11),
            ("START", "D", 8),
            ("END", "D", 8),
            ("ENTRANCE", "N", 5),
            ("RESERVED", "C", 20),
        ),
    ),
    "5CYCLE": (
        "ID",
        (
            ("ID", "N", 11),
            ("NAME", "C", 200),
            ("POSITION", "N", 11),
            ("SIZE", "N", 5),
            ("UNIT", "N", 5),
            ("HIDE", "N", 1),
            ("RESERVED", "C", 200),
        ),
    ),
    "5CYENT": (
        "STR(ID,11)+STR(CYCLEEID,11)",
        (
            ("ID", "N", 11),
            ("CYCLEEID", "N", 11),
            ("INDEX", "N", 5),
            ("SHIFTID", "N", 11),
            ("WORKPLACID", "N", 11),
            ("RESERVED", "C", 20),
        ),
    ),
    "5CYEXC": (
        "STR(ID,11)+STR(EMPLOYEEID,11)+STR(CYCLEASSID,11)",
        (
            ("ID", "N", 11),
            ("EMPLOYEEID", "N", 11),
            ("CYCLEASSID", "N", 11),
            ("DATE", "D", 8),
            ("TYPE", "N", 5),
            ("RESERVED", "C", 20),
        ),
    ),
    "5DADEM": (
        "STR(ID,11)+STR(GROUPID,11)",
        (
            ("ID", "N", 11),
            ("GROUPID", "N", 11),
            ("START", "D", 8),
            ("START", "D", 8),
            ("DAILYDEM", "C", 48),
            ("DESCRIPT", "C", 200),
            ("RESERVED", "C", 20),
        ),
    ),
    "5EMACC": (
        "STR(ID,11)+STR(USERID,11)",
        (
            ("ID", "N", 11),
            ("USERID", "N", 11),
            ("EMPLOYEEID", "N", 11),
            ("RIGHTS", "N", 5),
            ("RESERVED", "C", 20),
        ),
    ),
    "5EMPL": (
        "ID",
        (
            ("ID", "N", 11),
            ("POSITION", "N", 11),
            ("NUMBER", "C", 60),
            ("NAME", "C", 200),
            ("FIRSTNAME", "C", 60),
            ("SHORTNAME", "C", 60),
            ("SALUTATION", "C", 100),
            ("STREET", "C", 100),
            ("ZIP", "C", 60),
            ("TOWN", "C", 60),
            ("PHONE", "C", 200),
            ("EMAIL", "C", 200),
            ("PHOTO", "C", 200),
            ("FUNCTION", "C", 200),
            ("ARBITR1", "C", 200),
            ("ARBITR2", "C", 200),
            ("ARBITR3", "C", 200),
            ("SEX", "N", 5),
            ("BIRTHDAY", "D", 8),
            ("EMPSTART", "D", 8),
            ("EMPEND", "D", 8),
            ("CALCBASE", "N", 5),
            ("HRSDAY", "F", 19),
            ("HRSWEEK", "F", 19),
            ("HRSMONTH", "F", 19),
            ("HRSTOTAL", "F", 19),
            ("WORKDAYS", "C", 16),
            ("DEDUCTHOL", "N", 1),
            ("CFGLABEL", "N", 11),
            ("CBKLABEL", "N", 11),
            ("CBKSCHED", "N", 11),
            ("BOLD", "N", 1),
            ("HIDE", "N", 1),
            ("NOTE1", "C", 252),
            ("NOTE2", "C", 252),
            ("NOTE3", "C", 252),
            ("NOTE4", "C", 252),
            ("RESERVED", "C", 200),
        ),
    ),
    "5GRACC": (
        "STR(ID,11)+STR(USERID,11)",
        (
            ("ID", "N", 11),
            ("USERID", "N", 11),
            ("GROUPID", "N", 11),
            ("RIGHTS", "N", 5),
            ("RESERVED", "C", 20),
        ),
    ),
    "5GRASG": (
        "STR(ID,11)+STR(EMPLOYEEID,11)",
        (
            ("ID", "N", 11),
            ("EMPLOYEEID", "N", 11),
            ("GROUPID", "N", 11),
            ("RESERVED", "C", 20),
        ),
    ),
    "5GROUP": (
        "ID",
        (
            ("ID", "N", 11),
            ("NAME", "C", 200),
            ("SHORTNAME", "C", 200),
            ("ARBITR", "C", 200),
            ("SUPERID", "N", 11),
            ("POSITION", "N", 11),
            ("DAILYDEM", "C", 48),
            ("CFGLABEL", "N", 11),
            ("CBKLABEL", "N", 11),
            ("CBKSCHED", "N", 11),
            ("BOLD", "N", 1),
            ("HIDE", "N", 1),
            ("RESERVED", "C", 200),
        ),
    ),
    "5HOBAN": (
        "STR(ID,11)+STR(GROUPID,11)",
        (
            ("ID", "N", 11),
            ("GROUPID", "N", 11),
            ("START", "D", 8),
            ("END", "D", 8),
            ("RESTRICT", "N", 11),
            ("DESCRIPT", "C", 200),
            ("RESERVED", "C", 20),
        ),
    ),
    "5HOLID": (
        "ID",
        (
            ("ID", "N", 11),
            ("DATE", "D", 8),
            ("NAME", "C", 200),
            ("INTERVAL", "N", 5),
            ("RESERVED", "C", 50),
        ),
    ),
    "5LEAEN": (
        "STR(ID,11)+STR(EMPLOYEEID,11)",
        (
            ("ID", "N", 11),
            ("EMPLOYEEID", "N", 11),
            ("YEAR", "N", 11),
            ("LEAVETYPID", "N", 11),
            ("ENTITLEMNT", "F", 19),
            ("REST", "F", 19),
            ("INDAYS", "N", 1),
            ("RESERVED", "C", 20),
        ),
    ),
    "5LEAVT": (
        "ID",
        (
            ("ID", "N", 11),
            ("NAME", "C", 200),
            ("SHORTNAME", "C", 200),
            ("POSITION", "N", 11),
            ("COLORTEXT", "N", 11),
            ("COLORBAR", "N", 11),
            ("COLORBK", "N", 11),
            ("BOLD", "N", 1),
            ("CHARGETYP", "N", 5),
            ("CHARGEHRS", "F", 19),
            ("DEDUCTACT", "N", 1),
            ("DEDUCTOVT", "N", 1),
            ("ENTITLED", "N", 1),
            ("STDENTIT", "F", 19),
            ("CARRYFWD", "N", 1),
            ("COUNTALL", "N", 1),
            ("IGNORED", "N", 1),
            ("VALIDDAYS", "C", 16),
            ("CATEGORY", "N", 5),
            ("HIDE", "N", 1),
            ("RESERVED", "C", 200),
        ),
    ),
    "5MASHI": (
        "STR(ID,11)+STR(EMPLOYEEID,11)",
        (
            ("ID", "N", 11),
            ("EMPLOYEEID", "N", 11),
            ("DATE", "D", 8),
            ("SHIFTID", "N", 11),
            ("WORKPLACID", "N", 11),
            ("TYPE", "N", 5),
            ("RESERVED", "C", 20),
        ),
    ),
    "5NOTE": (
        "STR(ID,11)+STR(EMPLOYEEID,11)",
        (
            ("ID", "N", 11),
            ("EMPLOYEEID", "N", 11),
            ("DATE", "D", 8),
            ("TEXT1", "C", 252),
            ("TEXT2", "C", 252),
            ("RESERVED", "C", 20),
        ),
    ),
    "5OVER": (
        "STR(ID,11)+STR(EMPLOYEEID,11)",
        (
            ("ID", "N", 11),
            ("EMPLOYEEID", "N", 11),
            ("DATE", "D", 8),
            ("HOURS", "F", 19),
            ("RESERVED", "C", 20),
        ),
    ),
    "5PERIO": (
        "STR(ID,11)+STR(GROUPID,11)",
        (
            ("ID", "N", 11),
            ("GROUPID", "N", 11),
            ("START", "D", 8),
            ("END", "D", 8),
            ("COLOR", "N", 11),
            ("DESCRIPT", "C", 200),
            ("RESERVED", "C", 20),
        ),
    ),
    "5RESTR": (
        "STR(ID,11)+STR(EMPLOYEEID,11)",
        (
            ("ID", "N", 11),
            ("EMPLOYEEID", "N", 11),
            ("WEEKDAY", "N", 5),
            ("SHIFTID", "N", 11),
            ("RESTRICT", "N", 5),
            ("RESERVED", "C", 20),
        ),
    ),
    "5SHDEM": (
        "STR(ID,11)+STR(GROUPID,11)",
        (
            ("ID", "N", 11),
            ("GROUPID", "N", 11),
            ("WEEKDAY", "N", 5),
            ("SHIFTID", "N", 11),
            ("WORKPLACID", "N", 11),
            ("MIN", "N", 5),
            ("MAX", "N", 5),
            ("RESERVED", "C", 20),
        ),
    ),
    "5SHIFT": (
        "ID",
        (
            ("ID", "N", 11),
            ("NAME", "C", 200),
            ("SHORTNAME", "C", 200),
            ("POSITION", "N", 11),
            ("COLORTEXT", "N", 11),
            ("COLORBAR", "N", 11),
            ("COLORBK", "N", 11),
            ("BOLD", "N", 1),
            ("STARTEND0", "C", 36),
            ("STARTEND1", "C", 36),
            ("STARTEND2", "C", 36),
            ("STARTEND3", "C", 36),
            ("STARTEND4", "C", 36),
            ("STARTEND5", "C", 36),
            ("STARTEND6", "C", 36),
            ("STARTEND7", "C", 36),
            ("DURATION0", "F", 19),
            ("DURATION1", "F", 19),
            ("DURATION2", "F", 19),
            ("DURATION3", "F", 19),
            ("DURATION4", "F", 19),
            ("DURATION5", "F", 19),
            ("DURATION6", "F", 19),
            ("DURATION7", "F", 19),
            ("NOEXTRA", "N", 1),
            ("CATEGORY", "N", 5),
            ("HIDE", "N", 1),
            ("RESERVED", "C", 200),
        ),
    ),
    "5SPDEM": (
        "STR(ID,11)+STR(GROUPID,11)",
        (
            ("ID", "N", 11),
            ("GROUPID", "N", 11),
            ("DATE", "D", 8),
            ("SHIFTID", "N", 11),
            ("WORKPLACID", "N", 11),
            ("MIN", "N", 5),
            ("MAX", "N", 5),
            ("RESERVED", "C", 20),
        ),
    ),
    "5SPSHI": (
        "STR(ID,11)+STR(EMPLOYEEID,11)",
        (
            ("ID", "N", 11),
            ("EMPLOYEEID", "N", 11),
            ("DATE", "D", 8),
            ("NAME", "C", 200),
            ("SHORTNAME", "C", 200),
            ("SHIFTID", "N", 11),
            ("WORKPLACID", "N", 11),
            ("TYPE", "N", 5),
            ("COLORTEXT", "N", 11),
            ("COLORBAR", "N", 11),
            ("COLORBK", "N", 11),
            ("BOLD", "N", 1),
            ("STARTEND", "C", 36),
            ("DURATION", "F", 19),
            ("NOEXTRA", "N", 1),
            ("RESERVED", "C", 20),
        ),
    ),
    "5USER": (
        "ID",
        (
            ("ID", "N", 11),
            ("POSITION", "N", 11),
            ("NAME", "C", 200),
            ("DESCRIP", "C", 200),
            ("ADMIN", "N", 1),
            ("DIGEST", "C", 16),
            ("RIGHTS", "N", 5),
            ("CATEGORY", "C", 40),
            ("ADDEMPL", "N", 1),
            ("WDUTIES", "N", 1),
            ("WABSENCES", "N", 1),
            ("WOVERTIMES", "N", 1),
            ("WNOTES", "N", 1),
            ("WDEVIATION", "N", 1),
            ("WCYCLEASS", "N", 1),
            ("WSWAPONLY", "N", 1),
            ("WPAST", "N", 1),
            ("WACCEMWND", "N", 1),
            ("WACCGRWND", "N", 1),
            ("SHOWABS", "N", 5),
            ("SHOWNOTES", "N", 1),
            ("SHOWSTATS", "N", 1),
            ("RACCEMWND", "N", 1),
            ("RACCGRWND", "N", 1),
            ("BACKUP", "N", 1),
            ("HIDEBARIN", "N", 1),
            ("HIDEBARNO", "N", 1),
            ("ACCVOWND", "N", 1),
            ("ACCADMWND", "N", 1),
            ("MINITABLE", "N", 1),
            ("REPORT", "C", 40),
            ("HIDE", "N", 1),
            ("RESERVED", "C", 200),
        ),
    ),
    "5USETT": (
        "ID",
        (
            ("ID", "N", 11),
            ("LOGIN", "N", 1),
            ("SPSHCAT", "N", 5),
            ("OVERTCAT", "N", 5),
            ("ANOANAME", "C", 200),
            ("ANOASHORT", "C", 200),
            ("ANOACRTXT", "N", 11),
            ("ANOACRBAR", "N", 11),
            ("ANOACRBK", "N", 11),
            ("ANOABOLD", "N", 1),
            ("BACKUPFR", "N", 1),
            ("CHANGELOG", "N", 1),
            ("RESERVED", "C", 200),
        ),
    ),
    "5WOPL": (
        "ID",
        (
            ("ID", "N", 11),
            ("NAME", "C", 200),
            ("SHORTNAME", "C", 200),
            ("POSITION", "N", 11),
            ("COLORTEXT", "N", 11),
            ("COLORBAR", "N", 11),
            ("COLORBK", "N", 11),
            ("BOLD", "N", 1),
            ("HIDE", "N", 1),
            ("RESERVED", "C", 200),
        ),
    ),
    "5XCHAR": (
        "ID",
        (
            ("ID", "N", 11),
            ("NAME", "C", 200),
            ("POSITION", "N", 11),
            ("START", "N", 5),
            ("END", "N", 5),
            ("VALIDITY", "N", 5),
            ("VALIDDAYS", "C", 14),
            ("HOLRULE", "N", 5),
            ("DATE", "D", 8),
            ("HIDE", "N", 1),
            ("RESERVED", "C", 200),
        ),
    ),
}

TABLES: dict[str, Table] = {
    name: Table(name, key, tuple(Field(*f) for f in fields))
    for name, (key, fields) in _LAYOUT.items()
}

JOURNAL_FIELDS: tuple[Field, ...] = (
    Field("NUMBER", "N", 11),
    Field("CHANGEID1", "N", 11),
    Field("CHANGEID2", "N", 11),
    Field("CHANGEID3", "N", 11),
    Field("CHANGE", "N", 1),
)


def table_schema(name: str) -> Table:
    """Return the layout of a table or journal by name.

    Accepts ``5EMPL``, ``EMPL``, ``5empl.dbf`` and journal names such as
    ``5EMPL-L``. Raises ``KeyError`` for names that are not part of SP5.
    """
    stem = os.path.splitext(os.path.basename(name))[0].upper()
    if not stem.startswith("5"):
        stem = "5" + stem
    if stem.endswith(JOURNAL_SUFFIX):
        base = stem[: -len(JOURNAL_SUFFIX)]
        if base in TABLES:
            return Table(stem, JOURNAL_KEY, JOURNAL_FIELDS, JOURNAL_TAG)
        raise KeyError(name)
    return TABLES[stem]


def _dbf_header(table: Table, stamp: date) -> bytes:
    header = bytearray(32)
    header[0] = 0x03  # dBASE III without memo
    header[1:4] = bytes([stamp.year % 100, stamp.month, stamp.day])
    struct.pack_into("<IHH", header, 4, 0, table.header_size, table.record_size)
    header[28] = 0x01  # a production index (.CDX) exists
    offset = 1
    for field in table.fields:
        descriptor = bytearray(32)
        descriptor[0 : len(field.name)] = field.name.encode("ascii")
        descriptor[11] = ord(field.type)
        struct.pack_into("<I", descriptor, 12, offset)
        descriptor[16] = field.length
        header += descriptor
        offset += field.length
    return bytes(header) + b"\x0d"


def create_table(
    directory: str,
    name: str,
    records: Iterable[dict[str, Any]] = (),
    stamp: date | None = None,
) -> str:
    """Create a table with its index file, replacing existing files.

    *records* are written in the given order, completed with
    :meth:`Table.new_record`; no journal entries are made. *stamp* is the
    date written into the header (default: today). Returns the path of the
    ``.DBF`` file.
    """
    from .cdx_writer import build_cdx_bytes
    from .dbf_reader import _dedupe_names
    from .dbf_writer import _encode_record

    table = table_schema(name)
    fields = table.field_dicts()
    names = _dedupe_names([f.name for f in table.fields])
    rows = [_encode_record(table.new_record(r), fields, names) for r in records]
    header = bytearray(_dbf_header(table, stamp or date.today()))
    struct.pack_into("<I", header, 4, len(rows))
    path = os.path.join(directory, table.name + ".DBF")
    with open(path, "wb") as f:
        f.write(bytes(header) + b"".join(rows) + b"\x1a")
    with open(os.path.join(directory, table.name + ".CDX"), "wb") as f:
        f.write(build_cdx_bytes(path, table.key_expression, len(rows), table.tag))
    return path


def create_database(directory: str, stamp: date | None = None) -> None:
    """Create all 30 tables and their journals, empty, in *directory*.

    The result has the structure of a database created by SP5 but none of
    the rows SP5 adds on first start (settings, build record, default user).
    """
    os.makedirs(directory, exist_ok=True)
    for name in TABLES:
        create_table(directory, name, stamp=stamp)
        create_table(directory, name + JOURNAL_SUFFIX, stamp=stamp)
