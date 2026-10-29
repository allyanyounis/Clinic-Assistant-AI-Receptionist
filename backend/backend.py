"""FastAPI Backend for Clinic Assistant AI Receptionist.

Handles patient appointment scheduling, cancellation, listing,
clinic configuration, and user authentication with WebSocket support.
Supports direct REST calls from Next.js dashboard as well as
VAPI AI Voice Agent tool calls and webhook payloads.
"""

import datetime as dt
import json
import os
import re
import sys
from typing import List, Optional, Tuple, Any

from fastapi import Depends, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
import uvicorn

# Ensure the root and backend directories are on the system path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database.database import Appointment, ClinicSettings, User, get_db, init_db

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


# Initialize SQLite / PostgreSQL database tables on startup
init_db()


# ---------------------------------------------------------------------------
# Pydantic Schemas / Data Contracts
# ---------------------------------------------------------------------------

# --- Appointment Schemas ---
class AppointmentRequest(BaseModel):
    patient_name: str
    reason: Optional[str] = "General Consultation"
    start_time: dt.datetime


class AppointmentResponse(BaseModel):
    id: int
    patient_name: str
    reason: Optional[str] = None
    start_time: dt.datetime
    canceled: bool
    created_at: dt.datetime


class CancelAppointmentRequest(BaseModel):
    patient_name: Optional[str] = None
    date: dt.date


class CancelAppointmentResponse(BaseModel):
    canceled_count: int


class ListAppointmentRequest(BaseModel):
    date: Optional[dt.date] = None


# --- Clinic Settings Schemas ---
class ClinicSettingsResponse(BaseModel):
    start_hour: int = Field(..., ge=0, le=23)
    end_hour: int = Field(..., ge=0, le=23)
    slot_duration_minutes: int
    working_days: str
    holidays: str


class UpdateClinicSettingsRequest(BaseModel):
    start_hour: int = Field(..., ge=0, le=23)
    end_hour: int = Field(..., ge=0, le=23)
    slot_duration_minutes: int
    working_days: str
    holidays: str


# --- Authentication Schemas ---
class SignUpRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    name: str
    email: str
    isLoggedIn: bool = True


# ---------------------------------------------------------------------------
# FastAPI Application & Middleware
# ---------------------------------------------------------------------------
app = FastAPI(title="DocAssist AI - Clinic Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time communication."""
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.send_personal_message(f"Received: {data}", websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ---------------------------------------------------------------------------
# Authentication Endpoints
# ---------------------------------------------------------------------------
@app.post("/auth/signup", response_model=UserResponse)
def signup(request: SignUpRequest, db: Session = Depends(get_db)):
    """Register a new clinic staff account."""
    stmt = select(User).where(User.email == request.email)
    existing_user = db.execute(stmt).scalars().first()
    if existing_user:
        raise HTTPException(status_code=400, detail="A user with this email already exists.")

    new_user = User(
        name=request.name,
        email=request.email,
        password_hash=get_password_hash(request.password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return UserResponse(name=new_user.name, email=new_user.email)


@app.post("/auth/login", response_model=UserResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate clinic staff using email and password."""
    stmt = select(User).where(User.email == request.email)
    user = db.execute(stmt).scalars().first()

    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    return UserResponse(name=user.name, email=user.email)


# ---------------------------------------------------------------------------
# Clinic Settings Endpoints
# ---------------------------------------------------------------------------
@app.get("/settings", response_model=ClinicSettingsResponse)
@app.get("/settings/", response_model=ClinicSettingsResponse)
def get_settings(db: Session = Depends(get_db)):
    """Fetch current clinic operating hours, working days, and holidays."""
    settings = db.execute(select(ClinicSettings)).scalar_one_or_none()
    if not settings:
        settings = ClinicSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return ClinicSettingsResponse(
        start_hour=settings.start_hour,
        end_hour=settings.end_hour,
        slot_duration_minutes=settings.slot_duration_minutes,
        working_days=settings.working_days,
        holidays=settings.holidays
    )


@app.post("/settings", response_model=ClinicSettingsResponse)
@app.post("/settings/", response_model=ClinicSettingsResponse)
def update_settings(request: UpdateClinicSettingsRequest, db: Session = Depends(get_db)):
    """Update clinic schedule configuration."""
    try:
        settings = db.execute(select(ClinicSettings)).scalars().first()
        if not settings:
            settings = ClinicSettings()
            db.add(settings)

        settings.start_hour = request.start_hour
        settings.end_hour = request.end_hour
        settings.slot_duration_minutes = request.slot_duration_minutes
        settings.working_days = request.working_days
        settings.holidays = request.holidays

        db.commit()
        db.refresh(settings)

        return settings
    except Exception as e:
        print(f"Error in update_settings: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Parsing and Payload Extraction Helpers
# ---------------------------------------------------------------------------
def _parse_time_value(time_str: str) -> Optional[dt.time]:
    """Parse time string in multiple common formats."""
    if not time_str or not isinstance(time_str, str):
        return None
    time_str = time_str.strip().upper()
    for fmt in ["%I:%M %p", "%I:%M%p", "%I %p", "%I%p", "%H:%M:%S", "%H:%M"]:
        try:
            return dt.datetime.strptime(time_str, fmt).time()
        except ValueError:
            pass
    return None


def _parse_date_value(val: Any) -> Optional[dt.date]:
    """Safely parse date from date object, datetime object, or natural string (e.g. '2 November', 'November 2', '2026-11-02')."""
    if not val:
        return None
    if isinstance(val, dt.datetime):
        return val.date()
    if isinstance(val, dt.date):
        return val
    if isinstance(val, str):
        val = val.strip()
        # Clean ordinal suffixes: 1st, 2nd, 3rd, 4th
        clean_val = re.sub(r'(\d+)(st|nd|rd|th)', r'\1', val, flags=re.IGNORECASE).strip()

        # Handle ISO timestamp format (e.g. 2026-11-02T15:00:00)
        if "T" in clean_val:
            clean_val = clean_val.split("T")[0]

        # Try standard ISO
        try:
            return dt.date.fromisoformat(clean_val)
        except Exception:
            pass

        now_year = dt.datetime.now().year
        formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%m/%d/%Y",
            "%d/%m/%Y",
            "%d %B %Y",
            "%B %d, %Y",
            "%B %d %Y",
            "%d %b %Y",
            "%b %d, %Y",
            "%b %d %Y",
            "%d %B",
            "%B %d",
            "%d %b",
            "%b %d",
        ]
        for fmt in formats:
            try:
                parsed = dt.datetime.strptime(clean_val, fmt).date()
                if "%Y" not in fmt and "%y" not in fmt:
                    parsed = parsed.replace(year=now_year)
                return parsed
            except ValueError:
                pass

        if " " in clean_val:
            date_part = clean_val.split(" ")[0]
            try:
                return dt.date.fromisoformat(date_part)
            except Exception:
                pass

    return None


def _parse_datetime_value(val: Any, time_val: Any = None) -> Optional[dt.datetime]:
    """Parse datetime from ISO strings, combined date+time, or naive datetime."""
    if not val:
        return None
    if isinstance(val, dt.datetime):
        return val.replace(tzinfo=None) if val.tzinfo else val
    if isinstance(val, dt.date):
        if time_val:
            parsed_time = _parse_time_value(str(time_val))
            if parsed_time:
                return dt.datetime.combine(val, parsed_time)
        return dt.datetime.combine(val, dt.time(12, 0))

    if isinstance(val, str):
        val = val.strip()
        clean_val = val
        if clean_val.endswith("Z") or clean_val.endswith("z"):
            clean_val = clean_val[:-1]

        for fmt in [
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
        ]:
            try:
                parsed = dt.datetime.strptime(clean_val, fmt)
                if fmt == "%Y-%m-%d" and time_val:
                    parsed_time = _parse_time_value(str(time_val))
                    if parsed_time:
                        return dt.datetime.combine(parsed.date(), parsed_time)
                return parsed
            except ValueError:
                pass

        try:
            parsed = dt.datetime.fromisoformat(clean_val)
            return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
        except Exception:
            pass

        # Try parsing natural date with optional time
        p_date = _parse_date_value(clean_val)
        if p_date:
            p_time = _parse_time_value(str(time_val)) if time_val else dt.time(12, 0)
            return dt.datetime.combine(p_date, p_time or dt.time(12, 0))

    return None


async def _extract_tool_payload(request: Request) -> Tuple[dict, Optional[str], Optional[str]]:
    """Extract tool arguments, tool_call_id, and function name from incoming request.

    Supports:
    - VAPI webhook payload: body["message"]["toolCalls"]
    - VAPI direct toolCall: body["toolCall"] or body["toolCalls"]
    - Standard REST payload: body
    """
    try:
        body = await request.json()
    except Exception:
        body = {}

    tool_call_id = None
    func_name = None
    args = {}

    if isinstance(body, dict):
        if "message" in body and isinstance(body["message"], dict):
            msg = body["message"]
            tool_calls = msg.get("toolCalls") or msg.get("tools") or []
            if tool_calls and isinstance(tool_calls, list) and len(tool_calls) > 0:
                first_tool = tool_calls[0]
                tool_call_id = first_tool.get("id")
                fn = first_tool.get("function", {})
                func_name = fn.get("name")
                raw_args = fn.get("arguments", {})
                if isinstance(raw_args, str):
                    try:
                        args = json.loads(raw_args)
                    except Exception:
                        args = {}
                elif isinstance(raw_args, dict):
                    args = raw_args
        elif "toolCall" in body and isinstance(body["toolCall"], dict):
            tc = body["toolCall"]
            tool_call_id = tc.get("id")
            fn = tc.get("function", {})
            func_name = fn.get("name")
            raw_args = fn.get("arguments", {})
            if isinstance(raw_args, str):
                try:
                    args = json.loads(raw_args)
                except Exception:
                    args = {}
            elif isinstance(raw_args, dict):
                args = raw_args
        elif "toolCalls" in body and isinstance(body["toolCalls"], list) and len(body["toolCalls"]) > 0:
            tc = body["toolCalls"][0]
            tool_call_id = tc.get("id")
            fn = tc.get("function", {})
            func_name = fn.get("name")
            raw_args = fn.get("arguments", {})
            if isinstance(raw_args, str):
                try:
                    args = json.loads(raw_args)
                except Exception:
                    args = {}
            elif isinstance(raw_args, dict):
                args = raw_args
        else:
            args = body

    return args, tool_call_id, func_name


# ---------------------------------------------------------------------------
# Core Appointment Scheduling Logic
# ---------------------------------------------------------------------------
async def schedule_appointment_core(
    patient_name: str,
    reason: str,
    start_time: dt.datetime,
    tool_call_id: Optional[str],
    db: Session
):
    """Core scheduling function with full business rule enforcement.

    For VAPI voice callers (tool_call_id present), validation failures are returned
    as 200 responses with the message in 'results' so the AI Receptionist can read
    the friendly explanation to the caller rather than triggering a technical error fallback.
    """
    settings = db.execute(select(ClinicSettings)).scalar_one_or_none()
    if not settings:
        settings = ClinicSettings()

    def respond_error(detail: str):
        if tool_call_id:
            return {
                "results": [
                    {
                        "toolCallId": tool_call_id,
                        "result": detail
                    }
                ]
            }
        raise HTTPException(status_code=400, detail=detail)

    req_date_str = start_time.strftime('%Y-%m-%d')
    holidays = [h.strip() for h in settings.holidays.split(',')] if settings.holidays else []

    # 1. Holiday Check
    if req_date_str in holidays:
        return respond_error(f"I'm sorry, but the clinic is closed for a holiday on {start_time.strftime('%B %d, %Y')}.")

    # 2. Working Days Check (0=Monday ... 6=Sunday)
    working_days = [int(d.strip()) for d in settings.working_days.split(',')] if settings.working_days else []
    if start_time.weekday() not in working_days:
        return respond_error(
            f"I'm sorry, but the clinic is closed on this day of the week. "
            f"{start_time.strftime('%B %d, %Y')} falls on a non-working day. "
            "Please choose a valid working day."
        )

    # 3. Booking Window Check (not in the past, within 10 days)
    current_dt = dt.datetime.now()
    if start_time < current_dt - dt.timedelta(minutes=15):
        return respond_error(
            "I'm sorry, but you cannot book an appointment in the past. "
            "Please choose a date and time today or up to 10 days from today."
        )

    if start_time.date() > current_dt.date() + dt.timedelta(days=10):
        max_date = current_dt.date() + dt.timedelta(days=10)
        return respond_error(
            f"I'm sorry, but appointments can only be booked up to 10 days in advance. "
            f"The latest date you can book is {max_date.strftime('%B %d, %Y')}."
        )

    # 4. Operating Hours Check
    if start_time.hour < settings.start_hour or start_time.hour >= settings.end_hour:
        start_ampm = "AM" if settings.start_hour < 12 else "PM"
        end_ampm = "AM" if settings.end_hour < 12 else "PM"
        sh = settings.start_hour % 12 or 12
        eh = settings.end_hour % 12 or 12
        return respond_error(
            f"I'm sorry, but your requested appointment time of "
            f"{start_time.strftime('%I:%M %p')} is outside clinic hours. "
            f"The doctor is only available between {sh}:00 {start_ampm} and {eh}:00 {end_ampm}. "
            "Please choose a different time slot."
        )

    # 5. Same-Person Duplicate Booking Check
    same_person_booking = db.execute(
        select(Appointment)
        .where(Appointment.patient_name == patient_name)
        .where(Appointment.start_time == start_time)
        .where(Appointment.canceled == False)
    ).scalar_one_or_none()

    if same_person_booking:
        return respond_error(
            f"It looks like {patient_name} already has an appointment "
            f"on {start_time.strftime('%B %d, %Y')} at {start_time.strftime('%I:%M %p')}. "
            "You cannot book the same slot twice. Please choose a different time."
        )

    # 6. Slot Availability Check (no conflicting active booking)
    existing_appointment = db.execute(
        select(Appointment)
        .where(Appointment.start_time == start_time)
        .where(Appointment.canceled == False)
    ).scalar_one_or_none()

    if existing_appointment:
        return respond_error(
            f"I'm sorry, but the {start_time.strftime('%I:%M %p')} slot on "
            f"{start_time.strftime('%B %d, %Y')} is already booked by another patient. "
            "Please choose a different time slot."
        )

    # Create and persist new appointment
    new_appointment = Appointment(
        patient_name=patient_name,
        reason=reason,
        start_time=start_time,
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

    if tool_call_id:
        return {
            "results": [
                {
                    "toolCallId": tool_call_id,
                    "result": success_msg
                }
            ],
            "id": new_appointment.id,
            "patient_name": new_appointment.patient_name,
            "reason": new_appointment.reason,
            "start_time": new_appointment.start_time,
            "canceled": new_appointment.canceled,
            "created_at": new_appointment.created_at
        }

    return AppointmentResponse(
        id=new_appointment.id,
        patient_name=new_appointment.patient_name,
        reason=new_appointment.reason,
        start_time=new_appointment.start_time,
        canceled=new_appointment.canceled,
        created_at=new_appointment.created_at
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
    patient_name = args.get("patient_name") or args.get("patientName") or args.get("name")
    date_raw = args.get("date") or args.get("start_time") or args.get("startTime") or args.get("datetime")
    target_date = _parse_date_value(date_raw)

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
        if tool_call_id:
            return {"results": [{"toolCallId": tool_call_id, "result": detail}]}
        raise HTTPException(status_code=400, detail=detail)

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
        if tool_call_id:
            return {"results": [{"toolCallId": tool_call_id, "result": detail}]}
        raise HTTPException(status_code=404, detail=detail)

    for appointment in appointments:
        appointment.canceled = True

    db.commit()

    try:
        await manager.broadcast("cancel_appointment")
    except Exception:
        pass

    success_msg = f"Your appointment on {target_date.strftime('%B %d, %Y')} has been successfully canceled."
    if tool_call_id:
        return {
            "results": [
                {
                    "toolCallId": tool_call_id,
                    "result": success_msg
                }
            ],
            "canceled_count": len(appointments)
        }

    return CancelAppointmentResponse(canceled_count=len(appointments))


# ---------------------------------------------------------------------------
# Appointment Management Endpoints
# ---------------------------------------------------------------------------
@app.post("/schedule_appointment")
@app.post("/schedule_appointment/")
async def schedule_appointment(request: Request, db: Session = Depends(get_db)):
    """Schedule a new appointment, accepting direct REST or VAPI tool-call requests."""
    args, tool_call_id, func_name = await _extract_tool_payload(request)
    print(f"📡 [VAPI/API SCHEDULE] func={func_name}, tool_call_id={tool_call_id}, args={args}")

    patient_name = args.get("patient_name") or args.get("patientName") or args.get("name")
    reason = args.get("reason") or args.get("notes") or args.get("details") or "General Consultation"

    start_time_raw = args.get("start_time") or args.get("startTime") or args.get("datetime")
    time_raw = args.get("time")
    date_raw = args.get("date")

    parsed_dt = _parse_datetime_value(start_time_raw or date_raw, time_val=time_raw)

    if not patient_name:
        detail = "Patient name is required to book an appointment."
        if tool_call_id:
            return {"results": [{"toolCallId": tool_call_id, "result": detail}]}
        raise HTTPException(status_code=400, detail=detail)

    if not parsed_dt:
        detail = "A valid appointment date and time is required."
        if tool_call_id:
            return {"results": [{"toolCallId": tool_call_id, "result": detail}]}
        raise HTTPException(status_code=400, detail=detail)

    return await schedule_appointment_core(patient_name, reason, parsed_dt, tool_call_id, db)


@app.post("/cancel_appointment")
@app.post("/cancel_appointment/")
async def cancel_appointment(request: Request, db: Session = Depends(get_db)):
    """Cancel existing appointments for a patient on a specific date."""
    args, tool_call_id, func_name = await _extract_tool_payload(request)
    print(f"📡 [VAPI/API CANCEL] func={func_name}, tool_call_id={tool_call_id}, args={args}")

    return await cancel_appointment_core(args, tool_call_id, db)


@app.api_route("/check_doctor_availability", methods=["GET", "POST"])
@app.api_route("/check_doctor_availability/", methods=["GET", "POST"])
@app.api_route("/doctor_availability", methods=["GET", "POST"])
@app.api_route("/list_appointments", methods=["GET", "POST"])
@app.api_route("/list_appointments/", methods=["GET", "POST"])
async def list_appointments(
    request: Request,
    date: str | None = None,
    db: Session = Depends(get_db)
):
    """List appointments and provide doctor availability info for VAPI and frontend."""
    target_date = _parse_date_value(date)
    tool_call_id = None

    if request.method == "POST":
        args, tool_call_id, func_name = await _extract_tool_payload(request)
        if tool_call_id:
            print(f"📡 [VAPI AVAILABILITY] func={func_name}, tool_call_id={tool_call_id}, args={args}")
        if not target_date:
            date_arg = args.get("date") or args.get("start_time")
            target_date = _parse_date_value(date_arg)

    query = select(Appointment)
    if target_date:
        start_dt = dt.datetime.combine(target_date, dt.time.min)
        end_dt = start_dt + dt.timedelta(days=1)
        query = query.where(Appointment.start_time >= start_dt).where(Appointment.start_time < end_dt)

    query = query.order_by(Appointment.start_time.asc())
    result = db.execute(query)

    booked_appointments = []
    for appointment in result.scalars().all():
        booked_appointments.append(AppointmentResponse(
            id=appointment.id,
            patient_name=appointment.patient_name,
            reason=appointment.reason,
            start_time=appointment.start_time,
            canceled=appointment.canceled,
            created_at=appointment.created_at
        ))

    settings = db.execute(select(ClinicSettings)).scalar_one_or_none()
    if not settings:
        settings = ClinicSettings()

    start_ampm = "AM" if settings.start_hour < 12 else "PM"
    end_ampm = "AM" if settings.end_hour < 12 else "PM"
    sh = settings.start_hour % 12 or 12
    eh = settings.end_hour % 12 or 12
    hours_text = f"{sh}:00 {start_ampm} to {eh}:00 {end_ampm}"

    day_map = {0: "Monday", 1: "Tuesday", 2: "Wednesday", 3: "Thursday", 4: "Friday", 5: "Saturday", 6: "Sunday"}
    working_day_ints = [int(d.strip()) for d in settings.working_days.split(",") if d.strip().isdigit()]
    working_day_names = [day_map[d] for d in working_day_ints if d in day_map]
    working_days_text = ", ".join(working_day_names) if working_day_names else "Monday through Friday"

    active_appts = [a for a in booked_appointments if not a.canceled]
    if target_date:
        if active_appts:
            slots_str = ", ".join([a.start_time.strftime("%I:%M %p") for a in active_appts])
            summary_text = (
                f"On {target_date.strftime('%B %d, %Y')}, doctor available hours are {hours_text}. "
                f"Already booked slots: {slots_str}. All other slots are available."
            )
        else:
            summary_text = (
                f"On {target_date.strftime('%B %d, %Y')}, doctor available hours are {hours_text}. "
                "All slots are currently open."
            )
    else:
        summary_text = f"The doctor is available between {hours_text} on {working_days_text}."

    if tool_call_id:
        return {
            "results": [
                {
                    "toolCallId": tool_call_id,
                    "result": summary_text
                }
            ],
            "doctor_available_hours": hours_text,
            "working_days": working_days_text,
            "slot_duration_minutes": settings.slot_duration_minutes,
            "summary": summary_text,
            "booked_appointments": booked_appointments,
            "appointments": booked_appointments
        }

    if request.method == "GET" or "check_doctor_availability" in request.url.path or "doctor_availability" in request.url.path:
        return {
            "doctor_available_hours": hours_text,
            "working_days": working_days_text,
            "slot_duration_minutes": settings.slot_duration_minutes,
            "summary": summary_text,
            "booked_appointments": booked_appointments,
            "appointments": booked_appointments
        }

    return booked_appointments


# ---------------------------------------------------------------------------
# General Webhook & Root Endpoints
# ---------------------------------------------------------------------------
@app.get("/")
def health_check():
    """Health check endpoint."""
    return {"status": "ok", "message": "DocAssist AI Backend is active and running"}


@app.post("/")
@app.post("/webhook")
@app.post("/vapi")
async def vapi_webhook_router(request: Request, db: Session = Depends(get_db)):
    """General webhook router for VAPI if configured to hit root server URL."""
    args, tool_call_id, func_name = await _extract_tool_payload(request)
    print(f"📡 [VAPI GENERAL ROUTER] func={func_name}, tool_call_id={tool_call_id}, args={args}")

    if not tool_call_id and not func_name:
        return {"status": "ok", "message": "DocAssist AI Backend is active and running"}

    func_lower = (func_name or "").lower()

    if "schedule" in func_lower or "book" in func_lower:
        patient_name = args.get("patient_name") or args.get("patientName") or args.get("name")
        reason = args.get("reason") or args.get("notes") or args.get("details") or "General Consultation"
        start_time_raw = args.get("start_time") or args.get("startTime") or args.get("datetime")
        parsed_dt = _parse_datetime_value(start_time_raw or args.get("date"), time_val=args.get("time"))

        if not patient_name or not parsed_dt:
            return {
                "results": [
                    {
                        "toolCallId": tool_call_id,
                        "result": "Please provide the patient name and desired appointment date and time."
                    }
                ]
            }
        return await schedule_appointment_core(patient_name, reason, parsed_dt, tool_call_id, db)

    elif "cancel" in func_lower:
        return await cancel_appointment_core(args, tool_call_id, db)

    elif "availab" in func_lower or "list" in func_lower or "doctor" in func_lower:
        date_arg = args.get("date") or args.get("start_time")
        target_date = _parse_date_value(date_arg)
        settings = db.execute(select(ClinicSettings)).scalar_one_or_none() or ClinicSettings()
        start_ampm = "AM" if settings.start_hour < 12 else "PM"
        end_ampm = "AM" if settings.end_hour < 12 else "PM"
        sh = settings.start_hour % 12 or 12
        eh = settings.end_hour % 12 or 12
        hours_text = f"{sh}:00 {start_ampm} to {eh}:00 {end_ampm}"
        day_map = {0: "Monday", 1: "Tuesday", 2: "Wednesday", 3: "Thursday", 4: "Friday", 5: "Saturday", 6: "Sunday"}
        working_day_ints = [int(d.strip()) for d in settings.working_days.split(",") if d.strip().isdigit()]
        working_day_names = [day_map[d] for d in working_day_ints if d in day_map]
        working_days_text = ", ".join(working_day_names) if working_day_names else "Monday through Friday"
        summary = f"The doctor is available between {hours_text} on {working_days_text}."
        return {
            "results": [
                {
                    "toolCallId": tool_call_id,
                    "result": summary
                }
            ]
        }

    return {"results": [{"toolCallId": tool_call_id, "result": "Function not recognized."}]}


# ---------------------------------------------------------------------------
# Server Startup
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    uvicorn.run("backend:app", host="127.0.0.1", port=4444, reload=True)
