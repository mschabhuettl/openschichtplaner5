"""Tests for the central calculation layer.

All fixtures are synthetic. The anchor is the worked example from the
Schichtplaner 5 manual: December 2014 = 157.85 nominal hours.
"""

from datetime import date

import pytest

import sp5lib.calculations as calc

# --- fixtures ---

MO_FR = (True, True, True, True, True, False, False, False)  # Mon-Fri, Ft free

HOLIDAYS_DEC_2014 = calc.holiday_calendar(
    [
        {"DATE": "2014-12-25", "INTERVAL": 0},  # full
        {"DATE": "2014-12-26", "INTERVAL": 0},  # full
        {"DATE": "2014-12-31", "INTERVAL": 1},  # half
    ]
)

EMP_WEEK = calc.EmployeeContext(
    workdays=MO_FR, calcbase=1, hrs_day=7.7, hrs_week=38.5, deduct_hol=True
)
EMP_DAY = calc.EmployeeContext(workdays=MO_FR, calcbase=0, hrs_day=8.0)

# Shift catalog: early shift Mon-Fri 06:00-14:00 8h; night shift Mon-Fri
# 22:00-06:00 8h (crosses midnight); Saturday-only shift; holiday-capable shift.
EARLY = {"ID": 1, "STARTEND0": "06:00-14:00", "DURATION0": 8.0}
for _i in range(1, 5):
    EARLY[f"STARTEND{_i}"] = "06:00-14:00"
    EARLY[f"DURATION{_i}"] = 8.0
NIGHT = {"ID": 3}
for _i in range(5):
    NIGHT[f"STARTEND{_i}"] = "22:00-06:00"
    NIGHT[f"DURATION{_i}"] = 8.0
SAT_ONLY = {"ID": 4, "STARTEND5": "06:00-12:00", "DURATION5": 6.0}
FT_SHIFT = {"ID": 5, "STARTEND7": "08:00-12:00", "DURATION7": 4.0}
SHIFTS = {1: EARLY, 3: NIGHT, 4: SAT_ONLY, 5: FT_SHIFT}

UR = {"ID": 1, "CHARGETYP": 1, "ENTITLED": 1, "STDENTIT": 30.0, "CARRYFWD": 1}
FB = {"ID": 15, "CHARGETYP": 2, "CHARGEHRS": 8.25}
UU = {"ID": 13, "CHARGETYP": 0}  # unpaid: no charging
KR_DEDUCT = {"ID": 3, "CHARGETYP": 1, "DEDUCTACT": 1}
OVT_ABS = {"ID": 7, "CHARGETYP": 1, "DEDUCTOVT": 1}
LEAVE_TYPES = {1: UR, 15: FB, 13: UU, 3: KR_DEDUCT, 7: OVT_ABS}

NO_HOLIDAYS: dict = {}


def mashi(day: str, shift_id: int = 1) -> dict:
    return {"DATE": day, "SHIFTID": shift_id}


# --- working days ---


def test_count_working_days_plain_weeks():
    # March 2024: 31 days, Mon-Fri = 21 working days, no holidays
    assert calc.count_working_days(EMP_DAY, date(2024, 3, 1), date(2024, 3, 31), NO_HOLIDAYS) == 21


def test_count_working_days_holiday_deduction():
    hol = calc.holiday_calendar([{"DATE": "2024-01-01", "INTERVAL": 0}])  # Monday
    assert calc.count_working_days(EMP_DAY, date(2024, 1, 1), date(2024, 1, 7), hol) == 4.0


def test_count_working_days_half_holiday():
    hol = calc.holiday_calendar([{"DATE": "2024-01-02", "INTERVAL": 1}])  # Tuesday, half
    assert calc.count_working_days(EMP_DAY, date(2024, 1, 1), date(2024, 1, 7), hol) == 4.5


def test_count_working_days_holiday_on_free_day_no_deduction():
    hol = calc.holiday_calendar([{"DATE": "2024-01-06", "INTERVAL": 0}])  # Saturday
    assert calc.count_working_days(EMP_DAY, date(2024, 1, 1), date(2024, 1, 7), hol) == 5.0


def test_count_working_days_ft_marked_as_workday():
    emp = calc.EmployeeContext(workdays=(True,) * 8, calcbase=0, hrs_day=8.0)
    hol = calc.holiday_calendar([{"DATE": "2024-01-01", "INTERVAL": 0}])
    # WORKDAYS[7]=1: holidays ARE working days -> 7 days counted
    assert calc.count_working_days(emp, date(2024, 1, 1), date(2024, 1, 7), hol) == 7.0


def test_is_working_day_half_holiday_not_free():
    hol = calc.holiday_calendar(
        [{"DATE": "2024-01-01", "INTERVAL": 0}, {"DATE": "2024-01-02", "INTERVAL": 2}]
    )
    assert calc.is_working_day(EMP_DAY, date(2024, 1, 1), hol) is False  # full holiday
    assert calc.is_working_day(EMP_DAY, date(2024, 1, 2), hol) is True  # half holiday
    assert calc.is_working_day(EMP_DAY, date(2024, 1, 6), hol) is False  # Saturday


def test_employment_clamping():
    emp = calc.EmployeeContext(
        workdays=MO_FR,
        calcbase=0,
        hrs_day=8.0,
        emp_start=date(2024, 3, 11),
        emp_end=date(2024, 3, 15),
    )
    # evaluation over the whole month clamps to one work week
    assert calc.count_working_days(emp, date(2024, 3, 1), date(2024, 3, 31), NO_HOLIDAYS) == 5


# --- nominal hours ---


def test_normative_december_2014():
    """The manual's verified reference case."""
    nominal = calc.get_nominal_hours(
        EMP_WEEK, date(2014, 12, 1), date(2014, 12, 31), holidays=HOLIDAYS_DEC_2014
    )
    assert nominal == pytest.approx(157.85)


def test_nominal_day_base():
    nominal = calc.get_nominal_hours(
        EMP_DAY, date(2024, 3, 1), date(2024, 3, 31), holidays=NO_HOLIDAYS
    )
    assert nominal == pytest.approx(21 * 8.0)


def test_nominal_bookings_count_before_clamping():
    """TYPE-1 bookings act solely via DATE."""
    emp = calc.EmployeeContext(workdays=MO_FR, calcbase=0, hrs_day=8.0, emp_end=date(2024, 6, 30))
    bookings = [{"DATE": "2024-12-01", "TYPE": 1, "VALUE": 10.0}]
    nominal = calc.get_nominal_hours(
        emp, date(2024, 12, 1), date(2024, 12, 31), holidays=NO_HOLIDAYS, bookings=bookings
    )
    assert nominal == pytest.approx(10.0)  # period outside employment: bookings only


def test_nominal_total_base():
    emp = calc.EmployeeContext(
        workdays=MO_FR,
        calcbase=3,
        hrs_total=1000.0,
        emp_start=date(2024, 1, 1),
        emp_end=date(2024, 12, 31),
    )
    full = calc.get_nominal_hours(emp, date(2024, 1, 1), date(2024, 12, 31), holidays=NO_HOLIDAYS)
    assert full == pytest.approx(1000.0)
    part = calc.get_nominal_hours(emp, date(2024, 1, 1), date(2024, 6, 30), holidays=NO_HOLIDAYS)
    assert 0 < part < 1000.0


def test_nominal_month_base_full_months():
    emp = calc.EmployeeContext(
        workdays=MO_FR, calcbase=2, hrs_day=8.0, hrs_month=160.0, deduct_hol=False
    )
    nominal = calc.get_nominal_hours(emp, date(2024, 1, 1), date(2024, 2, 29), holidays=NO_HOLIDAYS)
    assert nominal == pytest.approx(2 * 160.0)


# --- actual hours / work hours ---


def test_work_hours_use_day_index():
    """DURATION is taken from the day index of the duty's date."""
    # Saturday-only shift: counts on Sat (idx 5), zero on Monday (idx 0 undefined)
    sat = calc.get_work_hours(
        EMP_DAY,
        date(2024, 3, 2),
        date(2024, 3, 2),
        holidays=NO_HOLIDAYS,
        shifts_by_id=SHIFTS,
        manual_shifts=[mashi("2024-03-02", 4)],
    )
    assert sat == pytest.approx(6.0)
    mon = calc.get_work_hours(
        EMP_DAY,
        date(2024, 3, 4),
        date(2024, 3, 4),
        holidays=NO_HOLIDAYS,
        shifts_by_id=SHIFTS,
        manual_shifts=[mashi("2024-03-04", 4)],
    )
    assert mon == 0.0


def test_work_hours_holiday_slot():
    """A duty on a holiday uses STARTEND7/DURATION7 (Ft slot)."""
    hol = calc.holiday_calendar([{"DATE": "2024-03-04", "INTERVAL": 0}])  # Monday
    hours = calc.get_work_hours(
        EMP_DAY,
        date(2024, 3, 4),
        date(2024, 3, 4),
        holidays=hol,
        shifts_by_id=SHIFTS,
        manual_shifts=[mashi("2024-03-04", 5)],
    )
    assert hours == pytest.approx(4.0)  # DURATION7
    # the EARLY shift has no Ft slot -> 0 on a holiday
    none = calc.get_work_hours(
        EMP_DAY,
        date(2024, 3, 4),
        date(2024, 3, 4),
        holidays=hol,
        shifts_by_id=SHIFTS,
        manual_shifts=[mashi("2024-03-04", 1)],
    )
    assert none == 0.0


def test_special_shift_replaces_duty():
    """Deviation (5SPSHI with SHIFTID) replaces the duty."""
    hours = calc.get_work_hours(
        EMP_DAY,
        date(2024, 3, 4),
        date(2024, 3, 4),
        holidays=NO_HOLIDAYS,
        shifts_by_id=SHIFTS,
        manual_shifts=[mashi("2024-03-04", 1)],
        special_shifts=[{"DATE": "2024-03-04", "SHIFTID": 1, "DURATION": 5.0}],
    )
    assert hours == pytest.approx(5.0)  # not 8 + 5


def test_pure_special_shift_adds():
    """A 5SPSHI without SHIFTID is an extra duty with its own hours."""
    hours = calc.get_work_hours(
        EMP_DAY,
        date(2024, 3, 4),
        date(2024, 3, 4),
        holidays=NO_HOLIDAYS,
        shifts_by_id=SHIFTS,
        manual_shifts=[mashi("2024-03-04", 1)],
        special_shifts=[{"DATE": "2024-03-04", "SHIFTID": 0, "DURATION": 3.0}],
    )
    assert hours == pytest.approx(8.0 + 3.0)


def test_actual_hours_absence_charging():
    """CHARGETYP 1 = day hours, 2 = fixed hours, 0 = nothing."""
    base = dict(holidays=NO_HOLIDAYS, shifts_by_id=SHIFTS, leave_types_by_id=LEAVE_TYPES)
    von = bis = date(2024, 3, 4)  # Monday
    full = calc.get_actual_hours(
        EMP_DAY, von, bis, absences=[{"DATE": "2024-03-04", "LEAVETYPID": 1, "INTERVAL": 0}], **base
    )
    assert full == pytest.approx(8.0)  # CHARGETYP 1 -> HRSDAY
    fixed = calc.get_actual_hours(
        EMP_DAY,
        von,
        bis,
        absences=[{"DATE": "2024-03-04", "LEAVETYPID": 15, "INTERVAL": 0}],
        **base,
    )
    assert fixed == pytest.approx(8.25)  # CHARGETYP 2 -> CHARGEHRS
    unpaid = calc.get_actual_hours(
        EMP_DAY,
        von,
        bis,
        absences=[{"DATE": "2024-03-04", "LEAVETYPID": 13, "INTERVAL": 0}],
        **base,
    )
    assert unpaid == 0.0
    half = calc.get_actual_hours(
        EMP_DAY, von, bis, absences=[{"DATE": "2024-03-04", "LEAVETYPID": 1, "INTERVAL": 1}], **base
    )
    assert half == pytest.approx(4.0)


def test_absence_on_free_day_not_charged():
    """Without COUNTALL an absence on a non-workday yields 0."""
    sat = calc.get_actual_hours(
        EMP_DAY,
        date(2024, 3, 2),
        date(2024, 3, 2),
        holidays=NO_HOLIDAYS,
        shifts_by_id=SHIFTS,
        leave_types_by_id=LEAVE_TYPES,
        absences=[{"DATE": "2024-03-02", "LEAVETYPID": 1, "INTERVAL": 0}],
    )
    assert sat == 0.0


def test_deductact_subtracts():
    """DEDUCTACT types reduce the actual hours."""
    actual = calc.get_actual_hours(
        EMP_DAY,
        date(2024, 3, 4),
        date(2024, 3, 5),
        holidays=NO_HOLIDAYS,
        shifts_by_id=SHIFTS,
        leave_types_by_id=LEAVE_TYPES,
        manual_shifts=[mashi("2024-03-04", 1)],
        absences=[{"DATE": "2024-03-05", "LEAVETYPID": 3, "INTERVAL": 0}],
    )
    assert actual == pytest.approx(8.0 - 8.0)


# --- balance / overtime ---


def test_saldo_booking_types_separated():
    """Regression: +10 actual booking and +10 nominal booking => balance 0."""
    bookings = [
        {"DATE": "2024-03-04", "TYPE": 0, "VALUE": 10.0},
        {"DATE": "2024-03-04", "TYPE": 1, "VALUE": 10.0},
    ]
    saldo = calc.get_saldo(
        EMP_DAY,
        date(2024, 3, 4),
        date(2024, 3, 4),
        holidays=NO_HOLIDAYS,
        shifts_by_id=SHIFTS,
        leave_types_by_id=LEAVE_TYPES,
        bookings=bookings,
    )
    assert saldo == pytest.approx(10.0 - (8.0 + 10.0))  # actual=10, nominal=8+10


def test_overtime_account():
    """TYPE-2 bookings + 5OVER - DEDUCTOVT raw hours."""
    total = calc.get_overtime_hours(
        EMP_DAY,
        date(2024, 3, 4),
        date(2024, 3, 8),
        holidays=NO_HOLIDAYS,
        bookings=[{"DATE": "2024-03-04", "TYPE": 2, "VALUE": 2.0}],
        overtimes=[{"DATE": "2024-03-05", "HOURS": 3.0}],
        absences=[{"DATE": "2024-03-06", "LEAVETYPID": 7, "INTERVAL": 0}],
        leave_types_by_id=LEAVE_TYPES,
    )
    assert total == pytest.approx(2.0 + 3.0 - 8.0)


# --- leave entitlements ---

UR_ABSENCES = [
    {"DATE": f"2024-03-{d:02d}", "LEAVETYPID": 1, "INTERVAL": 0} for d in (4, 5, 6, 7, 8)
]


def test_leave_account():
    acct = calc.leave_account(
        EMP_DAY,
        2024,
        UR,
        holidays=NO_HOLIDAYS,
        entitlements=[
            {"YEAR": 2024, "LEAVETYPID": 1, "ENTITLEMNT": 30.0, "REST": 2.0, "INDAYS": 1}
        ],
        absences=UR_ABSENCES,
    )
    assert acct.total == pytest.approx(32.0)
    assert acct.taken == pytest.approx(5.0)
    assert acct.remaining == pytest.approx(27.0)


def test_leave_account_half_days_not_truncated():
    """Regression: 12.5 taken days must not be truncated to 12."""
    absences = UR_ABSENCES + [{"DATE": "2024-03-11", "LEAVETYPID": 1, "INTERVAL": 1}]
    acct = calc.leave_account(
        EMP_DAY,
        2024,
        UR,
        holidays=NO_HOLIDAYS,
        entitlements=[
            {"YEAR": 2024, "LEAVETYPID": 1, "ENTITLEMNT": 30.0, "REST": 0.0, "INDAYS": 1}
        ],
        absences=absences,
    )
    assert acct.taken == pytest.approx(5.5)


def test_annual_close_carry_forward():
    rows = calc.annual_close(
        EMP_DAY,
        2024,
        holidays=NO_HOLIDAYS,
        leave_types=[UR, UU],  # UU not ENTITLED -> skipped
        entitlements=[
            {"YEAR": 2024, "LEAVETYPID": 1, "ENTITLEMNT": 30.0, "REST": 2.0, "INDAYS": 1}
        ],
        absences=UR_ABSENCES,
    )
    assert rows == [{"YEAR": 2025, "LEAVETYPID": 1, "ENTITLEMNT": 30.0, "REST": 27.0, "INDAYS": 1}]


def test_forfeit_rest_cuts_to_taken():
    rows = calc.forfeit_rest(
        EMP_DAY,
        date(2024, 3, 31),
        holidays=NO_HOLIDAYS,
        leave_types=[UR],
        entitlements=[
            {"YEAR": 2024, "LEAVETYPID": 1, "ENTITLEMNT": 30.0, "REST": 8.0, "INDAYS": 1}
        ],
        absences=UR_ABSENCES[:2],  # 2 days taken before cutoff
    )
    assert rows == [{"YEAR": 2024, "LEAVETYPID": 1, "REST": 2.0}]
    # rest already covered by consumption: no update row
    none = calc.forfeit_rest(
        EMP_DAY,
        date(2024, 3, 31),
        holidays=NO_HOLIDAYS,
        leave_types=[UR],
        entitlements=[
            {"YEAR": 2024, "LEAVETYPID": 1, "ENTITLEMNT": 30.0, "REST": 1.0, "INDAYS": 1}
        ],
        absences=UR_ABSENCES,
    )
    assert none == []


# --- extra charges (5XCHAR fixtures) ---

NIGHT_CHARGE = {
    "ID": 3,
    "START": 1200,
    "END": 360,
    "VALIDITY": 0,
    "VALIDDAYS": "1 1 1 1 1 1 1",
    "HOLRULE": 0,
}
SAT_CHARGE = {
    "ID": 2,
    "START": 780,
    "END": 1200,
    "VALIDITY": 0,
    "VALIDDAYS": "0 0 0 0 0 1 0",
    "HOLRULE": 0,
}
SUN_CHARGE = {
    "ID": 1,
    "START": 0,
    "END": 0,
    "VALIDITY": 0,
    "VALIDDAYS": "0 0 0 0 0 0 1",
    "HOLRULE": 2,
}
FT_CHARGE = {
    "ID": 4,
    "START": 0,
    "END": 0,
    "VALIDITY": 0,
    "VALIDDAYS": "1 1 1 1 1 1 1",
    "HOLRULE": 1,
}


def test_night_charge_across_midnight():
    """Night shift 22:00-06:00 vs charge window 20:00-06:00 -> 8h over 2 days."""
    hours = calc.get_extracharge_hours(
        EMP_DAY,
        NIGHT_CHARGE,
        date(2024, 3, 4),
        date(2024, 3, 6),
        holidays=NO_HOLIDAYS,
        shifts_by_id=SHIFTS,
        manual_shifts=[mashi("2024-03-04", 3)],
    )
    assert hours == pytest.approx(8.0)  # 2h on Mon (22-24) + 6h on Tue (0-6)


def test_saturday_charge_only_on_saturday():
    # Saturday duty 06:00-12:00 vs window 13:00-20:00 -> no overlap
    none = calc.get_extracharge_hours(
        EMP_DAY,
        SAT_CHARGE,
        date(2024, 3, 2),
        date(2024, 3, 2),
        holidays=NO_HOLIDAYS,
        shifts_by_id=SHIFTS,
        manual_shifts=[mashi("2024-03-02", 4)],
    )
    assert none == 0.0
    # early shift on Saturday 06:00-14:00 -> 1h overlap (13:00-14:00)
    one = calc.get_extracharge_hours(
        EMP_DAY,
        SAT_CHARGE,
        date(2024, 3, 2),
        date(2024, 3, 2),
        holidays=NO_HOLIDAYS,
        shifts_by_id={1: dict(EARLY, STARTEND5="06:00-14:00", DURATION5=8.0)},
        manual_shifts=[mashi("2024-03-02", 1)],
    )
    assert one == pytest.approx(1.0)
    # the same duty on a Monday matches no Saturday window
    mon = calc.get_extracharge_hours(
        EMP_DAY,
        SAT_CHARGE,
        date(2024, 3, 4),
        date(2024, 3, 4),
        holidays=NO_HOLIDAYS,
        shifts_by_id=SHIFTS,
        manual_shifts=[mashi("2024-03-04", 1)],
    )
    assert mon == 0.0


def test_sunday_charge_full_day_window():
    """START=END=0 means the whole day (end 0 -> 1440)."""
    shifts = {1: dict(EARLY, STARTEND6="06:00-14:00", DURATION6=8.0)}
    sun = calc.get_extracharge_hours(
        EMP_DAY,
        SUN_CHARGE,
        date(2024, 3, 3),
        date(2024, 3, 3),
        holidays=NO_HOLIDAYS,
        shifts_by_id=shifts,
        manual_shifts=[mashi("2024-03-03", 1)],
    )
    assert sun == pytest.approx(8.0)


def test_holiday_charge_rules():
    hol = calc.holiday_calendar([{"DATE": "2024-03-04", "INTERVAL": 0}])
    shifts = {5: dict(FT_SHIFT)}
    duty = [mashi("2024-03-04", 5)]
    # HOLRULE=1: only on holidays
    on_hol = calc.get_extracharge_hours(
        EMP_DAY,
        FT_CHARGE,
        date(2024, 3, 4),
        date(2024, 3, 4),
        holidays=hol,
        shifts_by_id=shifts,
        manual_shifts=duty,
    )
    assert on_hol == pytest.approx(4.0)
    no_hol = calc.get_extracharge_hours(
        EMP_DAY,
        FT_CHARGE,
        date(2024, 3, 5),
        date(2024, 3, 5),
        holidays=hol,
        shifts_by_id=SHIFTS,
        manual_shifts=[mashi("2024-03-05", 1)],
    )
    assert no_hol == 0.0
    # HOLRULE=2: suppressed on full holidays (Sunday charge on a holiday Sunday)
    hol_sun = calc.holiday_calendar([{"DATE": "2024-03-03", "INTERVAL": 0}])
    shifts_sun = {
        1: dict(
            EARLY, STARTEND6="06:00-14:00", DURATION6=8.0, STARTEND7="06:00-14:00", DURATION7=8.0
        )
    }
    suppressed = calc.get_extracharge_hours(
        EMP_DAY,
        SUN_CHARGE,
        date(2024, 3, 3),
        date(2024, 3, 3),
        holidays=hol_sun,
        shifts_by_id=shifts_sun,
        manual_shifts=[mashi("2024-03-03", 1)],
    )
    assert suppressed == 0.0


def test_noextra_shift_yields_no_charge():
    shifts = {9: dict(NIGHT, ID=9, NOEXTRA=1)}
    hours = calc.get_extracharge_hours(
        EMP_DAY,
        NIGHT_CHARGE,
        date(2024, 3, 4),
        date(2024, 3, 6),
        holidays=NO_HOLIDAYS,
        shifts_by_id=shifts,
        manual_shifts=[mashi("2024-03-04", 9)],
    )
    assert hours == 0.0


# --- 5CYASS cycle expansion ---

CYCLE = {"ID": 8, "SIZE": 3, "UNIT": 1}  # 3-week model
CYCLE_ENTRIES = (
    [{"CYCLEEID": 8, "INDEX": i, "SHIFTID": 1, "WORKPLACID": 0} for i in range(0, 5)]
    + [{"CYCLEEID": 8, "INDEX": i, "SHIFTID": 2, "WORKPLACID": 0} for i in range(7, 12)]
    + [{"CYCLEEID": 8, "INDEX": i, "SHIFTID": 3, "WORKPLACID": 0} for i in range(14, 19)]
)


def test_cycle_expansion_three_week_pattern():
    days = calc.expand_cycle_assignments(
        [{"ID": 1, "EMPLOYEEID": 40, "CYCLEID": 8, "START": "2024-01-01", "ENTRANCE": 0}],
        cycles=[CYCLE],
        cycle_entries=CYCLE_ENTRIES,
        von=date(2024, 1, 1),
        bis=date(2024, 1, 21),
    )
    by_date = {r["DATE"]: r["SHIFTID"] for r in days}
    assert by_date["2024-01-01"] == 1  # week 1: early
    assert by_date["2024-01-05"] == 1
    assert "2024-01-06" not in by_date  # free weekend
    assert by_date["2024-01-08"] == 2  # week 2: late
    assert by_date["2024-01-15"] == 3  # week 3: night
    assert len(days) == 15


DAY_CYCLE = {"ID": 9, "SIZE": 10, "UNIT": 0}  # 10-day model (unit: days)
DAY_CYCLE_ENTRIES = [{"CYCLEEID": 9, "INDEX": 2, "SHIFTID": 1, "WORKPLACID": 0}]


def test_cycle_expansion_tages_modell():
    """UNIT=0: length = SIZE days (not SIZE*7), independent of the weekday."""
    days = calc.expand_cycle_assignments(
        [{"ID": 1, "EMPLOYEEID": 40, "CYCLEID": 9, "START": "2024-01-01", "ENTRANCE": 0}],
        cycles=[DAY_CYCLE],
        cycle_entries=DAY_CYCLE_ENTRIES,
        von=date(2024, 1, 1),
        bis=date(2024, 1, 31),
    )
    assert [r["DATE"] for r in days] == ["2024-01-03", "2024-01-13", "2024-01-23"]


def test_cycle_expansion_tages_modell_entrance():
    """UNIT=0: ENTRANCE is the direct day offset (no week factor)."""
    days = calc.expand_cycle_assignments(
        [{"ID": 1, "EMPLOYEEID": 40, "CYCLEID": 9, "START": "2024-01-01", "ENTRANCE": 2}],
        cycles=[DAY_CYCLE],
        cycle_entries=DAY_CYCLE_ENTRIES,
        von=date(2024, 1, 1),
        bis=date(2024, 1, 12),
    )
    assert [r["DATE"] for r in days] == ["2024-01-01", "2024-01-11"]


def test_cycle_expansion_entrance_offset():
    days = calc.expand_cycle_assignments(
        [{"ID": 1, "EMPLOYEEID": 40, "CYCLEID": 8, "START": "2024-01-01", "ENTRANCE": 1}],
        cycles=[CYCLE],
        cycle_entries=CYCLE_ENTRIES,
        von=date(2024, 1, 1),
        bis=date(2024, 1, 7),
    )
    assert {r["SHIFTID"] for r in days} == {2}  # entered at week 2 (late)


def test_cycle_expansion_midweek_start_aligns_weekday():
    """Within the model row the weekday of the date aligns."""
    days = calc.expand_cycle_assignments(
        [{"ID": 1, "EMPLOYEEID": 40, "CYCLEID": 8, "START": "2024-01-03", "ENTRANCE": 0}],
        cycles=[CYCLE],
        cycle_entries=CYCLE_ENTRIES,
        von=date(2024, 1, 3),
        bis=date(2024, 1, 5),
    )
    # Wed 3.1. is index 2 of week 1 -> early shift Wed-Fri
    assert [r["SHIFTID"] for r in days] == [1, 1, 1]


def test_cycle_expansion_exception_suppresses():
    days = calc.expand_cycle_assignments(
        [{"ID": 1, "EMPLOYEEID": 40, "CYCLEID": 8, "START": "2024-01-01", "ENTRANCE": 0}],
        cycles=[CYCLE],
        cycle_entries=CYCLE_ENTRIES,
        cycle_exceptions=[{"EMPLOYEEID": 40, "CYCLEASSID": 1, "DATE": "2024-01-02"}],
        von=date(2024, 1, 1),
        bis=date(2024, 1, 5),
    )
    assert "2024-01-02" not in {r["DATE"] for r in days}
    assert len(days) == 4


def test_cycle_expansion_rolls_over():
    """The model repeats modulo its length."""
    days = calc.expand_cycle_assignments(
        [{"ID": 1, "EMPLOYEEID": 40, "CYCLEID": 8, "START": "2024-01-01", "ENTRANCE": 0}],
        cycles=[CYCLE],
        cycle_entries=CYCLE_ENTRIES,
        von=date(2024, 1, 22),
        bis=date(2024, 1, 26),
    )
    assert {r["SHIFTID"] for r in days} == {1}  # week 4 = week 1 again


# --- personnel table / utilization ---


def test_personnel_table_row():
    row = calc.personnel_table_row(
        EMP_DAY,
        date(2024, 3, 4),
        date(2024, 3, 8),
        holidays=NO_HOLIDAYS,
        shifts_by_id=SHIFTS,
        manual_shifts=[mashi(f"2024-03-{d:02d}", 1) for d in (4, 5, 6, 7)],
        absences=[{"DATE": "2024-03-08", "LEAVETYPID": 1, "INTERVAL": 0}],
        leave_types_by_id=LEAVE_TYPES,
    )
    assert row["arbeitszeit"] == pytest.approx(32.0)
    assert row["abwesenheit_bezahlt"] == pytest.approx(8.0)
    assert row["iststunden"] == pytest.approx(40.0)
    assert row["sollstunden"] == pytest.approx(40.0)
    assert row["saldo"] == pytest.approx(0.0)


def test_utilization_status():
    assert calc.utilization_status(1, 2, 4) == -1
    assert calc.utilization_status(3, 2, 4) == 0
    assert calc.utilization_status(5, 2, 4) == 1


# --- edge cases ---


def test_leap_year_february():
    # February 2024 (leap year): 29 days, Mon-Fri = 21 working days
    assert calc.count_working_days(EMP_DAY, date(2024, 2, 1), date(2024, 2, 29), NO_HOLIDAYS) == 21
    # Month base: the leap month counts as exactly one full month
    emp = calc.EmployeeContext(workdays=MO_FR, calcbase=2, hrs_day=8.0, hrs_month=160.0)
    assert calc.get_nominal_hours(
        emp, date(2024, 2, 1), date(2024, 2, 29), holidays=NO_HOLIDAYS
    ) == pytest.approx(160.0)
    # 29 Feb as a holiday (Thursday) is deducted
    hol = calc.holiday_calendar([{"DATE": "2024-02-29", "INTERVAL": 0}])
    assert calc.count_working_days(EMP_DAY, date(2024, 2, 1), date(2024, 2, 29), hol) == 20


def test_empstart_after_empend_yields_zero():
    """An inverted employment period (EMPSTART > EMPEND) clamps everything to 0."""
    emp = calc.EmployeeContext(
        workdays=MO_FR,
        calcbase=0,
        hrs_day=8.0,
        emp_start=date(2024, 6, 1),
        emp_end=date(2024, 1, 1),
    )
    von, bis = date(2024, 1, 1), date(2024, 12, 31)
    assert calc.count_working_days(emp, von, bis, NO_HOLIDAYS) == 0.0
    assert calc.get_nominal_hours(emp, von, bis, holidays=NO_HOLIDAYS) == 0.0
    assert (
        calc.get_work_hours(
            emp,
            von,
            bis,
            holidays=NO_HOLIDAYS,
            shifts_by_id=SHIFTS,
            manual_shifts=[mashi("2024-03-04", 1)],
        )
        == 0.0
    )


def test_empty_workdays_mask():
    """Empty WORKDAYS mask: all slots False, no working days, no crediting."""
    emp = calc.EmployeeContext(workdays=calc.parse_day_mask("", 8), calcbase=0, hrs_day=8.0)
    assert calc.count_working_days(emp, date(2024, 3, 1), date(2024, 3, 31), NO_HOLIDAYS) == 0.0
    assert calc.absence_hours(emp, {"DATE": "2024-03-04", "INTERVAL": 0}, UR, NO_HOLIDAYS) == 0.0


def test_parse_day_mask_compact_and_spaced_equivalent():
    """A compact mask (``"1111111"``) must yield the same weekdays as the
    space-separated form (``"1 1 1 1 1 1 1"``).

    Previously ``split()`` saw only one token, so only Monday was active.
    """
    assert calc.parse_day_mask("1111111", 7) == (True,) * 7
    assert calc.parse_day_mask("1 1 1 1 1 1 1", 7) == (True,) * 7
    # mixed examples stay equivalent
    assert calc.parse_day_mask("0000010", 7) == calc.parse_day_mask("0 0 0 0 0 1 0", 7)
    assert calc.parse_day_mask("1100000", 7) == (True, True, False, False, False, False, False)
    # the 8-slot case (WORKDAYS/LEAVT) as well
    assert calc.parse_day_mask("11111000", 8) == (True, True, True, True, True, False, False, False)


def test_normalize_day_mask_canonical_spaced():
    """normalize_day_mask always renders the canonical space-separated form."""
    assert calc.normalize_day_mask("1111111", 7) == "1 1 1 1 1 1 1"
    assert calc.normalize_day_mask("1 1 1 1 1 1 1", 7) == "1 1 1 1 1 1 1"  # idempotent
    assert calc.normalize_day_mask("0000010", 7) == "0 0 0 0 0 1 0"
    assert calc.normalize_day_mask("", 7) == "0 0 0 0 0 0 0"


def test_absence_interval3_across_midnight():
    # 22:00-06:00 across midnight (END <= START means the day changes) -> 8 h
    rec = {"DATE": "2024-03-04", "LEAVETYPID": 1, "INTERVAL": 3, "START": 1320, "END": 360}
    assert calc.absence_hours(EMP_DAY, rec, UR, NO_HOLIDAYS) == pytest.approx(8.0)
    # degenerate START == END == 0 -> counts as a whole 24 h day
    rec0 = {"DATE": "2024-03-04", "LEAVETYPID": 1, "INTERVAL": 3, "START": 0, "END": 0}
    assert calc.absence_hours(EMP_DAY, rec0, UR, NO_HOLIDAYS) == pytest.approx(24.0)


def test_absence_interval3_half_holiday_clip():
    """Half holiday (INTERVAL=1 = morning is a holiday) with a free holiday slot:
    a partial-day absence counts only in the non-holiday afternoon window
    720-1440."""
    hol = calc.holiday_calendar([{"DATE": "2024-03-04", "INTERVAL": 1}])
    rec = {"DATE": "2024-03-04", "LEAVETYPID": 1, "INTERVAL": 3, "START": 600, "END": 840}
    # 10:00-14:00 intersected with 12:00-24:00 = 2 h
    assert calc.absence_hours(EMP_DAY, rec, UR, hol) == pytest.approx(2.0)
