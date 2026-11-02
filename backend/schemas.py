"""Pydantic request/response models (data contracts) for the DocAssist AI API."""

import datetime as dt
from typing import List, Optional

from pydantic import BaseModel, Field


# --- Appointment Schemas ---
class AppointmentResponse(BaseModel):
    id: int
    patient_name: str
    reason: Optional[str] = None
    start_time: dt.datetime
    canceled: bool
    created_at: dt.datetime
    transcript: Optional[str] = None


# --- Clinic Settings Schemas ---
HHMM_PATTERN = r"^([01]\d|2[0-3]):[0-5]\d$"


class BreakPeriod(BaseModel):
    start: str = Field(..., pattern=HHMM_PATTERN)
    end: str = Field(..., pattern=HHMM_PATTERN)


class DaySchedule(BaseModel):
    enabled: bool = False
    start: str = Field("09:00", pattern=HHMM_PATTERN)
    end: str = Field("17:00", pattern=HHMM_PATTERN)
    breaks: List[BreakPeriod] = []


class ClinicSettingsResponse(BaseModel):
    start_hour: int = Field(..., ge=0, le=23)
    end_hour: int = Field(..., ge=0, le=23)
    slot_duration_minutes: int
    working_days: str
    holidays: str
    weekly_schedule: List[DaySchedule] = []
    is_default_schedule: bool = True  # True until the doctor saves per-day hours in the Scheduler


class UpdateClinicSettingsRequest(BaseModel):
    start_hour: int = Field(12, ge=0, le=23)
    end_hour: int = Field(17, ge=0, le=23)
    slot_duration_minutes: int
    working_days: str = ""
    holidays: str
    # When sent, it replaces start_hour / end_hour / working_days (those are derived from it)
    weekly_schedule: Optional[List[DaySchedule]] = Field(None, min_length=7, max_length=7)


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

