import pytest
from fastapi.testclient import TestClient

from sp5api import __main__, __version__
from sp5api.app import create_app
from sp5lib.database import SP5Database


@pytest.fixture
def client(db_dir):
    return TestClient(create_app(db_dir))


@pytest.fixture
def writer(db_dir):
    return TestClient(create_app(db_dir, readonly=False))


def test_health(client):
    assert client.get("/api/health").json() == {
        "status": "ok", "version": __version__, "sp5lib": "1.0.0", "tables": 30, "readonly": True,
    }  # fmt: skip


def test_tables(client):
    tables = client.get("/api/tables").json()
    assert len(tables) == 30
    empl = next(t for t in tables if t["name"] == "5EMPL")
    assert empl["records"] == 14 and empl["key"] == ["ID"] and len(empl["fields"]) == 38
    assert next(t for t in tables if t["name"] == "5MASHI")["key"] == ["ID", "EMPLOYEEID"]


def test_table_records(client):
    assert len(client.get("/api/tables/5HOLID").json()) == 65
    assert len(client.get("/api/tables/holid").json()) == 65
    assert client.get("/api/tables/5EMPL-L").json() == []
    build = client.get("/api/tables/5BUILD").json()[0]
    assert build["UUID"] == bytes(range(16)).hex()
    assert client.get("/api/tables/NOPE").status_code == 404


def test_table_record(client):
    assert client.get("/api/tables/5SHIFT/3").json()["NAME"] == "Nachtdienst"
    assert client.get("/api/tables/5ABSEN/2,107").json()["INTERVAL"] == 3
    assert client.get("/api/tables/5ABSEN/2").status_code == 404
    assert client.get("/api/tables/5SHIFT/99").status_code == 404
    assert client.get("/api/tables/5SHIFT/abc").status_code == 422
    assert client.get("/api/tables/5SHIFT-L/1").status_code == 404


def test_password_digest_is_never_returned(client):
    for url in ("/api/users", "/api/tables/5USER", "/api/tables/5USER/251"):
        assert "DIGEST" not in client.get(url).text


def test_employees(client):
    assert len(client.get("/api/employees").json()) == 13
    assert len(client.get("/api/employees", params={"include_hidden": True}).json()) == 14
    members = client.get("/api/employees", params={"group_id": 4}).json()
    assert [e["ID"] for e in members] == [101, 106, 111, 113]
    one = client.get("/api/employees/112").json()
    assert one["NAME"] == "Παράδειγμα" and one["groups"] == [3]
    assert client.get("/api/employees/999").status_code == 404


def test_master_data(client):
    groups = client.get("/api/groups").json()
    assert [g["NAME"] for g in groups] == ["Betrieb", "Station A", "Station B", "Büro"]
    assert groups[3]["members"] == [101, 106, 111, 113, 114]
    assert len(client.get("/api/shifts").json()) == 4
    assert len(client.get("/api/shifts?include_hidden=true").json()) == 5
    assert len(client.get("/api/leave-types").json()) == 4
    assert len(client.get("/api/workplaces").json()) == 2
    assert len(client.get("/api/extracharges").json()) == 2
    assert len(client.get("/api/holidays?year=2024").json()) == 13
    assert len(client.get("/api/cycles").json()[0]["entries"]) == 10
    assert len(client.get("/api/cycle-assignments?employee_id=102").json()) == 1
    assert [u["NAME"] for u in client.get("/api/users").json()] == ["Leitung", "Station"]
    assert client.get("/api/settings").json()["ANOASHORT"] == "X"


def test_settings_missing(db_dir):
    db = SP5Database(db_dir)
    db.delete("USETT", 0)
    assert TestClient(create_app(db_dir)).get("/api/settings").status_code == 404


def test_dated_data(client):
    week = {"start": "2024-01-08", "end": "2024-01-14"}
    duties = client.get("/api/duties", params=week).json()
    assert duties and all("2024-01-08" <= d["DATE"] <= "2024-01-14" for d in duties)
    assert len(client.get("/api/duties").json()) == 206
    assert len(client.get("/api/absences?employee_id=101").json()) == 5
    assert len(client.get("/api/special-shifts").json()) == 3
    assert len(client.get("/api/notes", params=week).json()) == 2
    assert len(client.get("/api/overtimes").json()) == 2
    assert len(client.get("/api/bookings?employee_id=104").json()) == 1
    assert len(client.get("/api/periods", params={"start": "2024-01-26"}).json()) == 1
    assert client.get("/api/duties?start=yesterday").status_code == 422


def test_schedule(client):
    day = {"start": "2024-01-20", "end": "2024-01-20"}
    kinds = [e["kind"] for e in client.get("/api/schedule", params=day).json()]
    assert kinds.count("special_shift") == 2 and "cycle_duty" not in kinds
    week = {"start": "2024-01-08", "end": "2024-01-12", "include_cycles": True, "employee_id": 101}
    entries = client.get("/api/schedule", params=week).json()
    derived = [e["DATE"] for e in entries if e["kind"] == "cycle_duty"]
    assert derived == [
        "2024-01-08",
        "2024-01-10",
        "2024-01-11",
        "2024-01-12",
    ]  # 9th is an exception
    assert (
        client.get("/api/schedule", params={"start": "2024-01-02", "end": "2024-01-01"}).status_code
        == 422
    )
    assert client.get("/api/schedule").status_code == 422


# --- token ---


def test_token_required(db_dir):
    client = TestClient(create_app(db_dir, token="s3cret"))
    assert client.get("/api/health").status_code == 401
    assert client.get("/api/health", headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert client.get("/api/health", headers={"Authorization": "Bearer s3cret"}).status_code == 200


def test_settings_from_environment(db_dir, monkeypatch):
    monkeypatch.setenv("SP5_DB_PATH", db_dir)
    monkeypatch.setenv("SP5_API_TOKEN", "abc")
    monkeypatch.setenv("SP5_READONLY", "0")
    client = TestClient(create_app())
    assert client.get("/api/health").status_code == 401
    health = client.get("/api/health", headers={"Authorization": "Bearer abc"}).json()
    assert health["readonly"] is False
    monkeypatch.delenv("SP5_DB_PATH")
    with pytest.raises(RuntimeError):
        create_app()


# --- writing ---


def test_read_only_by_default(client):
    assert client.post("/api/tables/5NOTE", json={"EMPLOYEEID": 101}).status_code == 403
    assert client.put("/api/tables/5SHIFT/1", json={"NAME": "x"}).status_code == 403
    assert client.delete("/api/tables/5SHIFT/1").status_code == 403


def test_insert_update_delete(writer, db_dir):
    created = writer.post(
        "/api/tables/5MASHI", json={"EMPLOYEEID": 101, "DATE": "2024-02-01", "SHIFTID": 2}
    )
    assert created.status_code == 201 and created.json() == {"ID": 1, "key": "1,101"}
    assert writer.get("/api/tables/5MASHI/1,101").json()["SHIFTID"] == 2

    updated = writer.put("/api/tables/5MASHI/1,101", json={"SHIFTID": 3, "WORKPLACID": 2})
    assert updated.status_code == 200 and updated.json()["SHIFTID"] == 3

    assert writer.delete("/api/tables/5MASHI/1,101").status_code == 204
    assert writer.get("/api/tables/5MASHI/1,101").status_code == 404
    assert writer.delete("/api/tables/5MASHI/1,101").status_code == 404
    journal = SP5Database(db_dir).journal("MASHI")
    assert [r["CHANGE"] for r in journal] == [1, 1, 2]


def test_insert_master_record(writer):
    created = writer.post("/api/tables/5WOPL", json={"NAME": "Lager", "SHORTNAME": "LA"})
    assert created.json() == {"ID": 3, "key": "3"}
    assert "Lager" in [w["NAME"] for w in writer.get("/api/workplaces").json()]


def test_write_errors(writer):
    assert writer.post("/api/tables/5WOPL", json={"NOPE": 1}).status_code == 422
    assert writer.post("/api/tables/5WOPL", json={"COLORBK": 10**12}).status_code == 422
    assert writer.put("/api/tables/5WOPL/1", json={"ID": 5}).status_code == 422
    assert writer.put("/api/tables/5WOPL/99", json={"NAME": "x"}).status_code == 404
    assert writer.post("/api/tables/NOPE", json={}).status_code == 404
    for table in ("5USER", "5BUILD", "5EMPL-L"):
        assert writer.post(f"/api/tables/{table}", json={}).status_code == 403


# --- command line ---


def test_main_starts_server(db_dir, monkeypatch):
    calls = []
    monkeypatch.setattr(__main__.uvicorn, "run", lambda app, **kw: calls.append((app, kw)))
    __main__.main([db_dir, "--port", "8123", "--write"])
    app, options = calls[0]
    assert options == {"host": "127.0.0.1", "port": 8123}
    assert TestClient(app).get("/api/health").json()["readonly"] is False


def test_main_needs_a_database(monkeypatch):
    monkeypatch.delenv("SP5_DB_PATH", raising=False)
    with pytest.raises(SystemExit):
        __main__.main([])
