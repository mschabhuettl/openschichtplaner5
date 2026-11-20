"""Generator for synthetic Schichtplaner 5 databases used by the tests.

``generate(directory)`` writes a complete database (30 tables, journals and
index files) with invented content: a small company with employees, groups,
shift types, absence types, a shift cycle and a planned month. Nothing in
it comes from a real database.
"""

import hashlib
from datetime import date, timedelta
from typing import Any

from sp5lib.schema import TABLES, create_database, create_table

Rows = list[dict[str, Any]]

YEAR = 2024
MONTH_START = date(YEAR, 1, 1)
MONTH_DAYS = 31

SURNAMES = [
    "Muster", "Beispiel", "Probe", "Vorlage", "Platzhalter", "Entwurf", "Schablone",
    "Formular", "Blanko", "Attrappe", "Müßiggang", "Παράδειγμα", "示例", "Ünal-Beispiel",
]  # fmt: skip
FIRST_NAMES = [
    "Erika", "Max", "Anna", "Jan", "Mia", "Tom", "Lea", "Ben", "Ida", "Paul", "Jörg",
    "Ελένη", "明", "Özlem",
]  # fmt: skip

WHITE = 0xFFFFFF
#: Password of the generated users; SP5 stores the MD5 digest of the UTF-16 text.
PASSWORD = "geheim"


def _slots(*values: Any) -> str:
    return "".join(f"{v} " for v in values)


def employees() -> Rows:
    rows = []
    for i, (name, first) in enumerate(zip(SURNAMES, FIRST_NAMES, strict=True)):
        rows.append(
            {
                "ID": 101 + i,
                "POSITION": i + 1,
                "NUMBER": f"P{i + 1:03d}",
                "NAME": name,
                "FIRSTNAME": first,
                "SHORTNAME": (first[0] + name[:2]).upper(),
                "STREET": f"Testweg {i + 1}",
                "ZIP": "00000",
                "TOWN": "Musterstadt",
                "SEX": i % 2,
                "BIRTHDAY": date(1970 + i, 1 + i % 12, 1 + i),
                "EMPSTART": date(2015 + i % 5, 1, 1),
                "EMPEND": date(YEAR, 6, 30) if i == 9 else None,
                "CALCBASE": i % 4,
                "HRSDAY": 7.7,
                "HRSWEEK": 38.5,
                "HRSMONTH": 154.0,
                "HRSTOTAL": 1800.0 if i % 4 == 3 else 0.0,
                "WORKDAYS": _slots(1, 1, 1, 1, 1, 0, 0, 0),
                "DEDUCTHOL": 1,
                "CBKLABEL": WHITE,
                "CBKSCHED": WHITE,
                "BOLD": int(i == 0),
                "HIDE": int(i == 13),
                "NOTE1": "Schlüssel 12" if i == 2 else "",
            }
        )
    return rows


def groups() -> Rows:
    names = [
        ("Betrieb", "BT", 0),
        ("Station A", "STA", 1),
        ("Station B", "STB", 1),
        ("Büro", "BÜ", 1),
    ]
    return [
        {
            "ID": 1 + i,
            "NAME": name,
            "SHORTNAME": short,
            "SUPERID": parent,
            "POSITION": i + 1,
            "DAILYDEM": _slots(2, 2, 2, 2, 2, 1, 1, 1),
            "CBKLABEL": 0xE0E0E0,
            "CBKSCHED": 0xE0E0E0,
            "BOLD": 1,
        }
        for i, (name, short, parent) in enumerate(names)
    ]


def group_assignments() -> Rows:
    rows = []
    for i in range(len(SURNAMES)):
        employee = 101 + i
        memberships = [2 + i % 2] if i < 12 else [4]
        if i % 5 == 0:
            memberships.append(4)
        rows += [
            {"ID": n + 1, "EMPLOYEEID": employee, "GROUPID": g} for n, g in enumerate(memberships)
        ]
    return rows


def shifts() -> Rows:
    spec = [
        ("Frühdienst", "F", "06:00-14:00", 8.0, 0x00FFFF, 7, 0),
        ("Spätdienst", "S", "14:00-22:00", 8.0, 0x0080FF, 7, 0),
        ("Nachtdienst", "N", "22:00-06:00", 8.0, 0xFF8000, 8, 0),
        ("Tagdienst", "T", "08:00-16:00", 8.0, WHITE, 5, 0),
        ("Bereitschaft alt", "B", "00:00-00:00", 24.0, 0xC0C0C0, 8, 1),
    ]
    rows = []
    for i, (name, short, times, hours, colour, days, hide) in enumerate(spec):
        row: dict[str, Any] = {
            "ID": 1 + i,
            "NAME": name,
            "SHORTNAME": short,
            "POSITION": i + 1,
            "COLORBAR": colour,
            "COLORBK": colour,
            "BOLD": int(short == "N"),
            "HIDE": hide,
        }
        for slot in range(8):
            row[f"STARTEND{slot}"] = times if slot < days else ""
            row[f"DURATION{slot}"] = hours if slot < days else 0.0
        rows.append(row)
    return rows


def leave_types() -> Rows:
    spec = [
        ("Urlaub", "U", 0x00C000, 1, 0.0, 1, 30.0, 1, _slots(1, 1, 1, 1, 1, 0, 0, 0)),
        ("Krank", "K", 0x0000FF, 1, 0.0, 0, 0.0, 0, _slots(1, 1, 1, 1, 1, 1, 1, 1)),
        ("Fortbildung", "FB", 0xFF0080, 2, 6.0, 0, 0.0, 0, _slots(1, 1, 1, 1, 1, 0, 0, 0)),
        ("Zeitausgleich", "ZA", 0x808000, 0, 0.0, 0, 0.0, 0, _slots(1, 1, 1, 1, 1, 1, 1, 1)),
    ]
    return [
        {
            "ID": 1 + i,
            "NAME": name,
            "SHORTNAME": short,
            "POSITION": i + 1,
            "COLORBAR": colour,
            "COLORBK": WHITE,
            "CHARGETYP": charge,
            "CHARGEHRS": hours,
            "DEDUCTOVT": int(short == "ZA"),
            "ENTITLED": entitled,
            "STDENTIT": standard,
            "CARRYFWD": carry,
            "COUNTALL": 1,
            "VALIDDAYS": valid,
        }
        for i, (name, short, colour, charge, hours, entitled, standard, carry, valid) in enumerate(
            spec
        )
    ]


def workplaces() -> Rows:
    return [
        {"ID": 1 + i, "NAME": name, "SHORTNAME": short, "POSITION": i + 1, "COLORBAR": WHITE,
         "COLORBK": WHITE}
        for i, (name, short) in enumerate([("Empfang", "EM"), ("Leitstand", "LS")])
    ]  # fmt: skip


def holidays() -> Rows:
    """Thirteen days a year for five years: enough keys for an index with
    more than one leaf."""
    days = [(1, 1), (1, 6), (5, 1), (8, 15), (10, 26), (11, 1), (12, 8), (12, 24), (12, 25),
            (12, 26), (12, 31), (3, 19), (6, 24)]  # fmt: skip
    rows = []
    for year in range(YEAR - 2, YEAR + 3):
        for month, day in days:
            rows.append(
                {
                    "ID": len(rows) + 1,
                    "DATE": date(year, month, day),
                    "NAME": f"Feiertag {day}.{month}.",
                    "INTERVAL": 2 if (month, day) in ((12, 24), (12, 31)) else 0,
                }
            )
    return rows


def cycles() -> tuple[Rows, Rows, Rows, Rows]:
    """A two-week cycle, its entries, three assignments and one exception."""
    cycle = [{"ID": 1, "NAME": "Wechselschicht", "POSITION": 1, "SIZE": 2, "UNIT": 1}]
    pattern = [1, 1, 1, 1, 1, 0, 0, 2, 2, 2, 2, 2, 0, 0]
    entries = [
        {"ID": n + 1, "CYCLEEID": 1, "INDEX": i, "SHIFTID": shift, "WORKPLACID": 1 if i < 7 else 0}
        for n, (i, shift) in enumerate((i, s) for i, s in enumerate(pattern) if s)
    ]
    assignments = [
        {"ID": 1, "EMPLOYEEID": 101 + i, "CYCLEID": 1, "START": MONTH_START, "ENTRANCE": i % 2,
         "END": date(YEAR, 3 if i == 2 else 12, 31)}
        for i in range(3)
    ]  # fmt: skip
    exceptions = [{"ID": 1, "EMPLOYEEID": 101, "CYCLEASSID": 1, "DATE": date(YEAR, 1, 9)}]
    return cycle, entries, assignments, exceptions


def duties() -> Rows:
    """Entered duties for the employees without a cycle: four days on, two off."""
    rows = []
    for i in range(3, 13):
        number = 0
        for day in range(MONTH_DAYS):
            if (day + i) % 6 >= 4:
                continue
            number += 1
            rows.append(
                {
                    "ID": number,
                    "EMPLOYEEID": 101 + i,
                    "DATE": MONTH_START + timedelta(days=day),
                    "SHIFTID": 1 + (i + day // 6) % 3,
                    "WORKPLACID": 1 + i % 2 if i % 3 == 0 else 0,
                }
            )
    return rows


def special_shifts() -> Rows:
    return [
        {"ID": 1, "EMPLOYEEID": 104, "DATE": date(YEAR, 1, 20), "NAME": "Inventur", "SHORTNAME": "IV",
         "COLORBAR": 0x00FFFF, "COLORBK": WHITE, "STARTEND": "07:00-12:30", "DURATION": 5.5},
        {"ID": 1, "EMPLOYEEID": 105, "DATE": date(YEAR, 1, 20), "NAME": "Inventur", "SHORTNAME": "IV",
         "COLORBAR": 0x00FFFF, "COLORBK": WHITE, "STARTEND": "07:00-12:30", "DURATION": 5.5,
         "WORKPLACID": 2, "NOEXTRA": 1},
        {"ID": 2, "EMPLOYEEID": 105, "DATE": date(YEAR, 1, 27), "NAME": "Frühdienst kurz",
         "SHORTNAME": "F", "SHIFTID": 1, "TYPE": 1, "COLORBAR": 0x00FFFF, "COLORBK": 0x00FFFF,
         "STARTEND": "06:00-10:00", "DURATION": 4.0},
    ]  # fmt: skip


def absences() -> Rows:
    rows = [
        {
            "ID": n + 1,
            "EMPLOYEEID": 101,
            "DATE": date(YEAR, 1, 15) + timedelta(days=n),
            "LEAVETYPID": 1,
        }
        for n in range(5)
    ]
    rows += [
        {"ID": 1, "EMPLOYEEID": 106, "DATE": date(YEAR, 1, 3), "LEAVETYPID": 2},
        {"ID": 2, "EMPLOYEEID": 106, "DATE": date(YEAR, 1, 4), "LEAVETYPID": 2},
        {"ID": 1, "EMPLOYEEID": 107, "DATE": date(YEAR, 1, 10), "LEAVETYPID": 3, "INTERVAL": 1},
        {"ID": 2, "EMPLOYEEID": 107, "DATE": date(YEAR, 1, 11), "LEAVETYPID": 4, "INTERVAL": 3,
         "START": 600, "END": 840},
    ]  # fmt: skip
    return rows


def users() -> tuple[Rows, Rows, Rows]:
    digest = hashlib.md5(PASSWORD.encode("utf-16-le")).digest()
    flags = ["WDUTIES", "WABSENCES", "WOVERTIMES", "WNOTES", "WDEVIATION", "WCYCLEASS", "WPAST",
             "WACCEMWND", "WACCGRWND", "SHOWNOTES", "SHOWSTATS", "RACCEMWND", "RACCGRWND",
             "ACCVOWND", "ACCADMWND"]  # fmt: skip
    rows = []
    for i, (name, text, admin) in enumerate(
        [("Leitung", "Dienstplanung", 1), ("Station", "Stationsleitung A", 0)]
    ):
        row: dict[str, Any] = {
            "ID": 251 + i, "POSITION": i, "NAME": name, "DESCRIP": text, "ADMIN": admin,
            "DIGEST": digest, "RIGHTS": 0 if admin else 2, "BACKUP": admin,
            "CATEGORY": _slots(1, *[0] * 19), "REPORT": _slots(*[1] * 20),
        }  # fmt: skip
        row.update(dict.fromkeys(flags, 1))
        rows.append(row)
    group_access = [{"ID": 1, "USERID": 252, "GROUPID": 2, "RIGHTS": 1}]
    employee_access = [{"ID": 1, "USERID": 252, "EMPLOYEEID": 113, "RIGHTS": 0}]
    return rows, group_access, employee_access


def tables() -> dict[str, Rows]:
    """All generated tables by name."""
    cycle, cycle_entries, cycle_assignments, cycle_exceptions = cycles()
    user_rows, group_access, employee_access = users()
    staff = [101 + i for i in range(len(SURNAMES))]
    return {
        "5EMPL": employees(),
        "5GROUP": groups(),
        "5GRASG": group_assignments(),
        "5SHIFT": shifts(),
        "5LEAVT": leave_types(),
        "5WOPL": workplaces(),
        "5HOLID": holidays(),
        "5CYCLE": cycle,
        "5CYENT": cycle_entries,
        "5CYASS": cycle_assignments,
        "5CYEXC": cycle_exceptions,
        "5MASHI": duties(),
        "5SPSHI": special_shifts(),
        "5ABSEN": absences(),
        "5NOTE": [
            {
                "ID": 1,
                "EMPLOYEEID": 101,
                "DATE": date(YEAR, 1, 8),
                "TEXT1": "Betriebsversammlung 14 Uhr",
            },
            {
                "ID": 1,
                "EMPLOYEEID": 102,
                "DATE": date(YEAR, 1, 8),
                "TEXT1": "kommt später",
                "TEXT2": "Zahnarzt",
            },
            {"ID": 2, "EMPLOYEEID": 102, "DATE": date(YEAR, 1, 22), "TEXT1": "τηλέφωνο 日本語"},
        ],  # fmt: skip
        "5OVER": [
            {"ID": 1, "EMPLOYEEID": 103, "DATE": date(YEAR, 1, 5), "HOURS": 1.5},
            {"ID": 2, "EMPLOYEEID": 103, "DATE": date(YEAR, 1, 12), "HOURS": -0.75},
        ],
        "5BOOK": [
            {
                "ID": 1,
                "EMPLOYEEID": 103,
                "DATE": MONTH_START,
                "TYPE": 2,
                "VALUE": 12.25,
                "NOTE": "Übertrag Vorjahr",
            },
            {
                "ID": 1,
                "EMPLOYEEID": 104,
                "DATE": date(YEAR, 1, 31),
                "TYPE": 0,
                "VALUE": -4.0,
                "NOTE": "Korrektur",
            },
        ],  # fmt: skip
        "5LEAEN": [
            {
                "ID": 1,
                "EMPLOYEEID": e,
                "YEAR": YEAR,
                "LEAVETYPID": 1,
                "ENTITLEMNT": 30.0,
                "REST": float(e % 4),
                "INDAYS": 1,
            }
            for e in staff
        ],  # fmt: skip
        "5PERIO": [
            {
                "ID": 1,
                "GROUPID": 2,
                "START": date(YEAR, 1, 22),
                "END": date(YEAR, 1, 26),
                "COLOR": 0x80FFFF,
                "DESCRIPT": "Umbau Station A",
            },
        ],  # fmt: skip
        "5HOBAN": [
            {
                "ID": 1,
                "GROUPID": 1,
                "START": date(YEAR, 12, 16),
                "END": date(YEAR, 12, 31),
                "RESTRICT": 1,
                "DESCRIPT": "Jahresabschluss",
            },
        ],  # fmt: skip
        "5RESTR": [
            {"ID": 1, "EMPLOYEEID": 108, "WEEKDAY": 5, "SHIFTID": 3, "RESTRICT": 1},
            {"ID": 2, "EMPLOYEEID": 108, "WEEKDAY": 6, "SHIFTID": 3, "RESTRICT": 1},
        ],
        "5SHDEM": [
            {
                "ID": n + 1,
                "GROUPID": 2,
                "WEEKDAY": day,
                "SHIFTID": 1,
                "WORKPLACID": 0,
                "MIN": 2,
                "MAX": 3,
            }
            for n, day in enumerate(range(7))
        ],  # fmt: skip
        "5SPDEM": [
            {"ID": 1, "GROUPID": 2, "DATE": date(YEAR, 1, 20), "SHIFTID": 1, "MIN": 4, "MAX": 5},
        ],
        "5DADEM": [
            {
                "ID": 1,
                "GROUPID": 3,
                "START": date(YEAR, 1, 1),
                "START2": date(YEAR, 1, 7),
                "DAILYDEM": _slots(3, 3, 3, 3, 3, 2, 2, 2),
                "DESCRIPT": "Inventurwoche",
            },
        ],  # fmt: skip
        "5XCHAR": [
            {
                "ID": 1,
                "NAME": "Nachtzuschlag",
                "POSITION": 1,
                "START": 1320,
                "END": 360,
                "VALIDDAYS": _slots(1, 1, 1, 1, 1, 1, 1),
                "DATE": "invalid",
            },
            {
                "ID": 2,
                "NAME": "Sonntagszuschlag",
                "POSITION": 2,
                "START": 0,
                "END": 0,
                "VALIDDAYS": _slots(0, 0, 0, 0, 0, 0, 1),
                "HOLRULE": 1,
                "DATE": "invalid",
            },
        ],  # fmt: skip
        "5USER": user_rows,
        "5GRACC": group_access,
        "5EMACC": employee_access,
        "5USETT": [
            {
                "ID": 0,
                "ANOANAME": "Abwesend",
                "ANOASHORT": "X",
                "ANOACRBAR": 0xFF0000,
                "ANOACRBK": WHITE,
            },
        ],  # fmt: skip
        "5BUILD": [
            {"ID": 1, "BUILD": 1, "CHANGE": 1, "CREATIME": bytes(8), "UUID": bytes(range(16))},
        ],
    }


def generate(directory: str) -> dict[str, Rows]:
    """Write the synthetic database into *directory* and return its rows by
    table name (as passed to the writer, before defaults are filled in)."""
    create_database(directory)
    content = tables()
    assert set(content) == set(TABLES)
    for name, rows in content.items():
        create_table(directory, name, rows)
    return content
