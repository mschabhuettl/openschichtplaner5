import os
from datetime import date

import pytest

from sp5lib import schema
from sp5lib.dbf_reader import get_table_fields, read_dbf, read_header


def test_thirty_tables_with_reserved_last():
    assert len(schema.TABLES) == 30
    for table in schema.TABLES.values():
        assert table.fields[0].name == "ID"
        assert table.fields[-1].name == "RESERVED"


def test_key_fields():
    assert schema.TABLES["5EMPL"].key_fields == ("ID",)
    assert schema.TABLES["5MASHI"].key_fields == ("ID", "EMPLOYEEID")
    assert schema.TABLES["5CYEXC"].key_fields == ("ID", "EMPLOYEEID", "CYCLEASSID")


@pytest.mark.parametrize("name", ["5EMPL", "EMPL", "empl", "5empl.dbf", "/data/5EMPL.DBF"])
def test_table_schema_accepts_name_variants(name):
    assert schema.table_schema(name) is schema.TABLES["5EMPL"]


def test_table_schema_journal_and_unknown():
    journal = schema.table_schema("5EMPL-L")
    assert [f.name for f in journal.fields] == [
        "NUMBER", "CHANGEID1", "CHANGEID2", "CHANGEID3", "CHANGE",
    ]  # fmt: skip
    assert (journal.tag, journal.key_expression) == ("NUMBER_TAG", "NUMBER")
    with pytest.raises(KeyError):
        schema.table_schema("5NOPE")
    with pytest.raises(KeyError):
        schema.table_schema("5NOPE-L")


def test_field_kinds():
    kinds = {f.name: f.kind for f in schema.TABLES["5USER"].fields}
    assert kinds["NAME"] == "text"
    assert kinds["DIGEST"] == "binary"
    assert kinds["CATEGORY"] == "ascii"
    assert kinds["RIGHTS"] == "number"
    assert kinds["RESERVED"] == "reserved"
    shift = {f.name: f.kind for f in schema.TABLES["5SHIFT"].fields}
    assert shift["STARTEND7"] == "ascii"
    assert shift["DURATION0"] == "float"
    assert shift["CATEGORY"] == "number"
    assert {f.name: f.kind for f in schema.TABLES["5HOLID"].fields}["DATE"] == "date"


def test_new_record_defaults_and_duplicate_field():
    record = schema.TABLES["5DADEM"].new_record({"GROUPID": 3, "START2": "2024-01-07"})
    assert record == {
        "ID": 0, "GROUPID": 3, "START": None, "START2": "2024-01-07", "DAILYDEM": "",
        "DESCRIPT": "", "RESERVED": "",
    }  # fmt: skip
    with pytest.raises(KeyError, match="NOPE"):
        schema.TABLES["5DADEM"].new_record({"NOPE": 1})


def test_create_database_writes_all_files(tmp_path):
    schema.create_database(str(tmp_path), stamp=date(2024, 2, 29))
    names = sorted(os.listdir(tmp_path))
    assert len(names) == 120
    assert {os.path.splitext(n)[1] for n in names} == {".DBF", ".CDX"}
    for name in schema.TABLES:
        path = str(tmp_path / f"{name}.DBF")
        header = read_header(path)
        table = schema.TABLES[name]
        assert header.version == 3 and header.has_index and header.codepage == 0
        assert header.last_update == date(2024, 2, 29)
        assert (header.record_count, header.header_size, header.record_size) == (
            0, table.header_size, table.record_size,
        )  # fmt: skip
        assert os.path.getsize(path) == table.header_size + 1
        assert get_table_fields(path) == table.field_dicts()
        assert read_dbf(path) == []


def test_create_table_with_records(tmp_path):
    rows = [{"ID": 2, "NAME": "Empfang"}, {"ID": 1, "NAME": "Leitstand", "HIDE": 1}]
    path = schema.create_table(str(tmp_path), "WOPL", rows)
    assert os.path.basename(path) == "5WOPL.DBF"
    assert [(r["ID"], r["NAME"], r["HIDE"]) for r in read_dbf(path)] == [
        (2, "Empfang", 0), (1, "Leitstand", 1),
    ]  # fmt: skip
