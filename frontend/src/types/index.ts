/**
 * Data contracts and TypeScript type definitions for DocAssist AI Frontend.
 */

export interface Appointment {
    id: number;
    patient_name: string;
    reason: string | null;
    start_time: string;
    canceled: boolean;
    created_at: string;
    /** Call conversation as "AI: ..." / "User: ..." lines; null if not booked by a voice call. */
    transcript?: string | null;
}

export interface BreakPeriod {
    start: string; // "HH:MM"
    end: string;
}

export interface DaySchedule {
    enabled: boolean;
    start: string; // "HH:MM"
    end: string;
    breaks: BreakPeriod[];
}

export interface ClinicSettings {
    start_hour: number;
    end_hour: number;
    slot_duration_minutes: number;
    working_days: string;
    holidays: string;
    /** 7 entries, index 0 = Monday. */
    weekly_schedule: DaySchedule[];
    /** True until the doctor has saved per-day hours. */
    is_default_schedule: boolean;
}

export interface UserSession {
    name: string;
    email: string;
    isLoggedIn: boolean;
}
