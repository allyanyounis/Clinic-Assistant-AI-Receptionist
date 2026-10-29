"""Database configuration, models, and session management using SQLAlchemy."""

import datetime as dt
import os
from typing import Generator

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

# ---------------------------------------------------------------------------
# Database File & Connection Configuration
# ---------------------------------------------------------------------------
# Automatically load .env file if present
def _load_env_file():
    for env_path in [
        os.path.join(os.path.dirname(__file__), "..", "backend", ".env"),
        os.path.join(os.path.dirname(__file__), ".env"),
        os.path.join(os.path.dirname(__file__), "..", ".env"),
    ]:
        if os.path.isfile(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            k, v = k.strip(), v.strip().strip('"').strip("'")
                            if k not in os.environ:
                                os.environ[k] = v
                break
            except Exception:
                pass

_load_env_file()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB_PATH = os.path.join(BASE_DIR, "appointments_db.db")
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")

if DATABASE_URL.startswith("sqlite"):
    print(f"⚠️  [DB INFO] Using SQLITE: {DEFAULT_DB_PATH}")
    print("👉 [DB INFO] To use PostgreSQL, set $env:DATABASE_URL or create a .env file in backend/.env")
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False, "timeout": 30}
    )
else:
    # Ensure compatible driver prefix for PostgreSQL (psycopg 3)
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
    elif DATABASE_URL.startswith("postgresql://") and "+psycopg" not in DATABASE_URL and "+asyncpg" not in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

    # Print masked PostgreSQL connection URL
    safe_url = DATABASE_URL
    if "@" in safe_url and ":" in safe_url.split("@")[0]:
        prefix = safe_url.split("@")[0].rsplit(":", 1)[0]
        suffix = safe_url.split("@")[1]
        safe_url = f"{prefix}:****@{suffix}"
    print(f"🐘 [DB INFO] Connected to POSTGRESQL: {safe_url}")

    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ---------------------------------------------------------------------------
# SQLAlchemy Database Models
# ---------------------------------------------------------------------------
class Appointment(Base):
    """Stores patient appointments with start time, reason, and cancellation status."""
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    patient_name = Column(String, index=True)
    reason = Column(String, nullable=True)
    start_time = Column(DateTime, index=True)
    canceled = Column(Boolean, default=False)
    transcript = Column(Text, nullable=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow)


class ClinicSettings(Base):
    """Stores operating hours, working days, and holidays for the clinic."""
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    start_hour = Column(Integer, default=12)             # 12 PM
    end_hour = Column(Integer, default=17)               # 5 PM
    slot_duration_minutes = Column(Integer, default=15)  # 15 min default
    working_days = Column(String, default="0,1,2,3,4,5") # Mon(0) to Sat(5)
    holidays = Column(String, default="")                # Comma-separated 'YYYY-MM-DD' dates


class User(Base):
    """Stores clinic staff credentials for dashboard authentication."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    created_at = Column(DateTime, default=dt.datetime.utcnow)


# ---------------------------------------------------------------------------
# Helper Functions & Dependency
# ---------------------------------------------------------------------------
def init_db() -> None:
    """Create all tables in the database and ensure column schema is up to date."""
    Base.metadata.create_all(bind=engine)
    try:
        with engine.connect() as conn:
            if engine.dialect.name == "sqlite":
                res = conn.exec_driver_sql("PRAGMA table_info(appointments);")
                cols = [row[1] for row in res.fetchall()]
                if "transcript" not in cols:
                    conn.exec_driver_sql("ALTER TABLE appointments ADD COLUMN transcript TEXT;")
                    conn.commit()
            elif engine.dialect.name == "postgresql":
                res = conn.exec_driver_sql(
                    "SELECT column_name FROM information_schema.columns WHERE table_name='appointments';"
                )
                cols = [row[0] for row in res.fetchall()]
                if "transcript" not in cols:
                    conn.exec_driver_sql("ALTER TABLE appointments ADD COLUMN transcript TEXT;")
                    conn.commit()
    except Exception as e:
        print(f"Schema check error: {e}")


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that provides a database session and ensures it closes after request."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
