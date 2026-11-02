"""Core business logic: booking and cancelling appointments, call transcripts,
real-time WebSocket notifications and password hashing."""

import datetime as dt
from typing import Any, List, Optional

from fastapi import WebSocket
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.orm import Session

from database.database import Appointment, get_pakistan_now, PKT
from parsing import _extract_datetime_and_time, _extract_patient_name, _parse_date_value, _parse_time_value
from scheduling import (
    _active_starts_on, _break_at, _day_hours_text, _day_schedule, _fmt_time, _hhmm, _load_settings,
    _nearest_free_slots_text, _overlaps, _range_text, _slot_grid, _slot_minutes, _tool_reply,
)

# ---------------------------------------------------------------------------
# Security & Password Utilities
# ---------------------------------------------------------------------------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    """Hash password using bcrypt, truncated to 72 bytes to avoid passlib limit."""
    return pwd_context.hash(password[:72])


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against hashed password."""
    return pwd_context.verify(plain_password[:72], hashed_password)


# ---------------------------------------------------------------------------
# WebSocket Real-Time Connection Manager
# ---------------------------------------------------------------------------
class ConnectionManager:
    """Manages active WebSocket client connections for real-time notifications."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in list(self.active_connections):
            try:
                await connection.send_text(message)
            except Exception:
                self.disconnect(connection)


manager = ConnectionManager()


# ---------------------------------------------------------------------------
# Core Appointment Scheduling Logic
# ---------------------------------------------------------------------------
async def schedule_appointment_core(
    patient_name: str,
    reason: str,
    start_time: dt.datetime,
    tool_call_id: Optional[str],
    db: Session,
    call_id: Optional[str] = None
):
    """Core scheduling function with full business rule enforcement.

    For VAPI voice callers (tool_call_id present), validation failures are returned
    as 200 responses with the message in 'results' so the AI Receptionist can read
    the friendly explanation to the caller rather than triggering a technical error fallback.
    """
    settings = _load_settings(db)

    req_date_str = start_time.strftime('%Y-%m-%d')
    holidays = [h.strip() for h in settings.holidays.split(',')] if settings.holidays else []

    # 1. Holiday Check
    if req_date_str in holidays:
        return _tool_reply(tool_call_id, f"I'm sorry, but the clinic is closed for a holiday on {start_time.strftime('%B %d, %Y')}.")

    # 2. Working Days Check (0=Monday ... 6=Sunday)
    day_schedule = _day_schedule(settings, start_time.weekday())
    if not day_schedule:
        return _tool_reply(tool_call_id, 
            f"I'm sorry, but the clinic is closed on this day of the week. "
            f"{start_time.strftime('%B %d, %Y')} falls on a non-working day. "
            "Please choose a valid working day."
        )

    # 3. Booking Window Check (not in the past, within 10 days - in Pakistan Time)
    current_dt = get_pakistan_now()
    if start_time < current_dt - dt.timedelta(minutes=15):
        return _tool_reply(tool_call_id, 
            "I'm sorry, but you cannot book an appointment in the past. "
            "Please choose a date and time today or up to 10 days from today."
        )

    if start_time.date() > current_dt.date() + dt.timedelta(days=10):
        max_date = current_dt.date() + dt.timedelta(days=10)
        return _tool_reply(tool_call_id, 
            f"I'm sorry, but appointments can only be booked up to 10 days in advance. "
            f"The latest date you can book is {max_date.strftime('%B %d, %Y')}."
        )

    # 4. Operating Hours Check (the whole slot must finish by closing time)
    slot_minutes = _slot_minutes(settings)
    step = dt.timedelta(minutes=slot_minutes)
    grid = _slot_grid(settings, start_time.date())
    opening = dt.datetime.combine(start_time.date(), _hhmm(day_schedule["start"]))
    if not grid or start_time < opening or start_time > grid[-1]:
        last_slot_text = f" The last appointment slot is at {_fmt_time(grid[-1])}." if grid else ""
        return _tool_reply(tool_call_id,
            f"I'm sorry, but your requested appointment time of "
            f"{_fmt_time(start_time)} is outside clinic hours. "
            f"The doctor is only available from {_day_hours_text(day_schedule)}.{last_slot_text} "
            "Please choose a different time slot."
        )

    # 4a. Break Check: no slot may run into the doctor's break
    on_break = _break_at(settings, start_time)
    if on_break:
        return _tool_reply(tool_call_id,
            f"I'm sorry, the doctor is on a break from {_range_text(on_break['start'], on_break['end'])}, "
            f"so {_fmt_time(start_time)} cannot be booked. "
            f"{_nearest_free_slots_text(db, settings, start_time)}"
        )

    # 4b. Slot Grid Check: only times matching the doctor's slot length
    # (e.g. 8:00 / 8:30 / 9:00 for 30-minute slots, 8:00 / 8:15 / 8:30 for 15-minute slots)
    if start_time not in grid:
        return _tool_reply(tool_call_id, 
            f"I'm sorry, appointments are booked in fixed {slot_minutes}-minute slots, "
            f"so {_fmt_time(start_time)} is not a valid slot. "
            f"{_nearest_free_slots_text(db, settings, start_time)}"
        )

    # 5. Same-Person Duplicate Booking Check
    same_person_booking = db.execute(
        select(Appointment)
        .where(Appointment.patient_name == patient_name)
        .where(Appointment.start_time == start_time)
        .where(Appointment.canceled == False)
    ).scalar_one_or_none()

    if same_person_booking:
        return _tool_reply(tool_call_id, 
            f"It looks like {patient_name} already has an appointment "
            f"on {start_time.strftime('%B %d, %Y')} at {start_time.strftime('%I:%M %p')}. "
            "You cannot book the same slot twice. Please choose a different time."
        )

    # 6. Slot Availability Check (no overlapping active booking, including older off-grid ones)
    if _overlaps(start_time, _active_starts_on(db, start_time.date()), step):
        return _tool_reply(tool_call_id, 
            f"I'm sorry, but the {_fmt_time(start_time)} slot on "
            f"{start_time.strftime('%B %d, %Y')} is already booked by another patient. "
            f"{_nearest_free_slots_text(db, settings, start_time)}"
        )

    # Create and persist new appointment
    new_appointment = Appointment(
        patient_name=patient_name,
        reason=reason,
        start_time=start_time,
        call_id=call_id,
    )
    db.add(new_appointment)
    db.commit()
    db.refresh(new_appointment)

    # Broadcast event to frontend via WebSocket
    try:
        await manager.broadcast("new_appointment")
    except Exception:
        pass

    success_msg = (
        f"Appointment confirmed for {new_appointment.patient_name} on "
        f"{new_appointment.start_time.strftime('%B %d, %Y')} at "
        f"{new_appointment.start_time.strftime('%I:%M %p')} for {new_appointment.reason}."
    )

    # Return universal response compatible with VAPI apiRequest and REST clients
    return _tool_reply(
        tool_call_id, success_msg, success=True,
        id=new_appointment.id,
        patient_name=new_appointment.patient_name,
        reason=new_appointment.reason,
        start_time=new_appointment.start_time.isoformat(),
        canceled=new_appointment.canceled,
        created_at=new_appointment.created_at.isoformat(),
    )


# ---------------------------------------------------------------------------
# Core Appointment Cancellation Logic
# ---------------------------------------------------------------------------
async def cancel_appointment_core(
    args: dict,
    tool_call_id: Optional[str],
    db: Session
):
    """Core cancellation function supporting flexible date/time/name lookups."""
    patient_name = _extract_patient_name(args)
    parsed_dt, raw_time = _extract_datetime_and_time(args)
    target_date = _parse_date_value(args.get("date") or args.get("start_time") or args.get("startTime") or (parsed_dt.date() if parsed_dt else None))

    # If date was not parsed directly from expected keys, scan all string values in args
    if not target_date:
        for k, v in args.items():
            if isinstance(v, str):
                p_date = _parse_date_value(v)
                if p_date:
                    target_date = p_date
                    break

    if not target_date:
        detail = "Please specify the date of the appointment you wish to cancel."
        return _tool_reply(tool_call_id, detail, canceled_count=0)

    start_dt = dt.datetime.combine(target_date, dt.time.min)
    end_dt = start_dt + dt.timedelta(days=1)

    query = (
        select(Appointment)
        .where(Appointment.start_time >= start_dt)
        .where(Appointment.start_time < end_dt)
        .where(Appointment.canceled == False)
    )

    # Filter by patient name if provided and not generic
    if patient_name and patient_name.lower().strip() not in ["caller", "user", "me", "patient", "myself", "client", ""]:
        query = query.where(Appointment.patient_name.ilike(f"%{patient_name.strip()}%"))

    # If specific time is provided, prioritize matching by that slot
    time_raw = args.get("time")
    if time_raw:
        p_time = _parse_time_value(str(time_raw))
        if p_time:
            exact_dt = dt.datetime.combine(target_date, p_time)
            time_query = query.where(Appointment.start_time >= exact_dt - dt.timedelta(minutes=15))\
                              .where(Appointment.start_time <= exact_dt + dt.timedelta(minutes=15))
            matched_by_time = db.execute(time_query).scalars().all()
            if matched_by_time:
                appointments = matched_by_time
            else:
                appointments = db.execute(query).scalars().all()
        else:
            appointments = db.execute(query).scalars().all()
    else:
        appointments = db.execute(query).scalars().all()

    if not appointments:
        detail = f"No active appointment was found on {target_date.strftime('%B %d, %Y')}"
        if patient_name and patient_name.lower() not in ["caller", "user", "me"]:
            detail += f" for {patient_name}."
        else:
            detail += "."
        return _tool_reply(tool_call_id, detail, status="not_found", canceled_count=0)

    for appointment in appointments:
        appointment.canceled = True

    db.commit()

    try:
        await manager.broadcast("cancel_appointment")
    except Exception:
        pass

    success_msg = f"Your appointment on {target_date.strftime('%B %d, %Y')} has been successfully canceled."
    return _tool_reply(tool_call_id, success_msg, success=True, canceled_count=len(appointments))


# ---------------------------------------------------------------------------
# Call Transcript Handling (VAPI end-of-call-report)
# ---------------------------------------------------------------------------
def _format_transcript(report: dict) -> Optional[str]:
    """Build a readable 'AI: ... / User: ...' transcript from a VAPI end-of-call-report message."""
    artifact = report.get("artifact") if isinstance(report.get("artifact"), dict) else {}
    messages = artifact.get("messages") or report.get("messages") or []

    lines = []
    for m in messages if isinstance(messages, list) else []:
        if not isinstance(m, dict):
            continue
        role = m.get("role")
        text = (m.get("message") or m.get("content") or "").strip()
        if not text or role not in ("bot", "assistant", "user"):
            continue  # skip system prompt, tool calls and tool results
        lines.append(f"{'User' if role == 'user' else 'AI'}: {text}")
    if lines:
        return "\n".join(lines)

    # Fallback: VAPI's ready-made plain-text transcript
    transcript = artifact.get("transcript") or report.get("transcript")
    return transcript.strip() if isinstance(transcript, str) and transcript.strip() else None


def _to_pkt_naive(value: Any) -> Optional[dt.datetime]:
    """Convert a VAPI ISO timestamp (UTC, e.g. '2026-11-01T14:36:10.123Z') to naive Pakistan time, matching stored times."""
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(PKT).replace(tzinfo=None)


async def _save_call_transcript(report: dict, db: Session) -> dict:
    """Attach the call transcript to every appointment booked during that call."""
    call = report.get("call") if isinstance(report.get("call"), dict) else {}
    call_id = call.get("id")
    transcript = _format_transcript(report)
    if not call_id or not transcript:
        print(f"[VAPI TRANSCRIPT] Skipped: call_id={call_id}, has_transcript={bool(transcript)}")
        return {"status": "ok", "saved": 0}

    appointments = db.execute(select(Appointment).where(Appointment.call_id == str(call_id))).scalars().all()

    # "API Request" tools don't send the call ID, so fall back to appointments booked during the call
    if not appointments:
        window_start = _to_pkt_naive(report.get("startedAt") or call.get("startedAt") or call.get("createdAt"))
        window_end = _to_pkt_naive(report.get("endedAt") or call.get("endedAt")) or get_pakistan_now()
        if window_start:
            margin = dt.timedelta(minutes=1)
            appointments = db.execute(
                select(Appointment)
                .where(Appointment.created_at >= window_start - margin)
                .where(Appointment.created_at <= window_end + margin)
                .where(Appointment.call_id.is_(None))
                .where(Appointment.transcript.is_(None))
            ).scalars().all()
            for appointment in appointments:
                appointment.call_id = str(call_id)

    for appointment in appointments:
        appointment.transcript = transcript
    db.commit()
    print(f"[VAPI TRANSCRIPT] call_id={call_id}: saved to {len(appointments)} appointment(s)")

    if appointments:
        try:
            await manager.broadcast("transcript_saved")
        except Exception:
            pass
    return {"status": "ok", "saved": len(appointments)}
