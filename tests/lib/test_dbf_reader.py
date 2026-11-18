import struct
from datetime import date

import pytest

from sp5lib import dbf_reader
from sp5lib.dbf_reader import (
    _decode_string,
    _decode_text,
    _dedupe_names,
    _is_utf16_le,
    _parse_date,
    get_table_fields,
    read_dbf,
    read_dbf_buffer,
    read_header,
)


def utf16(text, length):
    return (text.encode("utf-16-le") + b"\x00\x00").ljust(length, b" ")


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("20240229", "2024-02-29"),
        ("20230229", None),
        ("20230231", None),
        ("00000101", None),
        ("        ", None),
        ("invalid ", None),
        ("2024011", None),
    ],
)
def test_parse_date(raw, expected):
    assert _parse_date(raw) == expected


def test_dedupe_names():
    assert _dedupe_names(["ID", "START", "START", "X", "START"]) == [
        "ID", "START", "START2", "X", "START3",
    ]  # fmt: skip


def test_is_utf16_le():
    assert _is_utf16_le(utf16("Muster", 20))
    assert _is_utf16_le(utf16("Παράδειγμα", 40))
    assert not _is_utf16_le(b"1 1 1 1 1 0 0 0 ")
    assert not _is_utf16_le(b"06:00-14:00   ")
    assert _is_utf16_le(b"\x00\x00")
    assert not _is_utf16_le(b"1")


@pytest.mark.parametrize("text", ["", "Muster", "Müßiggang", "Παράδειγμα", "示例", "日本語 τεστ"])
def test_decode_text_all_scripts(text):
    assert _decode_text(utf16(text, 60)) == text


def test_decode_text_without_terminator():
    assert _decode_text("Muster".encode("utf-16-le")) == "Muster"
    assert _decode_text(b"plain ascii   ") == "plain ascii"
    assert _decode_text(b"          ") == ""


def test_decode_string():
    assert _decode_string(b"") == ""
    assert _decode_string(b"1 0 1   ") == "1 0 1"
    assert _decode_string(utf16("Erika", 30)) == "Erika"


def test_read_generated_employees(db_dir):
    rows = read_dbf(f"{db_dir}/5EMPL.DBF")
    assert len(rows) == 14
    first = rows[0]
    assert first["ID"] == 101 and isinstance(first["ID"], int)
    assert (first["NAME"], first["FIRSTNAME"]) == ("Muster", "Erika")
    assert first["BIRTHDAY"] == "1970-01-01"
    assert first["EMPEND"] is None
    assert first["HRSWEEK"] == 38.5 and isinstance(first["HRSTOTAL"], float)
    assert first["WORKDAYS"] == "1 1 1 1 1 0 0 0"
    assert first["RESERVED"] == ""
    assert [r["NAME"] for r in rows[10:]] == ["Müßiggang", "Παράδειγμα", "示例", "Ünal-Beispiel"]


def test_binary_and_duplicate_fields(db_dir):
    user = read_dbf(f"{db_dir}/5USER.DBF")[0]
    assert isinstance(user["DIGEST"], bytes) and len(user["DIGEST"]) == 16
    assert user["CATEGORY"].split() == ["1"] + ["0"] * 19
    demand = read_dbf(f"{db_dir}/5DADEM.DBF")[0]
    assert (demand["START"], demand["START2"]) == ("2024-01-01", "2024-01-07")


def test_header_and_fields(db_dir):
    header = read_header(f"{db_dir}/5HOLID.DBF")
    assert header.record_count == 65 and header.last_update == date.today()
    fields = get_table_fields(f"{db_dir}/5HOLID.DBF")
    assert fields[1] == {"name": "DATE", "type": "D", "len": 8, "dec": 0}


def test_deleted_records_are_skipped(db_dir):
    path = f"{db_dir}/5WOPL.DBF"
    data = bytearray(open(path, "rb").read())
    header_size = struct.unpack_from("<H", data, 8)[0]
    data[header_size] = 0x2A
    assert [r["ID"] for r in read_dbf_buffer(bytes(data))] == [2]


def test_unreadable_input(tmp_path):
    missing = str(tmp_path / "5EMPL.DBF")
    assert read_dbf(missing) == []
    assert get_table_fields(missing) == []
    assert read_dbf_buffer(b"\x03short") == []
    (tmp_path / "5EMPL.DBF").write_bytes(b"\x03" * 10)
    assert get_table_fields(missing) == []
    with pytest.raises(ValueError):
        read_header(missing)


def test_truncated_table_returns_complete_records(db_dir):
    data = open(f"{db_dir}/5WOPL.DBF", "rb").read()
    assert len(read_dbf_buffer(data[:-100])) == 1


def test_number_and_other_field_types():
    specs = dbf_reader._compile_field_specs(
        [
            {"name": "A", "type": "N", "len": 5, "dec": 0},
            {"name": "B", "type": "N", "len": 6, "dec": 2},
            {"name": "C", "type": "L", "len": 1, "dec": 0},
            {"name": "D", "type": "M", "len": 4, "dec": 0},
            {"name": "E", "type": "X", "len": 3, "dec": 0},
            {"name": "F", "type": "N", "len": 3, "dec": 0},
        ],
        list("ABCDEF"),
    )
    record = dbf_reader._parse_record_specs(
        b" " + b"   42" + b"  1.50" + b"T" + b"   1" + b"ab " + b"  .", specs
    )
    assert record == {"A": 42, "B": 1.5, "C": True, "D": None, "E": "ab", "F": 0}
