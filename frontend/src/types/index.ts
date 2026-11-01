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

export interface ClinicSettings {
    start_hour: number;
    end_hour: number;
    slot_duration_minutes: number;
    working_days: string;
    holidays: string;
}

export interface UserSession {
    name: string;
    email: string;
    isLoggedIn: boolean;
}
