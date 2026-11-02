"""FastAPI Backend for Clinic Assistant AI Receptionist.

Handles patient appointment scheduling, cancellation, listing,
clinic configuration, and user authentication with WebSocket support.
Supports direct REST calls from Next.js dashboard as well as
VAPI AI Voice Agent tool calls and webhook payloads.

This file is the web layer (app, middleware and endpoints). The logic lives in:
  schemas.py     request/response models
  parsing.py     reading dates, times, names and VAPI tool-call payloads
  scheduling.py  clinic hours, breaks, slot grid and availability
  services.py    booking, cancelling, call transcripts, WebSocket updates, passwords
"""

import datetime as dt
import json
import os
import sys

from fastapi import Depends, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session
import uvicorn

# Ensure the root and backend directories are on the system path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database.database import Appointment, ClinicSettings, User, get_db, init_db
from schemas import (
    AppointmentResponse, ClinicSettingsResponse, LoginRequest, SignUpRequest, UpdateClinicSettingsRequest, UserResponse,
)
from parsing import (
    _extract_call_id, _extract_datetime_and_time, _extract_patient_name, _extract_tool_payload,
    _parse_date_value, _parse_datetime_value,
)
from scheduling import (
    _availability_summary, _hours_text, _load_settings, _settings_response, _slot_minutes, _tool_reply,
    _validate_weekly_schedule, _working_days_text,
)
from services import (
    _save_call_transcript, cancel_appointment_core, get_password_hash, manager, schedule_appointment_core,
    verify_password,
)

# Initialize SQLite / PostgreSQL database tables on startup
init_db()


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
# WebSocket Real-Time Endpoint
# ---------------------------------------------------------------------------
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
@app.get("/settings/", response_model=ClinicSettingsResponse, include_in_schema=False)
def get_settings(db: Session = Depends(get_db)):
    """Fetch current clinic operating hours, working days, and holidays."""
    settings = db.execute(select(ClinicSettings)).scalar_one_or_none()
    if not settings:
        settings = ClinicSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return _settings_response(settings)


@app.post("/settings", response_model=ClinicSettingsResponse)
@app.post("/settings/", response_model=ClinicSettingsResponse, include_in_schema=False)
def update_settings(request: UpdateClinicSettingsRequest, db: Session = Depends(get_db)):
    """Update clinic schedule configuration."""
    if request.weekly_schedule is not None:
        _validate_weekly_schedule(request.weekly_schedule)
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

        if request.weekly_schedule is not None:
            # Keep the summary columns in sync so older screens (dashboard, receptionist) still read correctly
            enabled = [(i, d) for i, d in enumerate(request.weekly_schedule) if d.enabled]
            settings.weekly_schedule = json.dumps([d.model_dump() for d in request.weekly_schedule])
            settings.working_days = ",".join(str(i) for i, _ in enabled)
            if enabled:
                settings.start_hour = min(int(d.start[:2]) for _, d in enabled)
                settings.end_hour = min(23, max(int(d.end[:2]) + (d.end[3:] != "00") for _, d in enabled))

        db.commit()
        db.refresh(settings)

        return _settings_response(settings)
    except Exception as e:
        print(f"Error in update_settings: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Appointment Management Endpoints
# ---------------------------------------------------------------------------
@app.post("/schedule_appointment")
@app.post("/schedule_appointment/", include_in_schema=False)
async def schedule_appointment(request: Request, db: Session = Depends(get_db)):
    """Schedule a new appointment, accepting direct REST or VAPI tool-call requests."""
    args, tool_call_id, func_name = await _extract_tool_payload(request)
    print(f"[VAPI] [VAPI/API SCHEDULE] func={func_name}, tool_call_id={tool_call_id}, args={args}")

    patient_name = _extract_patient_name(args)
    reason = args.get("reason") or args.get("notes") or args.get("details") or "General Consultation"
    parsed_dt, raw_time = _extract_datetime_and_time(args)

    if not patient_name:
        return _tool_reply(tool_call_id, "Patient name is required to book an appointment.")

    if not parsed_dt:
        return _tool_reply(tool_call_id, "A valid appointment date and time is required.")

    return await schedule_appointment_core(patient_name, reason, parsed_dt, tool_call_id, db, call_id=await _extract_call_id(request))


@app.post("/cancel_appointment")
@app.post("/cancel_appointment/", include_in_schema=False)
@app.post("/cancel_appointments", include_in_schema=False)
@app.post("/cancel_appointments/", include_in_schema=False)
async def cancel_appointment(request: Request, db: Session = Depends(get_db)):
    """Cancel existing appointments for a patient on a specific date."""
    args, tool_call_id, func_name = await _extract_tool_payload(request)
    print(f"[VAPI] [VAPI/API CANCEL] func={func_name}, tool_call_id={tool_call_id}, args={args}")

    return await cancel_appointment_core(args, tool_call_id, db)


@app.api_route("/list_appointments", methods=["GET", "POST"])
@app.api_route("/list_appointments/", methods=["GET", "POST"], include_in_schema=False)
@app.api_route("/check_doctor_availability", methods=["GET", "POST"], include_in_schema=False)
@app.api_route("/check_doctor_availability/", methods=["GET", "POST"], include_in_schema=False)
@app.api_route("/check_doctor_availabilty", methods=["GET", "POST"], include_in_schema=False)
@app.api_route("/check_doctor_availabilty/", methods=["GET", "POST"], include_in_schema=False)
@app.api_route("/doctor_availability", methods=["GET", "POST"], include_in_schema=False)
@app.api_route("/doctor_availability/", methods=["GET", "POST"], include_in_schema=False)
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
            print(f"[VAPI] [VAPI AVAILABILITY] func={func_name}, tool_call_id={tool_call_id}, args={args}")
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
            created_at=appointment.created_at,
            transcript=appointment.transcript
        ))

    settings = _load_settings(db)

    hours_text = _hours_text(settings)
    working_days_text = _working_days_text(settings)
    slot_minutes = _slot_minutes(settings)
    summary_text, available_slots = _availability_summary(db, settings, target_date)

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
            "slot_duration_minutes": slot_minutes,
            "available_slots": available_slots,
            "summary": summary_text,
            "booked_appointments": booked_appointments,
            "appointments": booked_appointments
        }

    if request.method == "GET" or "check_doctor_availability" in request.url.path or "doctor_availability" in request.url.path:
        return {
            "doctor_available_hours": hours_text,
            "working_days": working_days_text,
            "slot_duration_minutes": slot_minutes,
            "available_slots": available_slots,
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
    # End-of-call report: save the transcript (handled before tool parsing to avoid logging the huge payload)
    try:
        body = await request.json()
    except Exception:
        body = {}
    message = body.get("message") if isinstance(body, dict) else None
    if isinstance(message, dict) and message.get("type") == "end-of-call-report":
        return await _save_call_transcript(message, db)

    args, tool_call_id, func_name = await _extract_tool_payload(request)
    print(f"[VAPI] [VAPI GENERAL ROUTER] func={func_name}, tool_call_id={tool_call_id}, args={args}")

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
        return await schedule_appointment_core(patient_name, reason, parsed_dt, tool_call_id, db, call_id=await _extract_call_id(request))

    elif "cancel" in func_lower:
        return await cancel_appointment_core(args, tool_call_id, db)

    elif "availab" in func_lower or "list" in func_lower or "doctor" in func_lower:
        date_arg = args.get("date") or args.get("start_time")
        target_date = _parse_date_value(date_arg)
        summary, _ = _availability_summary(db, _load_settings(db), target_date)
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
