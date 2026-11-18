import os
import struct

import pytest

from sp5lib import cdx_writer
from sp5lib.cdx_writer import (
    PAGE,
    _build_keys,
    _char_key,
    _numeric_key,
    _parse_key_expr,
    build_cdx,
    build_cdx_bytes,
    read_cdx,
    write_cdx,
)
from sp5lib.dbf_writer import append_record, find_all_records, get_table_fields
from sp5lib.schema import TABLES, create_table


def test_parse_key_expr():
    assert _parse_key_expr("ID") == ("numeric", "ID")
    assert _parse_key_expr("STR(ID,11)+STR(EMPLOYEEID,11)") == (
        "char", [("ID", 11), ("EMPLOYEEID", 11)],
    )  # fmt: skip
    for bad in ("UPPER(NAME)", "ID+NAME", "1ID"):
        with pytest.raises(ValueError):
            _parse_key_expr(bad)


def test_numeric_keys_sort_like_numbers():
    values = [-1000, -2.5, -1, 0, 1, 2, 2.5, 40, 1000, 10**9]
    keys = [_numeric_key(v) for v in values]
    assert keys == sorted(keys)
    assert _numeric_key(1) == bytes.fromhex("bff0000000000000")
    assert _numeric_key(0) == bytes.fromhex("8000000000000000")


def test_char_key():
    assert _char_key({"ID": 3, "EMPLOYEEID": 101}, [("ID", 11), ("EMPLOYEEID", 11)]) == (
        b"          3        101"
    )
    assert _char_key({}, [("ID", 4)]) == b"   0"


def test_every_generated_index_matches_its_table(db_dir):
    for name, table in TABLES.items():
        for stem, tag in ((name, "ID_TAG"), (name + "-L", "NUMBER_TAG")):
            index = read_cdx(f"{db_dir}/{stem}.CDX")
            assert index.tag == tag
            assert index.for_expression == ".NOT. DELETED()"
            if tag == "ID_TAG":
                assert index.key_expression == table.key_expression
                assert index.key_length == (
                    8 if len(table.key_fields) == 1 else 11 * len(table.key_fields)
                )
            assert index.entries == _build_keys(f"{db_dir}/{stem}.DBF", index.key_expression)
            assert index.entries == sorted(index.entries)


def test_empty_index_layout(db_dir):
    data = open(f"{db_dir}/5CYCLE-L.CDX", "rb").read()
    assert len(data) == 6 * PAGE
    assert struct.unpack_from("<I", data, 0)[0] == 4 * PAGE  # root of the tag directory
    assert data[14] == 0xE0 and data[2 * PAGE + 14] == 0x68
    assert struct.unpack_from("<H", data, 2 * PAGE + 12)[0] == 8
    assert data[3 * PAGE :].startswith(b"NUMBER\x00.NOT. DELETED()\x00")
    assert data[5 * PAGE - 10 : 5 * PAGE] == b"NUMBER_TAG"
    assert struct.unpack_from("<HH", data, 5 * PAGE) == (3, 0)  # empty root leaf


def test_numeric_index_with_several_leaves(db_dir):
    data = open(f"{db_dir}/5HOLID.CDX", "rb").read()
    assert len(data) == 8 * PAGE  # two leaves and one interior root
    root = struct.unpack_from("<I", data, 2 * PAGE)[0]
    assert root == 7 * PAGE
    assert struct.unpack_from("<HH", data, root) == (1, 2)
    leaves = [struct.unpack_from("<HHii", data, n * PAGE) for n in (5, 6)]
    assert leaves[0][0] == leaves[1][0] == 2
    assert leaves[0][1] + leaves[1][1] == 65
    assert (leaves[0][2], leaves[0][3]) == (-1, 6 * PAGE)
    assert (leaves[1][2], leaves[1][3]) == (5 * PAGE, -1)
    index = read_cdx(f"{db_dir}/5HOLID.CDX")
    assert [recno for _, recno in index.entries] == list(range(1, 66))


def test_character_index_with_several_leaves(db_dir):
    index = read_cdx(f"{db_dir}/5MASHI.CDX")
    assert index.key_length == 22 and len(index.entries) == 206
    assert os.path.getsize(f"{db_dir}/5MASHI.CDX") > 7 * PAGE
    first_key, first_recno = index.entries[0]
    assert first_key == b"          1        104" and first_recno == 1


def test_large_table_roundtrip(tmp_path):
    rows = [
        {"ID": 1 + n % 40, "EMPLOYEEID": 100 + n // 40, "DATE": "2024-01-01"} for n in range(4000)
    ]
    path = create_table(str(tmp_path), "MASHI", rows)
    index = read_cdx(str(tmp_path / "5MASHI.CDX"))
    assert len(index.entries) == 4000
    assert index.entries == _build_keys(path, index.key_expression)


def test_tree_with_several_interior_levels(tmp_path):
    keys = [(_numeric_key(n), n) for n in range(1, 60001)]
    path = tmp_path / "X.CDX"
    path.write_bytes(build_cdx(keys, "ID"))
    data = path.read_bytes()
    root = struct.unpack_from("<I", data, 2 * PAGE)[0]
    assert root == len(data) - PAGE
    assert struct.unpack_from("<H", data, root)[0] == 1
    level_below = struct.unpack_from(">I", data, root + 12 + 8 + 4)[0]
    assert struct.unpack_from("<H", data, level_below)[0] == 0  # interior, not root
    assert read_cdx(str(path)).entries == keys


def test_deleted_records_are_not_indexed(db_dir):
    path = f"{db_dir}/5HOLID.DBF"
    with open(path, "r+b") as f:
        f.seek(struct.unpack_from("<H", open(path, "rb").read(10), 8)[0])
        f.write(b"*")
    assert write_cdx(path) == f"{db_dir}/5HOLID.CDX"
    index = read_cdx(f"{db_dir}/5HOLID.CDX")
    assert [recno for _, recno in index.entries] == list(range(2, 66))


def test_write_cdx_keeps_tag_and_raises_counter(db_dir):
    cdx = f"{db_dir}/5WOPL.CDX"
    with open(cdx, "r+b") as f:
        f.seek(8)
        f.write(struct.pack(">I", 4711))
    path = f"{db_dir}/5WOPL.DBF"
    append_record(path, get_table_fields(path), {"ID": 9, "NAME": "x"})
    index = read_cdx(cdx)
    assert (index.counter, index.tag, len(index.entries)) == (4712, "ID_TAG", 3)
    assert open(cdx, "rb").read() == build_cdx_bytes(path, "ID", 4712)
    assert write_cdx(path) == cdx and read_cdx(cdx).counter == 4712


def test_write_cdx_creates_missing_index_from_schema(db_dir):
    path = f"{db_dir}/5GRASG.DBF"
    expected = open(f"{db_dir}/5GRASG.CDX", "rb").read()
    os.remove(f"{db_dir}/5GRASG.CDX")
    assert write_cdx(path) == f"{db_dir}/5GRASG.CDX"
    created = open(f"{db_dir}/5GRASG.CDX", "rb").read()
    assert created[:8] + created[12:] == expected[:8] + expected[12:]
    assert read_cdx(f"{db_dir}/5GRASG.CDX").counter == 0

    os.rename(f"{db_dir}/5WOPL.CDX", f"{db_dir}/5WOPL.cdx")
    assert write_cdx(f"{db_dir}/5WOPL.DBF") == f"{db_dir}/5WOPL.cdx"


def test_write_cdx_for_other_tables(db_dir):
    os.rename(f"{db_dir}/5WOPL.DBF", f"{db_dir}/OTHER.DBF")
    assert write_cdx(f"{db_dir}/OTHER.DBF") is None
    os.rename(f"{db_dir}/5WOPL.CDX", f"{db_dir}/OTHER.CDX")
    assert write_cdx(f"{db_dir}/OTHER.DBF") == f"{db_dir}/OTHER.CDX"
    assert cdx_writer._read_key_expr(f"{db_dir}/5WOPL.CDX") is None
    assert cdx_writer._read_tag_name(f"{db_dir}/5WOPL.CDX") is None


@pytest.mark.parametrize(
    ("keylen", "records", "expected"),
    [
        (8, 0, (16, 4, 3)),
        (10, 0, (16, 4, 3)),
        (22, 0, (14, 5, 3)),
        (33, 0, (12, 6, 3)),
        (33, 4095, (12, 6, 3)),
        (33, 4096, (20, 6, 4)),
        (22, 16383, (14, 5, 3)),
        (22, 16384, (22, 5, 4)),
        (8, 65535, (16, 4, 3)),
        (8, 65536, (24, 4, 4)),
    ],
)
def test_leaf_entry_layout(keylen, records, expected):
    assert cdx_writer._entry_bit_layout(keylen, records) == expected


def test_record_numbers_beyond_three_byte_entries(tmp_path):
    rows = [{"ID": 1, "EMPLOYEEID": 1 + n, "CYCLEASSID": 1} for n in range(5000)]
    path = create_table(str(tmp_path), "CYEXC", rows)
    data = open(tmp_path / "5CYEXC.CDX", "rb").read()
    assert data[5 * PAGE + 20 : 5 * PAGE + 24] == bytes([20, 6, 6, 4])
    index = read_cdx(str(tmp_path / "5CYEXC.CDX"))
    assert index.entries == _build_keys(path, index.key_expression)
    assert index.entries[-1][1] == 5000


@pytest.mark.parametrize("size", [100, 3 * PAGE, 6 * PAGE + 1])
def test_read_cdx_rejects_other_files(tmp_path, size):
    path = tmp_path / "X.CDX"
    path.write_bytes(b"\x00" * size)
    with pytest.raises(ValueError):
        read_cdx(str(path))


def test_read_cdx_rejects_two_tags(db_dir):
    cdx = f"{db_dir}/5WOPL.CDX"
    data = bytearray(open(cdx, "rb").read())
    struct.pack_into("<H", data, 4 * PAGE + 2, 2)
    open(cdx, "wb").write(bytes(data))
    with pytest.raises(ValueError, match="one tag"):
        read_cdx(cdx)


def test_compat_helpers(db_dir):
    assert cdx_writer._read_key_expr(f"{db_dir}/5GRASG.CDX") == "STR(ID,11)+STR(EMPLOYEEID,11)"
    assert cdx_writer._read_tag_name(f"{db_dir}/5GRASG-L.CDX") == "NUMBER_TAG"
    assert len(find_all_records(f"{db_dir}/5GRASG.DBF")) == 17
