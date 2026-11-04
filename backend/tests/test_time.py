import datetime
from zoneinfo import ZoneInfo

from app.core.time import (
    get_day_boundaries,
    get_month_boundaries,
    get_user_timezone,
    get_week_boundaries,
)


def test_user_timezone_fallback() -> None:
    tz = get_user_timezone("Asia/Kolkata")
    assert tz.key == "Asia/Kolkata"

    tz_invalid = get_user_timezone("Invalid/NonExistentZone")
    assert tz_invalid.key == "Asia/Kolkata"

    tz_none = get_user_timezone(None)
    assert tz_none.key == "Asia/Kolkata"


def test_day_boundaries() -> None:
    tz = ZoneInfo("Asia/Kolkata")
    # 2026-11-02 14:30:00 IST is 09:00:00 UTC
    dt = datetime.datetime(2026, 11, 2, 14, 30, 0, tzinfo=tz)
    start_utc, end_utc = get_day_boundaries(dt, tz)

    # In IST, day starts at 00:00:00 IST = previous day 18:30:00 UTC
    assert start_utc == datetime.datetime(2026, 11, 1, 18, 30, 0, tzinfo=datetime.UTC)
    assert end_utc == datetime.datetime(2026, 11, 2, 18, 30, 0, tzinfo=datetime.UTC)
    assert (end_utc - start_utc) == datetime.timedelta(days=1)


def test_week_boundaries_monday_start() -> None:
    tz = ZoneInfo("Asia/Kolkata")
    # 2026-11-04 is Wednesday
    dt = datetime.datetime(2026, 11, 4, 12, 0, 0, tzinfo=tz)
    start_utc, end_utc = get_week_boundaries(dt, tz, week_start=1)

    # Monday was 2026-11-02 00:00:00 IST = 2026-11-01 18:30:00 UTC
    assert start_utc == datetime.datetime(2026, 11, 1, 18, 30, 0, tzinfo=datetime.UTC)
    assert end_utc == start_utc + datetime.timedelta(days=7)


def test_week_boundaries_sunday_start() -> None:
    tz = ZoneInfo("Asia/Kolkata")
    # 2026-11-04 is Wednesday
    dt = datetime.datetime(2026, 11, 4, 12, 0, 0, tzinfo=tz)
    start_utc, end_utc = get_week_boundaries(dt, tz, week_start=7)

    # Sunday was 2026-11-01 00:00:00 IST = 2026-10-31 18:30:00 UTC
    assert start_utc == datetime.datetime(2026, 10, 31, 18, 30, 0, tzinfo=datetime.UTC)
    assert end_utc == start_utc + datetime.timedelta(days=7)


def test_month_boundaries_standard_first_of_month() -> None:
    tz = ZoneInfo("Asia/Kolkata")
    dt = datetime.datetime(2026, 11, 15, 10, 0, 0, tzinfo=tz)
    start_utc, end_utc = get_month_boundaries(dt, tz, month_start_day=1)

    # Starts 2026-11-01 00:00 IST = 2026-10-31 18:30 UTC
    assert start_utc == datetime.datetime(2026, 10, 31, 18, 30, 0, tzinfo=datetime.UTC)
    # Ends 2026-12-01 00:00 IST = 2026-11-30 18:30 UTC
    assert end_utc == datetime.datetime(2026, 11, 30, 18, 30, 0, tzinfo=datetime.UTC)


def test_month_boundaries_custom_salary_cycle() -> None:
    tz = ZoneInfo("Asia/Kolkata")

    # Case A: Date is after salary day (e.g. Nov 26 with salary start day 25)
    dt_after = datetime.datetime(2026, 11, 26, 10, 0, 0, tzinfo=tz)
    start_utc, end_utc = get_month_boundaries(dt_after, tz, month_start_day=25)
    # Cycle started Nov 25 00:00 IST = Nov 24 18:30 UTC
    assert start_utc == datetime.datetime(2026, 11, 24, 18, 30, 0, tzinfo=datetime.UTC)
    # Cycle ends Dec 25 00:00 IST = Dec 24 18:30 UTC
    assert end_utc == datetime.datetime(2026, 12, 24, 18, 30, 0, tzinfo=datetime.UTC)

    # Case B: Date is before salary day (e.g. Nov 10 with salary start day 25)
    dt_before = datetime.datetime(2026, 11, 10, 10, 0, 0, tzinfo=tz)
    start_utc2, end_utc2 = get_month_boundaries(dt_before, tz, month_start_day=25)
    # Cycle started Oct 25 00:00 IST = Oct 24 18:30 UTC
    assert start_utc2 == datetime.datetime(2026, 10, 24, 18, 30, 0, tzinfo=datetime.UTC)
    # Cycle ends Nov 25 00:00 IST = Nov 24 18:30 UTC
    assert end_utc2 == datetime.datetime(2026, 11, 24, 18, 30, 0, tzinfo=datetime.UTC)
