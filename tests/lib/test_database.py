import os
from datetime import date

import pytest

from sp5lib.cdx_writer import _build_keys, read_cdx
from sp5lib.database import SP5Database
from sp5lib.schema import TABLES


def test_requires_directory(tmp_path):
    with pytest.raises(FileNotFoundError):
        SP5Database(tmp_path / "missing")


def test_tables_and_paths(db, db_dir):
    assert db.tables() == list(TABLES)
    assert db.table_path("empl") == os.path.join(db_dir, "5EMPL.DBF")
    assert db.schema("EMPL").name == "5EMPL"
    assert len(db.fields("5EMPL")) == 38
    os.rename(f"{db_dir}/5WOPL.DBF", f"{db_dir}/5wopl.dbf")
    assert db.table_path("WOPL").endswith("5wopl.dbf")
    os.remove(f"{db_dir}/5wopl.dbf")
    assert "5WOPL" not in db.tables()


def test_read_every_table(db):
    counts = {name: len(db.read(name)) for name in TABLES}
    assert counts["5EMPL"] == 14 and counts["5MASHI"] == 206 and counts["5HOLID"] == 65
    assert all(counts.values())
    assert db.journal("EMPL") == []


def test_employees(db):
    employees = db.get_employees()
    assert len(employees) == 13
    assert [e["POSITION"] for e in employees] == sorted(e["POSITION"] for e in employees)
    assert len(db.get_employees(include_hidden=True)) == 14
    assert db.get("EMPL", 112)["NAME"] == "Παράδειγμα"
    assert db.get("EMPL", 999) is None


def test_groups_and_members(db):
    groups = db.get_groups()
    assert [g["NAME"] for g in groups] == ["Betrieb", "Station A", "Station B", "Büro"]
    assert [g["SUPERID"] for g in groups] == [0, 1, 1, 1]
    assert db.get_group_members(4) == [101, 106, 111, 113, 114]
    assert db.get_employee_groups(101) == [2, 4]
    assert db.get_employee_groups(999) == []


def test_master_data(db):
    assert [s["SHORTNAME"] for s in db.get_shifts()] == ["F", "S", "N", "T"]
    assert len(db.get_shifts(include_hidden=True)) == 5
    night = db.get_shifts()[2]
    assert night["STARTEND0"] == "22:00-06:00" and night["DURATION7"] == 8.0
    assert [t["SHORTNAME"] for t in db.get_leave_types()] == ["U", "K", "FB", "ZA"]
    assert [w["NAME"] for w in db.get_workplaces()] == ["Empfang", "Leitstand"]
    assert [x["START"] for x in db.get_extracharges()] == [1320, 0]
    assert db.get_settings()["ANOANAME"] == "Abwesend"


def test_holidays(db):
    assert len(db.get_holidays()) == 65
    year = db.get_holidays(2024)
    assert len(year) == 13
    assert [h["DATE"] for h in year] == sorted(h["DATE"] for h in year)
    assert {h["INTERVAL"] for h in year if h["DATE"] >= "2024-12-24"} == {0, 2}


def test_cycles(db):
    (cycle,) = db.get_cycles()
    assert (cycle["SIZE"], cycle["UNIT"]) == (2, 1)
    assert [e["INDEX"] for e in cycle["entries"]] == [0, 1, 2, 3, 4, 7, 8, 9, 10, 11]
    assert len(db.get_cycle_assignments()) == 3
    assert db.get_cycle_assignments(103)[0]["END"] == "2024-03-31"
    duties = db.get_cycle_duties(date(2024, 1, 8), date(2024, 1, 14))
    assert duties, "cycle assignments expand to duties"


def test_users_hide_the_digest(db):
    users = db.get_users()
    assert [u["NAME"] for u in users] == ["Leitung", "Station"]
    assert all("DIGEST" not in u for u in users)


def test_dated_tables(db):
    assert len(db.get_duties()) == 206
    week = db.get_duties("2024-01-08", date(2024, 1, 14))
    assert week and all("2024-01-08" <= d["DATE"] <= "2024-01-14" for d in week)
    mine = db.get_duties(employee_id=104)
    assert mine and {d["EMPLOYEEID"] for d in mine} == {104}
    assert [a["DATE"] for a in db.get_absences(employee_id=101)] == [
        f"2024-01-{day}" for day in range(15, 20)
    ]
    assert len(db.get_special_shifts("2024-01-20", "2024-01-20")) == 2
    assert [n["EMPLOYEEID"] for n in db.get_notes("2024-01-08", "2024-01-08")] == [101, 102]
    assert [o["HOURS"] for o in db.get_overtimes()] == [1.5, -0.75]
    assert [b["VALUE"] for b in db.get_bookings(end="2024-01-01")] == [12.25]


def test_periods_overlap(db):
    assert len(db.get_periods()) == 1
    assert len(db.get_periods("2024-01-26", "2024-02-10")) == 1
    assert db.get_periods("2024-01-27", "2024-02-10") == []
    assert db.get_periods(end="2024-01-21") == []


def test_schedule(db):
    entries = db.get_schedule("2024-01-20", "2024-01-20")
    kinds = [e["kind"] for e in entries]
    assert kinds.count("special_shift") == 2 and "duty" in kinds
    assert entries == sorted(entries, key=lambda e: (e["DATE"], e["EMPLOYEEID"]))
    one = db.get_schedule("2024-01-01", "2024-01-31", employee_id=107)
    assert {e["kind"] for e in one} == {"duty", "absence"}


# --- writing ---


def assert_index_matches(db, table):
    path = db.table_path(table)
    index = read_cdx(os.path.splitext(path)[0] + ".CDX")
    assert index.entries == _build_keys(path, index.key_expression)


def test_insert_master_record(db):
    new_id = db.insert(
        "SHIFT", {"NAME": "Zwischendienst", "SHORTNAME": "Z", "STARTEND0": "10:00-18:00"}
    )
    assert new_id == 6
    shift = db.get("SHIFT", 6)
    assert shift["NAME"] == "Zwischendienst" and shift["DURATION0"] == 0.0 and shift["HIDE"] == 0
    assert db.journal("SHIFT") == [
        {"NUMBER": 1, "CHANGEID1": 6, "CHANGEID2": 0, "CHANGEID3": 0, "CHANGE": 0}
    ]
    assert_index_matches(db, "SHIFT")


def test_insert_numbers_per_owner(db):
    assert db.insert("MASHI", {"EMPLOYEEID": 101, "DATE": "2024-02-01", "SHIFTID": 1}) == 1
    assert db.insert("MASHI", {"EMPLOYEEID": 101, "DATE": "2024-02-02", "SHIFTID": 1}) == 2
    highest = max(d["ID"] for d in db.get_duties(employee_id=104))
    assert (
        db.insert("MASHI", {"EMPLOYEEID": 104, "DATE": "2024-02-01", "SHIFTID": 2}) == highest + 1
    )
    assert db.insert("CYEXC", {"EMPLOYEEID": 101, "CYCLEASSID": 1, "DATE": "2024-01-10"}) == 2
    assert db.insert("CYEXC", {"EMPLOYEEID": 102, "CYCLEASSID": 1, "DATE": "2024-01-10"}) == 1
    assert_index_matches(db, "MASHI")


def test_insert_ignores_id_and_rejects_unknown_fields(db):
    assert db.insert("WOPL", {"ID": 50, "NAME": "Lager"}) == 3
    with pytest.raises(KeyError, match="NOPE"):
        db.insert("WOPL", {"NOPE": 1})


def test_get_with_composite_key(db):
    assert db.get("ABSEN", (2, 107))["INTERVAL"] == 3
    assert db.get("ABSEN", 2) is None  # two employees have an absence number 2
    assert db.get("ABSEN", (99, 107)) is None
    with pytest.raises(KeyError):
        db.get("ABSEN", (1, 2, 3))


def test_update(db):
    db.update("EMPL", 105, {"PHONE": "0000 123", "HIDE": 1})
    assert db.get("EMPL", 105)["PHONE"] == "0000 123"
    assert 105 not in [e["ID"] for e in db.get_employees()]
    db.update("ABSEN", (2, 107), {"START": 480})
    assert db.get("ABSEN", (2, 107))["START"] == 480
    db.update("DADEM", (1, 3), {"START2": "2024-01-10"})
    assert db.get("DADEM", (1, 3))["START2"] == "2024-01-10"


def test_update_refuses_keys_and_unknown_fields(db):
    for changes in ({"ID": 7}, {"NOPE": 1}):
        with pytest.raises(KeyError):
            db.update("EMPL", 105, changes)
    with pytest.raises(KeyError):
        db.update("MASHI", (1, 104), {"EMPLOYEEID": 105})
    with pytest.raises(KeyError, match="no record"):
        db.update("EMPL", 999, {"NAME": "x"})
    with pytest.raises(KeyError, match="more than one"):
        db.update("ABSEN", 2, {"START": 1})


def test_delete_and_compact(db):
    db.delete("NOTE", (1, 102))
    assert [n["ID"] for n in db.get_notes(employee_id=102)] == [2]
    assert db.journal("NOTE")[-1] == {
        "NUMBER": 1, "CHANGEID1": 1, "CHANGEID2": 102, "CHANGEID3": 0, "CHANGE": 2,
    }  # fmt: skip
    db.insert("WOPL", {"NAME": "Lager"})
    with pytest.raises(KeyError):
        db.delete("NOTE", (1, 102))
    build = db.read("BUILD")[0]
    assert (build["BUILD"], build["CHANGE"]) == (1, 3)

    assert db.compact() == 1
    assert len(db.read("NOTE")) == 2 and len(db.read("WOPL")) == 3
    assert db.journal("NOTE") == [] and db.journal("WOPL") == []
    build = db.read("BUILD")[0]
    assert (build["BUILD"], build["CHANGE"]) == (2, 0)
    for table in ("NOTE", "WOPL"):
        assert_index_matches(db, table)
    assert db.compact() == 0
    assert db.read("BUILD")[0]["BUILD"] == 3


def test_generated_rows_refer_to_existing_employees(db):
    # SP5 refuses to open a database with a row for an employee that does not exist
    employees = {e["ID"] for e in db.get_employees()}
    for table in ("5MASHI", "5SPSHI", "5ABSEN", "5NOTE", "5OVER", "5BOOK", "5CYASS", "5CYEXC"):
        assert {r["EMPLOYEEID"] for r in db.read(table)} <= employees, table
