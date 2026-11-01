/**
 * Derived dashboard metrics computed from the raw appointment list.
 * Backend timestamps are naive Pakistan Time strings, parsed as local time.
 */
import { Appointment } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export const toDateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const startOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
};

const countCreatedBetween = (appointments: Appointment[], from: Date, to: Date) =>
    appointments.filter(a => {
        const created = new Date(a.created_at);
        return created >= from && created < to;
    }).length;

export interface Trend {
    current: number;
    previous: number;
    /** Percentage change, or null when there is no previous baseline. */
    percent: number | null;
}

const trend = (current: number, previous: number): Trend => ({
    current,
    previous,
    percent: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null,
});

/** Bookings made today vs yesterday (by created_at). */
export function dayTrend(appointments: Appointment[]): Trend {
    const today = startOfToday();
    const yesterday = new Date(today.getTime() - DAY_MS);
    const tomorrow = new Date(today.getTime() + DAY_MS);
    return trend(
        countCreatedBetween(appointments, today, tomorrow),
        countCreatedBetween(appointments, yesterday, today)
    );
}

/** Bookings made in the last 7 days vs the 7 days before that (by created_at). */
export function weekTrend(appointments: Appointment[]): Trend {
    const tomorrow = new Date(startOfToday().getTime() + DAY_MS);
    const weekAgo = new Date(tomorrow.getTime() - 7 * DAY_MS);
    const twoWeeksAgo = new Date(tomorrow.getTime() - 14 * DAY_MS);
    return trend(
        countCreatedBetween(appointments, weekAgo, tomorrow),
        countCreatedBetween(appointments, twoWeeksAgo, weekAgo)
    );
}

/** Active (non-canceled) appointments scheduled for today. */
export function todaysActiveCount(appointments: Appointment[]): number {
    const todayKey = toDateKey(new Date());
    return appointments.filter(a => !a.canceled && toDateKey(new Date(a.start_time)) === todayKey).length;
}

/** Canceled appointments per appointment day over the next `days` days, starting today. */
export function cancellationsByDay(appointments: Appointment[], days = 10) {
    const today = startOfToday();
    return Array.from({ length: days }, (_, i) => {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const key = toDateKey(date);
        return {
            name: `${date.toLocaleString("default", { weekday: "short" })} ${date.getDate()}`,
            count: appointments.filter(a => a.canceled && toDateKey(new Date(a.start_time)) === key).length,
        };
    });
}

/** Top visit reasons among active appointments, most frequent first. */
export function topReasons(appointments: Appointment[], limit = 5) {
    const counts = new Map<string, { title: string; count: number }>();
    for (const a of appointments) {
        if (a.canceled) continue;
        const raw = (a.reason || "General Consultation").trim();
        const key = raw.toLowerCase();
        const entry = counts.get(key);
        if (entry) {
            entry.count++;
        } else {
            const title = raw.replace(/\b\w/g, c => c.toUpperCase());
            counts.set(key, { title, count: 1 });
        }
    }
    return [...counts.values()]
        .sort((x, y) => y.count - x.count || x.title.localeCompare(y.title))
        .slice(0, limit)
        .map((item, i) => ({ rank: i + 1, ...item }));
}

/** Appointments booked after the given moment. */
export function bookedSince(appointments: Appointment[], since: Date): number {
    return appointments.filter(a => new Date(a.created_at) > since).length;
}
