# 🏥 DocAssist AI — Clinic Assistant AI Voice Agent

An AI-powered voice assistant and clinic management dashboard for scheduling, managing, and tracking patient appointments with automated clinic schedule validations.

---

## 📁 Project Structure

```
Clinic-Assistant-AI-Receptionist/
├── backend/            # FastAPI backend layer (Python)
│   ├── backend.py      # Core API endpoints & VAPI tool call handlers
│   ├── requirements.txt# Dependencies (FastAPI, SQLAlchemy, psycopg, etc.)
│   └── ...
├── frontend/           # Next.js dashboard layer (React 19, TailwindCSS)
│   ├── src/app/        # App router pages (Dashboard, Appointments, Settings)
│   ├── src/components/ # VoiceDialer, AppointmentTable, Charts
│   └── ...
├── database/           # Database layer (SQLAlchemy + PostgreSQL / SQLite fallback)
│   ├── database.py     # Database engine, session maker & ORM models
│   └── appointments_db.db # Local SQLite fallback
├── legacy_nestjs_backend/ # Legacy NestJS backend (for reference)
└── README.md           # Project documentation
```

---

## 🚀 Features

- 🎙️ **AI Voice Receptionist** — Patients book, check availability, and cancel appointments over voice calls powered by VAPI.
- 📅 **Business Rule Enforcement** — Automatically validates doctor operating hours, slot duration, weekly working days, clinic holidays, and a 10-day booking window.
- 🐘 **PostgreSQL Persistence** — Robust production-grade database using SQLAlchemy ORM with connection pooling (`pool_pre_ping=True`) and SQLite fallback for local development.
- 📖 **Clinical Guidelines** — Searchable reference library of clinical protocols for Heart Disease, Kidney Failure, Cancer, and more.
- ⚙️ **Clinic Schedule Configuration** — Dashboard interface to adjust daily working hours, slot durations (15, 30, 45, 60 mins), working days, and closed holiday dates.
- 📊 **Real-Time Analytics & Dashboard** — Live charts, appointment stats, cancellation tracking, and WebSocket-driven updates.
- 🔐 **Staff Authentication** — Secure clinic staff signup and login system using bcrypt password hashing.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Voice Agent** | [VAPI](https://vapi.ai) (WebRTC / Voice AI SDK) |
| **Backend API** | Python, FastAPI, Uvicorn |
| **Database** | PostgreSQL (psycopg 3 / SQLAlchemy) *(with SQLite local fallback)* |
| **Frontend** | Next.js 15, React, TailwindCSS, Lucide Icons, Recharts |
| **Tunneling** | ngrok |

---

## 💰 Voice Agent Cost Breakdown (Per Minute)

The AI receptionist uses modular providers managed under VAPI. Since patients speak directly through the browser interface (WebRTC), there are **zero carrier or telephony costs**:

| Component | Provider (from your screenshot) | Cost per Minute |
|---|---|---|
| **VAPI Platform Fee** | VAPI | ~$0.05 / min |
| **Speech-to-Text (Transcriber)** | Soniox / Deepgram | ~$0.004 / min |
| **Language Model (LLM)** | OpenAI (GPT-4.1) | ~$0.02 / min |
| **Text-to-Speech (Voice)** | Elliot (VAPI Voice) | ~$0.02 / min |
| **Telephony / Carrier** | None (WebRTC browser audio) | $0.00 (FREE) |
| **TOTAL COST** | | **~$0.09 / min (~25 PKR per minute)** |

> **Cost Analysis Notes:**
> - **Zero Telecom Fees:** In-browser calls via the `@vapi-ai/web` SDK route over WebRTC, eliminating Twilio/SIP trunking fees ($0.015–$0.02/min savings).
> - **PKR Conversion:** At current exchange rates, ~$0.09 USD translates to roughly **25 PKR per minute** of active call duration.
> - **Cost Efficiency:** A typical 2-minute appointment booking call costs less than **$0.18 (~50 PKR)** from end to end.

---

## ⚡ Getting Started

### 1. Database Configuration (PostgreSQL)

Set your `DATABASE_URL` environment variable to point to your PostgreSQL instance (local, Supabase, Neon, or Railway):

**Windows (PowerShell):**
```powershell
$env:DATABASE_URL = "postgresql://postgres:your_password@localhost:5432/docassist_db"
```

**Linux / macOS:**
```bash
export DATABASE_URL="postgresql://postgres:your_password@localhost:5432/docassist_db"
```

*(Note: If `DATABASE_URL` is omitted, the application automatically falls back to local SQLite at `database/appointments_db.db` for instant offline testing).*

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/schedule_appointment/` | Book appointment (supports direct REST & VAPI tool calls) |
| `POST` | `/cancel_appointment/` | Cancel patient appointment for a given date |
| `POST / GET` | `/list_appointments/` | Retrieve booked appointments list or doctor availability summary |
| `GET / POST` | `/check_doctor_availability` | Availability query endpoint tailored for VAPI voice agent |
| `GET` | `/settings/` | Get clinic operating hours, working days, and holidays |
| `POST` | `/settings/` | Update clinic operating hours and holiday schedules |
| `POST` | `/auth/signup` | Register clinic staff account |
| `POST` | `/auth/login` | Staff authentication with hashed credentials |
| `WS` | `/ws` | Real-time WebSocket connection for live UI refreshes |
| `POST` | `/webhook` / `/vapi` | General webhook router for VAPI tool execution |

---

## ⚙️ Scheduling Validations

All bookings (via voice or dashboard) strictly enforce:
1. **Clinic Operating Hours** — Rejects times outside doctor's configured hours (e.g., 10:00 AM – 8:00 PM).
2. **Working Days Check** — Rejects appointments requested on non-working weekdays.
3. **Holiday Blockout** — Automatic check against clinic-configured holiday dates (`YYYY-MM-DD`).
4. **Booking Window** — Cannot book in the past; maximum advance window is **10 days**.
5. **No Double Booking** — Prevents duplicate active bookings for the same patient or time slot.
6. **Graceful Voice Responses** — VAPI receives clean conversational explanations on validation blocks instead of crashing the voice call.

