"""Clinic schedule rules: settings, per-day hours and breaks, the slot grid and availability text."""

import datetime as dt
import json
from typing import Any, List, Optional, Tuple

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from database.database import Appointment, ClinicSettings, get_pakistan_now
from schemas import ClinicSettingsResponse, DaySchedule


# ---------------------------------------------------------------------------
# Shared Response & Settings Helpers
# ---------------------------------------------------------------------------
def _tool_reply(tool_call_id: Optional[str], message: str, success: bool = False,
                status: Optional[str] = None, **extra: Any) -> dict:
    """Universal reply readable by both REST clients and VAPI tools.

    Always HTTP 200 with the message in 'results', so the AI receptionist reads the
    explanation to the caller instead of falling back to a generic technical error.
    """
    return {
        "success": success,
        "status": status or ("success" if success else "error"),
        "message": message,
        "detail": message,
        "result": message,
        "results": [{"toolCallId": tool_call_id or "tool_call_result", "result": message}],
        **extra,
    }


def _load_settings(db: Session) -> ClinicSettings:
    """Current clinic settings, or unsaved defaults if none have been saved yet."""
    return db.execute(select(ClinicSettings)).scalar_one_or_none() or ClinicSettings()



# ---------------------------------------------------------------------------
# Settings Response & Validation
# ---------------------------------------------------------------------------
DAY_NAMES = {0: "Monday", 1: "Tuesday", 2: "Wednesday", 3: "Thursday", 4: "Friday", 5: "Saturday", 6: "Sunday"}


def _settings_response(settings: ClinicSettings) -> ClinicSettingsResponse:
    return ClinicSettingsResponse(
        start_hour=settings.start_hour,
        end_hour=settings.end_hour,
        slot_duration_minutes=settings.slot_duration_minutes,
        working_days=settings.working_days,
        holidays=settings.holidays,
        weekly_schedule=_weekly_schedule(settings),
        is_default_schedule=not settings.weekly_schedule,
    )


def _validate_weekly_schedule(days: List[DaySchedule]) -> None:
    """Reject days that end before they start, or breaks outside the day / overlapping each other."""
    for weekday, day in enumerate(days):
        if not day.enabled:
            continue
        name = DAY_NAMES[weekday]
        if day.end <= day.start:
            raise HTTPException(status_code=422, detail=f"{name}: finish time must be after start time.")
        previous_end = day.start
        for b in sorted(day.breaks, key=lambda b: b.start):
            if b.end <= b.start:
                raise HTTPException(status_code=422, detail=f"{name}: break must end after it starts.")
            if b.start < previous_end or b.end > day.end:
                raise HTTPException(status_code=422, detail=f"{name}: breaks must be inside working hours and must not overlap.")
            previous_end = b.end


# ---------------------------------------------------------------------------
# Slot Grid Helpers
# ---------------------------------------------------------------------------
def _fmt_time(value: dt.datetime) -> str:
    """Format a datetime as a spoken-friendly 12-hour time, e.g. '8:30 AM'."""
    return value.strftime("%I:%M %p").lstrip("0")


def _weekly_schedule(settings: ClinicSettings) -> List[dict]:
    """The 7-day schedule (index 0 = Monday) saved in the Scheduler.
    Before the doctor saves one, every working day uses the clinic-wide start/end hour with no breaks."""
    if settings.weekly_schedule:
        return json.loads(settings.weekly_schedule)
    working_days = [int(d.strip()) for d in (settings.working_days or "").split(",") if d.strip().isdigit()]
    start, end = f"{settings.start_hour:02d}:00", f"{settings.end_hour:02d}:00"
    return [{"enabled": i in working_days, "start": start, "end": end, "breaks": []} for i in range(7)]


def _day_schedule(settings: ClinicSettings, weekday: int) -> Optional[dict]:
    """Schedule for a weekday, or None if it is a day off."""
    day = _weekly_schedule(settings)[weekday]
    return day if day.get("enabled") else None


def _hhmm(value: str) -> dt.time:
    return dt.datetime.strptime(value, "%H:%M").time()


def _range_text(start: str, end: str) -> str:
    """'08:00', '18:00' -> '8:00 AM to 6:00 PM'."""
    today = dt.date.today()
    return f"{_fmt_time(dt.datetime.combine(today, _hhmm(start)))} to {_fmt_time(dt.datetime.combine(today, _hhmm(end)))}"


def _day_hours_text(day: dict) -> str:
    """One day's hours including breaks, e.g. '8:00 AM to 6:00 PM (break 1:00 PM to 2:00 PM)'."""
    text = _range_text(day["start"], day["end"])
    breaks = [_range_text(b["start"], b["end"]) for b in sorted(day.get("breaks", []), key=lambda b: b["start"])]
    return text + (f" (break {', '.join(breaks)})" if breaks else "")


def _schedule_groups(settings: ClinicSettings) -> List[Tuple[str, List[str]]]:
    """Working days grouped by identical hours, e.g. [('8:00 AM to 6:00 PM', ['Monday', ...]), ...]."""
    groups: dict = {}
    for weekday, day in enumerate(_weekly_schedule(settings)):
        if day.get("enabled"):
            groups.setdefault(_day_hours_text(day), []).append(DAY_NAMES[weekday])
    return list(groups.items())


def _hours_text(settings: ClinicSettings) -> str:
    """Human-readable clinic operating hours, e.g. '12:00 PM to 5:00 PM'.
    When days differ: '8:00 AM to 6:00 PM on Monday, Tuesday; 9:00 AM to 1:00 PM on Saturday'."""
    groups = _schedule_groups(settings)
    if len(groups) <= 1:
        return groups[0][0] if groups else _range_text(f"{settings.start_hour:02d}:00", f"{settings.end_hour:02d}:00")
    return "; ".join(f"{hours} on {', '.join(days)}" for hours, days in groups)


def _working_days_text(settings: ClinicSettings) -> str:
    """Human-readable working days, e.g. 'Monday, Tuesday, Wednesday'."""
    names = [DAY_NAMES[i] for i, day in enumerate(_weekly_schedule(settings)) if day.get("enabled")]
    return ", ".join(names) if names else "Monday through Friday"


def _schedule_text(settings: ClinicSettings) -> str:
    """'<hours> on <days>' sentence fragment covering the whole week."""
    groups = _schedule_groups(settings)
    if len(groups) <= 1:
        return f"{_hours_text(settings)} on {_working_days_text(settings)}"
    return _hours_text(settings)


def _slot_minutes(settings: ClinicSettings) -> int:
    """Slot length chosen by the doctor in Settings (falls back to 15 if unset or invalid)."""
    return settings.slot_duration_minutes if settings.slot_duration_minutes and settings.slot_duration_minutes > 0 else 15


def _is_clinic_open(settings: ClinicSettings, day: dt.date) -> bool:
    """True if the clinic works on this date (a working weekday and not a holiday)."""
    holidays = [h.strip() for h in (settings.holidays or "").split(",") if h.strip()]
    return day.isoformat() not in holidays and _day_schedule(settings, day.weekday()) is not None


def _break_at(settings: ClinicSettings, value: dt.datetime) -> Optional[dict]:
    """The break that a slot starting at this time would run into, if any."""
    day = _day_schedule(settings, value.weekday())
    if not day:
        return None
    slot_end = (value + dt.timedelta(minutes=_slot_minutes(settings))).time()
    for b in day.get("breaks", []):
        if value.time() < _hhmm(b["end"]) and slot_end > _hhmm(b["start"]):
            return b
    return None


def _slot_grid(settings: ClinicSettings, day: dt.date) -> List[dt.datetime]:
    """All bookable slot start times on a date: every slot length from opening time,
    keeping only slots that finish by closing time. After a break the grid restarts at the break's end.
    e.g. 8 AM-6 PM with 15 min -> 8:00, 8:15 ... 5:45; 30 min -> 8:00, 8:30 ... 5:30; 45 min -> 8:00, 8:45 ... 5:15.
    With a 1-2 PM break and 30 min -> ... 12:30, 2:00, 2:30 ..."""
    schedule = _day_schedule(settings, day.weekday())
    if not schedule:
        return []
    step = dt.timedelta(minutes=_slot_minutes(settings))
    # Working periods = the day split around its breaks
    edges = [schedule["start"]]
    for b in sorted(schedule.get("breaks", []), key=lambda b: b["start"]):
        edges += [b["start"], b["end"]]
    edges.append(schedule["end"])

    slots = []
    for period_start, period_end in zip(edges[::2], edges[1::2]):
        current = dt.datetime.combine(day, _hhmm(period_start))
        closing = dt.datetime.combine(day, _hhmm(period_end))
        while current + step <= closing:
            slots.append(current)
            current += step
    return slots


def _active_starts_on(db: Session, day: dt.date) -> List[dt.datetime]:
    """Start times of all non-canceled appointments on a date."""
    start_dt = dt.datetime.combine(day, dt.time.min)
    return list(db.execute(
        select(Appointment.start_time)
        .where(Appointment.start_time >= start_dt)
        .where(Appointment.start_time < start_dt + dt.timedelta(days=1))
        .where(Appointment.canceled == False)
    ).scalars().all())


def _overlaps(slot: dt.datetime, booked_starts: List[dt.datetime], step: dt.timedelta) -> bool:
    """True if any booked appointment overlaps this slot (also catches older off-grid bookings)."""
    return any(abs(b - slot) < step for b in booked_starts)


def _free_slots(db: Session, settings: ClinicSettings, day: dt.date) -> List[dt.datetime]:
    """Free, not-yet-passed slots on a date (empty if the clinic is closed that day)."""
    if not _is_clinic_open(settings, day):
        return []
    step = dt.timedelta(minutes=_slot_minutes(settings))
    booked = _active_starts_on(db, day)
    now = get_pakistan_now()
    return [s for s in _slot_grid(settings, day) if s >= now and not _overlaps(s, booked, step)]


def _nearest_free_slots_text(db: Session, settings: ClinicSettings, requested: dt.datetime) -> str:
    """Sentence offering the closest free slots before and after the requested time on the same day."""
    free = _free_slots(db, settings, requested.date())
    if not free:
        return f"There are no free slots left on {requested.strftime('%B %d, %Y')}. Please choose another day."
    before = [s for s in free if s < requested]
    after = [s for s in free if s >= requested]
    options = ([before[-1]] if before else []) + after[:2 if not before else 1]
    return "The nearest available times are " + " and ".join(_fmt_time(s) for s in options) + "."


def _availability_summary(db: Session, settings: ClinicSettings, target_date: Optional[dt.date]) -> Tuple[str, List[str]]:
    """Spoken availability summary for the AI receptionist, plus the free slot times for that date."""
    now_str = get_pakistan_now().strftime("%A, %B %d, %Y at %I:%M %p PKT")
    slot_minutes = _slot_minutes(settings)
    base = (
        f"Current Pakistan time is {now_str}. The doctor's clinic hours are {_schedule_text(settings)}. "
        f"Appointments are booked only in fixed {slot_minutes}-minute slots "
        f"counted from opening time; in-between times cannot be booked."
    )

    if not target_date:
        return base + " Appointments can only be scheduled from today up to 10 days in advance.", []

    date_text = target_date.strftime("%A, %B %d, %Y")
    if not _is_clinic_open(settings, target_date):
        return f"{base} The clinic is closed on {date_text}.", []

    free = [_fmt_time(s) for s in _free_slots(db, settings, target_date)]
    if not free:
        return f"{base} There are no free slots left on {date_text}.", []
    return f"{base} Free slots on {date_text}: {', '.join(free)}.", free
