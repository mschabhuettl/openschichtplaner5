import logging
import os
import struct
import threading
from datetime import date

import pytest

from sp5lib.cdx_writer import _build_keys, read_cdx
from sp5lib.dbf_reader import read_dbf, read_header
from sp5lib.dbf_writer import (
    _encode_field,
    _encode_string,
    append_record,
    delete_record,
    find_all_records,
    get_table_fields,
    pack_table,
    update_record,
)
from sp5lib.schema import TABLES


def field(name, ftype, length, dec=0):
    return {"name": name, "type": ftype, "len": length, "dec": dec}


def index_matches(path):
    index = read_cdx(os.path.splitext(path)[0] + ".CDX")
    return index.entries == _build_keys(path, index.key_expression)


# --- encoding ---


def test_encode_string():
    assert _encode_string("", 8) == b"\x00\x00" + b" " * 6
    assert _encode_string("ab", 8) == b"a\x00b\x00\x00\x00  "
    assert _encode_string("abc", 8) == b"a\x00b\x00c\x00\x00\x00"
    assert _encode_string("abcd", 8) == b"a\x00b\x00c\x00d\x00"  # fills the field
    assert _encode_string("x", 1) == b"\x00"
    assert _encode_string("x", 0) == b""


def test_encode_string_truncates_with_warning(caplog):
    with caplog.at_level(logging.WARNING):
        encoded = _encode_string("abcdefgh", 8)
    assert encoded == b"a\x00b\x00c\x00d\x00"
    assert "cut" in caplog.text


def test_text_of_full_field_length_roundtrip(db_dir):
    path = f"{db_dir}/5WOPL.DBF"
    fields = get_table_fields(path)
    for name in ("N" * 100, "示" * 100, "x" * 99, "€" * 100, "示" * 99 + "”"):
        update_record(path, fields, 0, {"NAME": name, "SHORTNAME": "kurz"})
        row = read_dbf(path)[0]
        assert (row["NAME"], row["SHORTNAME"]) == (name, "kurz")


@pytest.mark.parametrize(
    ("value", "spec", "expected"),
    [
        (7, field("ID", "N", 5), b"    7"),
        ("12", field("ID", "N", 5), b"   12"),
        (-3, field("ID", "N", 5), b"   -3"),
        (None, field("ID", "N", 5), b"     "),
        ("x", field("ID", "N", 5), b"     "),
        (1.5, field("X", "N", 6, 2), b"  1.50"),
        (7.7, field("HRSDAY", "F", 19), b"             7.7000"),
        (-0.75, field("HOURS", "F", 19), b"            -0.7500"),
        ("2024-02-29", field("DATE", "D", 8), b"20240229"),
        ("20240229", field("DATE", "D", 8), b"20240229"),
        (date(2024, 2, 29), field("DATE", "D", 8), b"20240229"),
        (None, field("DATE", "D", 8), b"        "),
        ("soon", field("DATE", "D", 8), b"        "),
        ("invalid", field("DATE", "D", 8), b"invalid "),
        ("1 1 0", field("WORKDAYS", "C", 8), b"1 1 0   "),
        (None, field("WORKDAYS", "C", 8), b"        "),
        ("06:00-14:00", field("STARTEND3", "C", 12), b"06:00-14:00 "),
        (b"\x01\x02", field("DIGEST", "C", 4), b"\x01\x02\x00\x00"),
        ("", field("RESERVED", "C", 4), b"\x00\x00\x00\x00"),
        (None, field("RESERVED", "C", 4), b"\x00\x00\x00\x00"),
        (None, field("NAME", "C", 6), b"\x00\x00    "),
        ("ß", field("NAME", "C", 6), b"\xdf\x00\x00\x00  "),
        (True, field("X", "L", 1), b"T"),
        (0, field("X", "L", 1), b"F"),
        ("x", field("X", "M", 4), b"    "),
        ("ab", field("X", "Z", 4), b"ab  "),
    ],
)
def test_encode_field(value, spec, expected):
    assert _encode_field(value, spec) == expected


def test_encode_number_too_large():
    with pytest.raises(ValueError, match="does not fit"):
        _encode_field(123456, field("ID", "N", 5))


def test_ascii_field_truncated(caplog):
    with caplog.at_level(logging.WARNING):
        assert _encode_field("1 1 1 1 1", field("WORKDAYS", "C", 4)) == b"1 1 "
    assert "WORKDAYS" in caplog.text


# --- append ---


def test_append_record_roundtrip(db_dir):
    path = f"{db_dir}/5WOPL.DBF"
    fields = get_table_fields(path)
    record = TABLES["5WOPL"].new_record({"NAME": "Lager Süd", "SHORTNAME": "LS2", "COLORBK": 255})
    assert append_record(path, fields, record, autoid_field="ID") == 3
    assert record["ID"] == 3
    rows = read_dbf(path)
    assert rows[-1] == record | {"RESERVED": ""}
    header = read_header(path)
    assert header.record_count == 3
    assert os.path.getsize(path) == header.header_size + 3 * header.record_size + 1
    assert open(path, "rb").read()[-1] == 0x1A
    assert index_matches(path)


def test_append_writes_journal(db_dir):
    path = f"{db_dir}/5MASHI.DBF"
    record = TABLES["5MASHI"].new_record({"ID": 77, "EMPLOYEEID": 101, "DATE": "2024-02-01"})
    append_record(path, get_table_fields(path), record)
    journal = read_dbf(f"{db_dir}/5MASHI-L.DBF")
    assert journal == [
        {"NUMBER": 1, "CHANGEID1": 77, "CHANGEID2": 101, "CHANGEID3": 0, "CHANGE": 0}
    ]
    assert index_matches(f"{db_dir}/5MASHI-L.DBF")


def test_autoid_within_owner(db_dir):
    path = f"{db_dir}/5NOTE.DBF"
    fields = get_table_fields(path)
    record = {"EMPLOYEEID": 102, "DATE": "2024-01-30", "TEXT1": "x"}
    append_record(path, fields, record, autoid_field="ID", autoid_within=("EMPLOYEEID",))
    assert record["ID"] == 3
    other = {"EMPLOYEEID": 110, "DATE": "2024-01-30", "TEXT1": "y"}
    append_record(path, fields, other, autoid_field="ID", autoid_within=("EMPLOYEEID",))
    assert other["ID"] == 1


def test_autoid_unknown_field(db_dir):
    path = f"{db_dir}/5WOPL.DBF"
    with pytest.raises(ValueError, match="autoid"):
        append_record(path, get_table_fields(path), {}, autoid_field="NOPE")


def test_append_rejects_wrong_field_list(db_dir):
    path = f"{db_dir}/5WOPL.DBF"
    fields = get_table_fields(f"{db_dir}/5EMPL.DBF")
    before = open(path, "rb").read()
    with pytest.raises(ValueError, match="Record size mismatch"):
        append_record(path, fields, {"ID": 9})
    assert open(path, "rb").read() == before


def test_append_repairs_missing_eof_marker(db_dir):
    path = f"{db_dir}/5WOPL.DBF"
    with open(path, "r+b") as f:
        f.truncate(os.path.getsize(path) - 1)
    append_record(path, get_table_fields(path), {"ID": 3, "NAME": "x"})
    assert [r["ID"] for r in read_dbf(path)] == [1, 2, 3]
    assert open(path, "rb").read()[-1] == 0x1A


def test_concurrent_appends_get_distinct_ids(db_dir):
    path = f"{db_dir}/5WOPL.DBF"
    fields = get_table_fields(path)
    ids = []

    def add():
        record = {"NAME": "parallel"}
        append_record(path, fields, record, autoid_field="ID")
        ids.append(record["ID"])

    threads = [threading.Thread(target=add) for _ in range(12)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert sorted(ids) == list(range(3, 15))
    assert len(read_dbf(path)) == 14
    assert index_matches(path)
    numbers = [r["NUMBER"] for r in read_dbf(f"{db_dir}/5WOPL-L.DBF")]
    assert sorted(numbers) == list(range(1, 13))


# --- update, delete, pack ---


def test_update_changes_only_listed_fields(db_dir):
    path = f"{db_dir}/5EMPL.DBF"
    fields = get_table_fields(path)
    before = open(path, "rb").read()
    index, record = find_all_records(path, fields, ID=103)[0]
    update_record(path, fields, index, {"NAME": "Geändert", "HRSWEEK": 20, "EMPEND": "2024-12-31"})
    after = open(path, "rb").read()
    changed = read_dbf(path)[index]
    assert changed == record | {"NAME": "Geändert", "HRSWEEK": 20.0, "EMPEND": "2024-12-31"}
    header_size, record_size = struct.unpack_from("<HH", after, 8)
    start = header_size + index * record_size
    assert after[4:start] == before[4:start]
    assert after[start + record_size :] == before[start + record_size :]
    assert read_dbf(f"{db_dir}/5EMPL-L.DBF")[-1]["CHANGEID1"] == 103


def test_update_duplicate_field_name(db_dir):
    path = f"{db_dir}/5DADEM.DBF"
    fields = get_table_fields(path)
    update_record(path, fields, 0, {"START2": "2024-01-14"})
    row = read_dbf(path)[0]
    assert (row["START"], row["START2"]) == ("2024-01-01", "2024-01-14")


def test_delete_and_pack(db_dir):
    path = f"{db_dir}/5MASHI.DBF"
    fields = get_table_fields(path)
    total = len(read_dbf(path))
    matches = find_all_records(path, fields, EMPLOYEEID=104)
    for index, _ in matches:
        delete_record(path, fields, index)
    delete_record(path, fields, matches[0][0])  # deleting twice is harmless
    assert len(read_dbf(path)) == total - len(matches)
    assert read_header(path).record_count == total
    assert find_all_records(path, fields, EMPLOYEEID=104) == []
    assert index_matches(path)
    journal = read_dbf(f"{db_dir}/5MASHI-L.DBF")
    assert [r["CHANGE"] for r in journal] == [2] * len(matches)
    assert {r["CHANGEID2"] for r in journal} == {104}
    with pytest.raises(ValueError, match="deleted"):
        update_record(path, fields, matches[0][0], {"SHIFTID": 2})

    assert pack_table(path) == len(matches)
    assert read_header(path).record_count == total - len(matches)
    assert read_dbf(f"{db_dir}/5MASHI-L.DBF") == []
    assert index_matches(path) and index_matches(f"{db_dir}/5MASHI-L.DBF")
    assert pack_table(path) == 0


def test_record_index_out_of_range(db_dir):
    path = f"{db_dir}/5WOPL.DBF"
    fields = get_table_fields(path)
    with pytest.raises(IndexError):
        delete_record(path, fields, 2)
    with pytest.raises(IndexError):
        update_record(path, fields, -1, {})


def test_find_all_records(db_dir):
    path = f"{db_dir}/5ABSEN.DBF"
    assert len(find_all_records(path)) == 9
    found = find_all_records(path, EMPLOYEEID=107, INTERVAL=3)
    assert [(i, r["START"], r["END"]) for i, r in found] == [(8, 600, 840)]
    assert find_all_records(f"{db_dir}/missing.DBF") == []


# --- index and journal upkeep ---


def test_missing_index_is_created(db_dir):
    path = f"{db_dir}/5WOPL.DBF"
    os.remove(f"{db_dir}/5WOPL.CDX")
    os.remove(f"{db_dir}/5WOPL-L.CDX")
    append_record(path, get_table_fields(path), {"ID": 3})
    assert index_matches(path) and index_matches(f"{db_dir}/5WOPL-L.DBF")


def test_damaged_index_is_replaced(db_dir):
    path = f"{db_dir}/5WOPL.DBF"
    with open(f"{db_dir}/5WOPL.CDX", "wb") as f:
        f.write(b"\x00" * 100)
    append_record(path, get_table_fields(path), {"ID": 3})
    assert index_matches(path)


def test_index_counter_follows_key_changes(db_dir):
    path = f"{db_dir}/5WOPL.DBF"
    cdx = f"{db_dir}/5WOPL.CDX"
    fields = get_table_fields(path)
    start = read_cdx(cdx).counter
    append_record(path, fields, {"ID": 3})
    assert read_cdx(cdx).counter == start + 1
    before = open(cdx, "rb").read()
    update_record(path, fields, 0, {"NAME": "Pforte", "ID": 1})
    assert open(cdx, "rb").read() == before  # no key changed
    update_record(path, fields, 0, {"ID": 7})
    assert read_cdx(cdx).counter == start + 2 and index_matches(path)
    delete_record(path, fields, 1)
    assert read_cdx(cdx).counter == start + 3 and index_matches(path)


def test_index_of_other_tables_is_not_touched(db_dir, caplog):
    os.rename(f"{db_dir}/5WOPL.DBF", f"{db_dir}/OTHER.DBF")
    os.remove(f"{db_dir}/5WOPL.CDX")
    with caplog.at_level(logging.WARNING):
        append_record(f"{db_dir}/OTHER.DBF", get_table_fields(f"{db_dir}/OTHER.DBF"), {"ID": 3})
    assert "not an SP5 table" in caplog.text
    assert not os.path.exists(f"{db_dir}/OTHER.CDX")


def test_database_change_counter(db_dir):
    def counter():
        return read_dbf(f"{db_dir}/5BUILD.DBF")[0]["CHANGE"]

    build_files = {n: open(f"{db_dir}/{n}", "rb").read() for n in ("5BUILD.CDX", "5BUILD-L.DBF")}
    path = f"{db_dir}/5WOPL.DBF"
    fields = get_table_fields(path)
    assert counter() == 1
    append_record(path, fields, {"ID": 3})
    update_record(path, fields, 0, {"BOLD": 1})
    delete_record(path, fields, 1)
    assert counter() == 4
    assert pack_table(path) == 1
    assert counter() == 5
    for name, content in build_files.items():
        assert open(f"{db_dir}/{name}", "rb").read() == content
    # Writing 5BUILD itself is an ordinary write without counting.
    build = f"{db_dir}/5BUILD.DBF"
    update_record(build, get_table_fields(build), 0, {"HELPER": 3})
    assert counter() == 5


def test_database_without_build_table(db_dir):
    os.remove(f"{db_dir}/5BUILD.DBF")
    path = f"{db_dir}/5WOPL.DBF"
    append_record(path, get_table_fields(path), {"ID": 3})
    assert len(read_dbf(path)) == 3


def test_missing_journal_is_tolerated(db_dir, caplog):
    path = f"{db_dir}/5WOPL.DBF"
    os.remove(f"{db_dir}/5WOPL-L.DBF")
    with caplog.at_level(logging.WARNING):
        append_record(path, get_table_fields(path), {"ID": 3})
    assert "no journal" in caplog.text
    assert len(read_dbf(path)) == 3


def test_unwritable_journal_is_tolerated(db_dir, caplog):
    path = f"{db_dir}/5WOPL.DBF"
    with open(f"{db_dir}/5WOPL-L.DBF", "wb") as f:
        f.write(b"\x03")
    with caplog.at_level(logging.WARNING):
        append_record(path, get_table_fields(path), {"ID": 3})
    assert "not writable" in caplog.text


def test_header_date_is_left_alone(db_dir):
    """SP5 does not change the date in the header when it writes."""
    path = f"{db_dir}/5WOPL.DBF"
    with open(path, "r+b") as f:
        f.seek(1)
        f.write(bytes([13, 2, 12]))
    fields = get_table_fields(path)
    update_record(path, fields, 0, {"BOLD": 1})
    append_record(path, fields, {"ID": 3})
    assert read_header(path).last_update == date(2013, 2, 12)


def test_missing_and_truncated_table_files(tmp_path):
    missing = str(tmp_path / "5WOPL.DBF")
    fields = TABLES["5WOPL"].field_dicts()
    with pytest.raises(FileNotFoundError):
        append_record(missing, fields, {"ID": 1})
    with pytest.raises(FileNotFoundError):
        delete_record(missing, fields, 0)
    assert find_all_records(missing, fields) == []
    (tmp_path / "5WOPL.DBF").write_bytes(b"\x03" * 20)
    with pytest.raises(ValueError, match="Truncated"):
        update_record(missing, fields, 0, {})
    assert find_all_records(missing, fields) == []


def test_concurrent_writes_keep_existing_records(db_dir):
    path = f"{db_dir}/5MASHI.DBF"
    fields = get_table_fields(path)
    before = read_dbf(path)

    def work(employee):
        for day in range(1, 6):
            record = {"EMPLOYEEID": employee, "DATE": f"2024-03-{day:02d}", "SHIFTID": 1}
            append_record(path, fields, record, autoid_field="ID", autoid_within=("EMPLOYEEID",))

    staff = [101, 102, 103, 114]  # employees without entered duties
    threads = [threading.Thread(target=work, args=(e,)) for e in staff]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    after = read_dbf(path)
    assert after[: len(before)] == before and len(after) == len(before) + 20
    new = after[len(before) :]
    assert sorted((r["EMPLOYEEID"], r["ID"]) for r in new) == [
        (e, i) for e in staff for i in range(1, 6)
    ]
    assert index_matches(path)
    assert read_dbf(f"{db_dir}/5BUILD.DBF")[0]["CHANGE"] == 21
