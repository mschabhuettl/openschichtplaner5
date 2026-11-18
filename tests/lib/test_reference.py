"""Checks against the sample database that ships with Schichtplaner 5.0.13.

Skipped unless the environment variable SP5_SAMPLE_DB names a directory with
that database. Only structure and counts are asserted here; no content of
the sample database is part of this repository.
"""

import os
import shutil
import struct

import pytest

import sp5gen
from sp5lib import cli, schema
from sp5lib.cdx_writer import _build_keys, build_cdx_bytes, read_cdx
from sp5lib.database import SP5Database
from sp5lib.dbf_reader import (
    _dedupe_names,
    _parse_record,
    _terminator,
    get_table_fields,
    read_dbf,
    read_header,
)
from sp5lib.dbf_writer import _encode_record

NAMES = [n for name in schema.TABLES for n in (name, name + "-L")]

ROWS = {
    "5BUILD": 1, "5CYCLE": 1, "5CYENT": 15, "5EMPL": 30, "5GRACC": 3, "5GRASG": 36, "5GROUP": 10,
    "5HOLID": 96, "5LEAVT": 8, "5SHIFT": 5, "5USER": 6, "5USETT": 1, "5WOPL": 4, "5XCHAR": 4,
}  # fmt: skip


def raw_records(path):
    data = open(path, "rb").read()
    count, header_size, record_size = struct.unpack_from("<IHH", data, 4)
    return [data[header_size + i * record_size :][:record_size] for i in range(count)]


def test_sample_has_exactly_the_known_files(sample_dir):
    expected = {f"{n}.{ext}" for n in NAMES for ext in ("DBF", "CDX")}
    assert set(os.listdir(sample_dir)) == expected


@pytest.mark.parametrize("name", NAMES)
def test_header_and_fields_match_schema(sample_dir, name):
    path = f"{sample_dir}/{name}.DBF"
    table = schema.table_schema(name)
    header = read_header(path)
    assert (header.version, header.codepage, header.has_index) == (3, 0, True)
    assert (header.header_size, header.record_size) == (table.header_size, table.record_size)
    assert get_table_fields(path) == table.field_dicts()
    assert header.record_count == ROWS.get(name, 0)
    assert (
        os.path.getsize(path) == header.header_size + header.record_count * header.record_size + 1
    )


@pytest.mark.parametrize("name", NAMES)
def test_created_table_equals_sample_structure(sample_dir, name, tmp_path):
    original = open(f"{sample_dir}/{name}.DBF", "rb").read()
    header = read_header(f"{sample_dir}/{name}.DBF")
    created = open(schema.create_table(str(tmp_path), name, stamp=header.last_update), "rb").read()
    assert created[:4] == original[:4]
    assert created[8 : header.header_size] == original[8 : header.header_size]
    if header.record_count == 0:
        assert created == original
        index = open(f"{sample_dir}/{name}.CDX", "rb").read()
        new_index = open(tmp_path / f"{name}.CDX", "rb").read()
        assert new_index[:8] + new_index[12:] == index[:8] + index[12:]


@pytest.mark.parametrize("name", NAMES)
def test_decode_then_encode_is_byte_identical(sample_dir, name):
    path = f"{sample_dir}/{name}.DBF"
    fields = get_table_fields(path)
    names = _dedupe_names([f["name"] for f in fields])
    for raw in raw_records(path):
        encoded = _encode_record(_parse_record(raw, fields, names), fields, names)
        if name == "5XCHAR":
            # SP5 writes the text "invalid " into the unused DATE field of
            # these records; the library writes spaces for a missing date.
            start = 1 + sum(f["len"] for f in fields[: names.index("DATE")])
            assert raw[start : start + 8] == b"invalid "
            raw = raw[:start] + b" " * 8 + raw[start + 8 :]
        assert encoded == raw


@pytest.mark.parametrize("name", NAMES)
def test_index_is_read_and_rebuilt_identically(sample_dir, name):
    table = schema.table_schema(name)
    cdx = f"{sample_dir}/{name}.CDX"
    index = read_cdx(cdx)
    assert (index.tag, index.key_expression) == (table.tag, table.key_expression)
    assert index.for_expression == schema.FOR_EXPRESSION
    keys = _build_keys(f"{sample_dir}/{name}.DBF", index.key_expression)
    assert index.entries == keys
    assert len({key for key, _ in keys}) == len(keys), "index keys are unique"
    rebuilt = build_cdx_bytes(
        f"{sample_dir}/{name}.DBF", index.key_expression, index.counter, index.tag
    )
    assert rebuilt == open(cdx, "rb").read()


def test_text_fields_are_terminated_utf16(sample_dir):
    for name, table in schema.TABLES.items():
        for raw in raw_records(f"{sample_dir}/{name}.DBF"):
            offset = 1
            for field in table.fields:
                chunk = raw[offset : offset + field.length]
                offset += field.length
                if field.kind == "text":
                    end = _terminator(chunk)
                    assert end >= 0
                    assert chunk[end + 2 :].strip(b" ") == b""
                    chunk[:end].decode("utf-16-le")
                elif field.kind == "reserved":
                    assert chunk == b"\x00" * field.length
                elif field.kind == "float":
                    assert chunk.strip()[-5:-4] == b"."


def test_database_accessors_on_sample(sample_dir):
    db = SP5Database(sample_dir)
    assert len(db.get_employees()) == 30
    assert len(db.get_groups()) == 10
    assert len(db.get_shifts(include_hidden=True)) == 5
    assert len(db.get_leave_types()) == 8
    assert len(db.get_holidays()) == 96
    assert db.get_duties() == []
    assert len(db.get_cycles()[0]["entries"]) == 15
    assert db.get_settings()["ID"] == 0
    assert sum(len(db.get_group_members(g["ID"])) for g in db.get_groups()) == 36


def test_validate_command_accepts_sample(sample_dir, capsys):
    assert cli.main(["validate", sample_dir]) == 0


def test_generator_matches_sample_structure(sample_dir, tmp_path):
    """The synthetic database has the files, headers and index definitions
    of the sample, and uses the same value formats."""
    generated = str(tmp_path / "generated")
    sp5gen.generate(generated)
    assert set(os.listdir(generated)) == set(os.listdir(sample_dir))
    for name in NAMES:
        ours, theirs = (open(f"{d}/{name}.DBF", "rb").read() for d in (generated, sample_dir))
        header_size = struct.unpack_from("<H", theirs, 8)[0]
        assert ours[8:header_size] == theirs[8:header_size], name
        assert ours[0] == theirs[0] and ours[28:32] == theirs[28:32]
        a, b = (read_cdx(f"{d}/{name}.CDX") for d in (generated, sample_dir))
        assert (a.tag, a.key_expression, a.for_expression, a.key_length) == (
            b.tag, b.key_expression, b.for_expression, b.key_length,
        )  # fmt: skip


def test_write_roundtrip_on_copy(sample_dir, tmp_path):
    """Write to a copy of the sample: untouched records keep their bytes and
    every index still matches its table."""
    copy = str(tmp_path / "copy")
    shutil.copytree(sample_dir, copy)
    db = SP5Database(copy)
    before = {n: raw_records(f"{copy}/{n}.DBF") for n in schema.TABLES}
    employee = db.get_employees()[0]["ID"]
    shift = db.get_shifts()[0]["ID"]

    new_employee = db.insert("EMPL", {"NAME": "Muster", "FIRSTNAME": "Erika", "POSITION": 31})
    duty = db.insert("MASHI", {"EMPLOYEEID": employee, "DATE": "2013-03-01", "SHIFTID": shift})
    db.update("SHIFT", shift, {"NAME": "Geändert"})
    membership = db.read("GRASG")[0]
    db.delete("GRASG", (membership["ID"], membership["EMPLOYEEID"]))

    after = {n: raw_records(f"{copy}/{n}.DBF") for n in schema.TABLES}
    assert after["5EMPL"][:-1] == before["5EMPL"]
    assert db.get("EMPL", new_employee)["NAME"] == "Muster"
    assert db.get("MASHI", (duty, employee))["SHIFTID"] == shift
    changed = [
        i for i, (a, b) in enumerate(zip(after["5SHIFT"], before["5SHIFT"], strict=True)) if a != b
    ]
    assert len(changed) == 1 and db.get("SHIFT", shift)["NAME"] == "Geändert"
    assert after["5GRASG"][0][0:1] == b"*" and after["5GRASG"][0][1:] == before["5GRASG"][0][1:]
    assert after["5GRASG"][1:] == before["5GRASG"][1:]
    for name in set(schema.TABLES) - {"5EMPL", "5MASHI", "5SHIFT", "5GRASG"}:
        assert after[name] == before[name]
    assert [len(db.journal(n)) for n in ("EMPL", "MASHI", "SHIFT", "GRASG")] == [1, 1, 1, 1]
    assert cli.main(["validate", copy]) == 0

    # Reading everything back gives the same records as before the write.
    assert len(read_dbf(f"{copy}/5EMPL.DBF")) == 31
    assert len(read_dbf(f"{copy}/5GRASG.DBF")) == 35
