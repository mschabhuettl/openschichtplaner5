import csv
import io
import json
import os

import pytest

from sp5lib import __version__, cli


def run(capsys, *argv):
    code = cli.main(list(argv))
    captured = capsys.readouterr()
    return code, captured.out, captured.err


def test_info(db_dir, capsys):
    code, out, _ = run(capsys, "info", db_dir)
    assert code == 0
    lines = out.splitlines()
    assert len(lines) == 31
    row = next(line.split() for line in lines if line.startswith("5EMPL"))
    assert row[:4] == ["5EMPL", "14", "0", "38"]
    code, out, _ = run(capsys, "info", db_dir, "--journals")
    assert len(out.splitlines()) == 61


def test_info_counts_deleted_and_unreadable(db_dir, capsys):
    with open(f"{db_dir}/5WOPL.DBF", "r+b") as f:
        f.seek(353)
        f.write(b"*")
    with open(f"{db_dir}/5NOTE.DBF", "wb") as f:
        f.write(b"\x03")
    _, out, _ = run(capsys, "info", db_dir)
    assert next(line.split() for line in out.splitlines() if line.startswith("5WOPL"))[1:3] == [
        "1",
        "1",
    ]
    assert "5NOTE.DBF    unreadable" in out


def test_info_empty_directory(tmp_path, capsys):
    code, _, err = run(capsys, "info", str(tmp_path))
    assert code == 1 and "No .DBF files" in err
    assert run(capsys, "info", str(tmp_path / "missing"))[0] == 1


def test_dump_json(db_dir, capsys):
    code, out, _ = run(capsys, "dump", db_dir, "empl", "--limit", "2")
    rows = json.loads(out)
    assert code == 0 and [r["NAME"] for r in rows] == ["Muster", "Beispiel"]
    _, out, _ = run(capsys, "dump", db_dir, "5USER", "--json")
    assert len(json.loads(out)[0]["DIGEST"]) == 32  # bytes are printed as hex


def test_dump_csv(db_dir, capsys):
    code, out, _ = run(capsys, "dump", db_dir, "5DADEM", "--csv")
    rows = list(csv.DictReader(io.StringIO(out)))
    assert (
        code == 0 and rows[0]["START2"] == "2024-01-07" and rows[0]["DESCRIPT"] == "Inventurwoche"
    )


def test_dump_unknown_table(db_dir, capsys):
    code, _, err = run(capsys, "dump", db_dir, "NOPE")
    assert code == 1 and "not found" in err


def test_validate_ok(db_dir, capsys):
    code, out, _ = run(capsys, "validate", db_dir)
    assert code == 0 and "60 of 60 tables without findings" in out


def test_validate_reports_problems(db_dir, capsys):
    os.remove(f"{db_dir}/5WOPL.DBF")
    os.remove(f"{db_dir}/5SHIFT.CDX")
    with open(f"{db_dir}/5NOTE.DBF", "wb") as f:
        f.write(b"\x03")
    with open(f"{db_dir}/5EMPL.DBF", "ab") as f:
        f.write(b"garbage")
    with open(f"{db_dir}/5GROUP.CDX", "wb") as f:
        f.write(b"\x00" * 512)
    with open(f"{db_dir}/5HOLID.DBF", "r+b") as f:
        f.seek(193)
        f.write(b"*")
    os.replace(f"{db_dir}/5BOOK.DBF", f"{db_dir}/5OVER.DBF")
    code, out, _ = run(capsys, "validate", db_dir)
    findings = {line.split()[1]: line for line in out.splitlines() if line.startswith("FAIL")}
    assert code == 1
    assert "file missing" in findings["5WOPL"]
    assert "no index file" in findings["5SHIFT"]
    assert "header unreadable" in findings["5NOTE"]
    assert "file size" in findings["5EMPL"]
    assert "index file unreadable" in findings["5GROUP"]
    assert "does not match the records" in findings["5HOLID"]
    assert "fields differ" in findings["5OVER"]
    assert "52 of 60" in out


def test_create(tmp_path, capsys):
    target = str(tmp_path / "new")
    code, out, _ = run(capsys, "create", target)
    assert code == 0 and "60 empty tables" in out
    assert run(capsys, "validate", target)[0] == 0
    code, _, err = run(capsys, "create", target)
    assert code == 1 and "already contains" in err


def test_version(capsys):
    with pytest.raises(SystemExit):
        cli.main(["--version"])
    assert capsys.readouterr().out.strip() == f"sp5lib {__version__}"
