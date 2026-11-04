import calendar
import datetime
from zoneinfo import ZoneInfo


def get_user_timezone(tz_name: str | None) -> ZoneInfo:
    """Returns ZoneInfo for user timezone, defaulting to Asia/Kolkata."""
    if not tz_name:
        return ZoneInfo("Asia/Kolkata")
    try:
        return ZoneInfo(tz_name)
    except Exception:
        return ZoneInfo("Asia/Kolkata")


def get_day_boundaries(
    dt: datetime.datetime | None = None,
    tz: ZoneInfo | None = None,
) -> tuple[datetime.datetime, datetime.datetime]:
    """Returns half-open interval [start_utc, end_utc) for the localized day."""
    tz = tz or ZoneInfo("Asia/Kolkata")
    now_tz = (dt or datetime.datetime.now(datetime.UTC)).astimezone(tz)

    start_local = now_tz.replace(hour=0, minute=0, second=0, microsecond=0)
    end_local = start_local + datetime.timedelta(days=1)

    return start_local.astimezone(datetime.UTC), end_local.astimezone(datetime.UTC)


def get_week_boundaries(
    dt: datetime.datetime | None = None,
    tz: ZoneInfo | None = None,
    week_start: int = 1,  # 1 = Monday, 7 = Sunday
) -> tuple[datetime.datetime, datetime.datetime]:
    """Returns half-open interval [start_utc, end_utc) for the localized week."""
    tz = tz or ZoneInfo("Asia/Kolkata")
    now_tz = (dt or datetime.datetime.now(datetime.UTC)).astimezone(tz)

    # Python weekday(): 0 = Mon, 6 = Sun
    # week_start param: 1 = Mon (0 in Python), 7 = Sun (6 in Python)
    target_start_weekday = (week_start - 1) % 7
    current_weekday = now_tz.weekday()

    days_since_start = (current_weekday - target_start_weekday) % 7
    start_local = (now_tz - datetime.timedelta(days=days_since_start)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    end_local = start_local + datetime.timedelta(days=7)

    return start_local.astimezone(datetime.UTC), end_local.astimezone(datetime.UTC)


def _safe_replace_day(year: int, month: int, day: int) -> tuple[int, int, int]:
    """Ensures day is clamped to the maximum days in given year and month."""
    max_days = calendar.monthrange(year, month)[1]
    return year, month, min(day, max_days)


def get_month_boundaries(
    dt: datetime.datetime | None = None,
    tz: ZoneInfo | None = None,
    month_start_day: int = 1,  # 1 to 28 per schema check constraint
) -> tuple[datetime.datetime, datetime.datetime]:
    """Returns half-open interval [start_utc, end_utc) for the salary cycle month."""
    tz = tz or ZoneInfo("Asia/Kolkata")
    now_tz = (dt or datetime.datetime.now(datetime.UTC)).astimezone(tz)

    year = now_tz.year
    month = now_tz.month
    day = now_tz.day

    clamped_day = max(1, min(month_start_day, 28))

    if day >= clamped_day:
        # Current cycle started in this month on clamped_day
        start_year, start_month, start_day = _safe_replace_day(year, month, clamped_day)
        # Ends next month on clamped_day
        if month == 12:
            end_year, end_month, end_day = _safe_replace_day(year + 1, 1, clamped_day)
        else:
            end_year, end_month, end_day = _safe_replace_day(year, month + 1, clamped_day)
    else:
        # Current cycle started last month on clamped_day
        if month == 1:
            start_year, start_month, start_day = _safe_replace_day(year - 1, 12, clamped_day)
        else:
            start_year, start_month, start_day = _safe_replace_day(year, month - 1, clamped_day)
        end_year, end_month, end_day = _safe_replace_day(year, month, clamped_day)

    start_local = datetime.datetime(start_year, start_month, start_day, 0, 0, 0, 0, tzinfo=tz)
    end_local = datetime.datetime(end_year, end_month, end_day, 0, 0, 0, 0, tzinfo=tz)

    return start_local.astimezone(datetime.UTC), end_local.astimezone(datetime.UTC)
