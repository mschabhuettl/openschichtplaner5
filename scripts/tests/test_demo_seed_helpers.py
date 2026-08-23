"""Unit-Tests für die puren Helfer der Demo-Seed-Skripte.

Ausführen (z. B. mit dem venv des API-Repos):

    pytest scripts/tests/
"""

import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import generate_demo_schedule as gds  # noqa: E402
import seed_demo_data as sdd  # noqa: E402


class TestBuildDemoNames:
    def test_prefix_is_base_pool(self):
        names = sdd.build_demo_names(len(sdd.DEMO_NAMES))
        assert names == sdd.DEMO_NAMES

    def test_scales_beyond_pool_with_suffixes(self):
        names = sdd.build_demo_names(40)
        assert len(names) == 40
        # Nach dem Basis-Pool folgen kombinierte Nachnamen („Mustermann-Nord")
        first, last, sex = names[len(sdd.DEMO_NAMES)]
        assert "-" in last and last.endswith("Nord")
        assert sex in (0, 1)

    def test_unique_full_names_far_beyond_suffix_pool(self):
        # 12 Zusätze × 30 Basisnamen = 390; darüber greift das Zählsuffix
        count = 500
        names = sdd.build_demo_names(count)
        assert len(names) == count
        assert len({(first, last) for first, last, _ in names}) == count

    def test_deterministic(self):
        assert sdd.build_demo_names(200) == sdd.build_demo_names(200)


class TestDemoHours:
    def test_fulltime_majority_and_parttime_present(self):
        profiles = [sdd.demo_hours(i) for i in range(20)]
        fulltime = [p for p in profiles if p["HRSWEEK"] == 38.5]
        parttime = [p for p in profiles if p["HRSWEEK"] < 38.5]
        assert len(fulltime) > len(parttime) > 0

    def test_consistent_fields(self):
        for i in range(10):
            p = sdd.demo_hours(i)
            assert set(p) == {"HRSWEEK", "HRSDAY", "HRSMONTH", "CALCBASE"}
            assert p["HRSMONTH"] == round(p["HRSWEEK"] * 4.0, 2)
            assert p["CALCBASE"] in (0, 1)

    def test_deterministic_rotation(self):
        assert sdd.demo_hours(3) == sdd.demo_hours(13)


class TestSpreadWindow:
    def test_single_month_starts_at_current_month(self):
        today = date(2026, 8, 23)
        start, end = sdd.spread_window(today, 1)
        assert start == date(2026, 8, 1)
        assert end == today + timedelta(days=28)

    def test_thirteen_months_reach_previous_year(self):
        start, end = sdd.spread_window(date(2026, 8, 23), 13)
        assert start == date(2025, 8, 1)
        assert end == date(2026, 9, 20)

    def test_year_rollover(self):
        start, _ = sdd.spread_window(date(2026, 1, 15), 2)
        assert start == date(2025, 12, 1)


class TestMonthList:
    def test_includes_current_and_back_months(self):
        months = gds.month_list(date(2026, 8, 23), 2)
        assert months == [(2026, 6), (2026, 7), (2026, 8)]

    def test_year_rollover(self):
        months = gds.month_list(date(2026, 2, 1), 3)
        assert months == [(2025, 11), (2025, 12), (2026, 1), (2026, 2)]

    def test_thirteen_back_yields_fourteen_months(self):
        months = gds.month_list(date(2026, 8, 23), 13)
        assert len(months) == 14
        assert months[0] == (2025, 7)
        assert months[-1] == (2026, 8)
