"use client";

import { useEffect, useState, useCallback } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Calendar, Clock, User, Stethoscope, Search, RefreshCw, BellRing, X, ArrowDownUp, MessageSquareText, Bot } from "lucide-react";
import { API_BASE_URL } from "@/config";
import { Appointment } from "@/types";
import { toDateKey } from "@/lib/appointmentStats";

type Tab = "upcoming" | "today" | "past" | "cancelled" | "all";
type SortMode = "time" | "booked";

const TABS: { key: Tab; label: string }[] = [
    { key: "upcoming", label: "Upcoming" },
    { key: "today", label: "Today" },
    { key: "past", label: "Past" },
    { key: "cancelled", label: "Cancelled" },
    { key: "all", label: "All" },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const NEW_BOOKING_MS = DAY_MS;

const startOfDay = (d: Date) => {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
};

/** Whole calendar days from today to the given date (negative = past). */
const dayOffset = (date: Date, now: Date) =>
    Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / DAY_MS);

const relativeDay = (date: Date, now: Date) => {
    const diff = dayOffset(date, now);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
    return diff > 0 ? `In ${diff} days` : `${-diff} days ago`;
};

const dayHeading = (date: Date, now: Date) => {
    const label = date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    const diff = dayOffset(date, now);
    if (diff === 0) return `Today · ${label}`;
    if (diff === 1) return `Tomorrow · ${label}`;
    if (diff === -1) return `Yesterday · ${label}`;
    return label;
};

const countdown = (target: Date, now: Date) => {
    const mins = Math.max(0, Math.round((target.getTime() - now.getTime()) / 60000));
    if (mins < 1) return "starting now";
    if (mins < 60) return `in ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `in ${hours}h ${mins % 60}m`;
    const days = Math.floor(hours / 24);
    return `in ${days}d ${hours % 24}h`;
};

const formatTime = (d: Date) => d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
const formatDate = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

function statusOf(appt: Appointment, now: Date) {
    const start = new Date(appt.start_time);
    if (appt.canceled) return { label: "Cancelled", className: "bg-red-100 text-red-600" };
    if (start < now) return { label: "Past", className: "bg-gray-100 text-gray-500" };
    if (dayOffset(start, now) === 0) return { label: "Today", className: "bg-green-100 text-green-700" };
    return { label: "Upcoming", className: "bg-blue-100 text-blue-700" };
}

function AppointmentRow({ appt, index, now, onViewTranscript }: {
    appt: Appointment; index: number; now: Date; onViewTranscript: (appt: Appointment) => void;
}) {
    const start = new Date(appt.start_time);
    const created = new Date(appt.created_at);
    const status = statusOf(appt, now);
    const isNew = now.getTime() - created.getTime() < NEW_BOOKING_MS;
    const muted = appt.canceled || start < now;

    return (
        <tr className={`hover:bg-gray-50 transition-colors ${muted ? "opacity-60" : ""}`}>
            <td className="px-6 py-4 text-center font-medium text-gray-400 w-12">{index + 1}</td>
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#fde8ea] flex items-center justify-center text-[#8B2635] shrink-0">
                        <User className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="font-semibold text-gray-800 flex items-center gap-2">
                            {appt.patient_name}
                            {isNew && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold uppercase">
                                    New
                                </span>
                            )}
                        </p>
                        <p className="text-xs text-gray-400">ID #{appt.id}</p>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4 text-gray-600">
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <div>
                        <p>{formatDate(start)}</p>
                        <p className="text-xs text-gray-400">{relativeDay(start, now)}</p>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4 text-gray-600">
                <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className={appt.canceled ? "line-through" : ""}>{formatTime(start)}</span>
                </div>
            </td>
            <td className="px-6 py-4 text-gray-600">
                <div className="flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-gray-400" />
                    {appt.reason || "General Checkup"}
                </div>
            </td>
            <td className="px-6 py-4 text-gray-500 text-xs">
                {formatDate(created)}, {formatTime(created)}
            </td>
            <td className="px-6 py-4">
                {appt.transcript ? (
                    <button
                        onClick={() => onViewTranscript(appt)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-[#8B2635] bg-[#fde8ea] hover:bg-[#f9d2d7] transition-colors"
                    >
                        <MessageSquareText className="w-3.5 h-3.5" />
                        View
                    </button>
                ) : (
                    <span className="text-xs text-gray-300">No transcript</span>
                )}
            </td>
            <td className="px-6 py-4 text-right">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.className}`}>
                    {status.label}
                </span>
            </td>
        </tr>
    );
}

export default function AppointmentsPage() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [tab, setTab] = useState<Tab>("upcoming");
    const [sortMode, setSortMode] = useState<SortMode>("time");
    const [now, setNow] = useState(() => new Date());
    const [transcriptAppt, setTranscriptAppt] = useState<Appointment | null>(null);

    // Tick every minute so countdowns and Past/Upcoming status stay current
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const fetchAppointments = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/list_appointments/?cb=1`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "ngrok-skip-browser-warning": "true",
                },
                body: JSON.stringify({}),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            setAppointments(Array.isArray(data) ? data : (data.appointments || []));
            setLastUpdated(new Date());
            setNow(new Date());
        } catch (error) {
            console.error("Failed to fetch appointments:", error);
            setAppointments([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAppointments();
    }, [fetchAppointments]);

    const handleDateChange = (value: string) => {
        setSelectedDate(value);
        // A specific date may be in the past, so show every status for it
        if (value) setTab("all");
    };

    // Search + date picker apply before tab filtering, so tab counts reflect them
    const query = search.trim().toLowerCase();
    const searched = appointments.filter((a) => {
        const matchesSearch = a.patient_name.toLowerCase().includes(query) ||
            (a.reason ?? "").toLowerCase().includes(query);
        const matchesDate = !selectedDate || toDateKey(new Date(a.start_time)) === selectedDate;
        return matchesSearch && matchesDate;
    });

    const inTab = (a: Appointment, t: Tab) => {
        const start = new Date(a.start_time);
        switch (t) {
            case "upcoming": return !a.canceled && start >= now;
            case "today": return !a.canceled && dayOffset(start, now) === 0;
            case "past": return !a.canceled && start < now;
            case "cancelled": return a.canceled;
            case "all": return true;
        }
    };

    const counts = Object.fromEntries(
        TABS.map(({ key }) => [key, searched.filter((a) => inTab(a, key)).length])
    ) as Record<Tab, number>;

    const startMs = (a: Appointment) => new Date(a.start_time).getTime();
    const visible = searched.filter((a) => inTab(a, tab)).sort((a, b) => {
        if (sortMode === "booked") {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        // Upcoming and today read soonest-first; past, cancelled and all read latest-first
        return tab === "upcoming" || tab === "today" ? startMs(a) - startMs(b) : startMs(b) - startMs(a);
    });

    // Group by appointment day when sorting by time; one flat group when sorting by booking time
    const groups: { heading: string | null; items: Appointment[] }[] = [];
    for (const appt of visible) {
        const heading = sortMode === "time" ? dayHeading(new Date(appt.start_time), now) : null;
        const last = groups[groups.length - 1];
        if (last && last.heading === heading) last.items.push(appt);
        else groups.push({ heading, items: [appt] });
    }

    const nextUp = appointments
        .filter((a) => !a.canceled && new Date(a.start_time) >= now)
        .sort((a, b) => startMs(a) - startMs(b))[0];

    let rowNumber = 0;

    return (
        <div className="flex min-h-screen bg-[#f0f2f5] font-sans">
            <Sidebar />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header />

                <main className="flex-1 overflow-auto p-6">
                    {/* Page Header */}
                    <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800">Appointments</h2>
                            <div className="flex items-center gap-3 mt-1">
                                <p className="text-gray-500 text-sm">Upcoming visits first, so you always know who is next.</p>
                                {lastUpdated && (
                                    <span className="text-xs text-gray-400">
                                        Updated: {lastUpdated.toLocaleTimeString()}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => handleDateChange(e.target.value)}
                                    className="text-sm text-gray-700 outline-none bg-transparent"
                                />
                                {selectedDate && (
                                    <button onClick={() => handleDateChange("")} title="Clear date" className="text-gray-400 hover:text-gray-700">
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            <button
                                onClick={fetchAppointments}
                                disabled={loading}
                                className="flex items-center gap-2 bg-[#8B2635] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#9C3241] transition-colors disabled:opacity-50"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                                Refresh
                            </button>
                        </div>
                    </div>

                    {/* Next Up */}
                    {nextUp ? (
                        <div className="mb-6 bg-gradient-to-r from-[#8B2635] to-[#6B1925] text-white rounded-xl shadow-md p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                                    <BellRing className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-wider text-white/70 font-semibold">Next Up</p>
                                    <p className="text-xl font-bold">{nextUp.patient_name}</p>
                                    <p className="text-sm text-white/80">{nextUp.reason || "General Checkup"}</p>
                                </div>
                            </div>
                            <div className="sm:text-right">
                                <p className="text-lg font-semibold">
                                    {relativeDay(new Date(nextUp.start_time), now)} · {formatTime(new Date(nextUp.start_time))}
                                </p>
                                <p className="text-sm text-white/80">
                                    {formatDate(new Date(nextUp.start_time))} · {countdown(new Date(nextUp.start_time), now)}
                                </p>
                            </div>
                        </div>
                    ) : (
                        !loading && (
                            <div className="mb-6 bg-white border border-dashed border-gray-300 rounded-xl p-5 text-sm text-gray-500">
                                No upcoming appointments. New bookings from the AI receptionist will appear here.
                            </div>
                        )
                    )}

                    {/* Tabs + search + sort */}
                    <div className="mb-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div className="flex flex-wrap gap-2">
                            {TABS.map(({ key, label }) => (
                                <button
                                    key={key}
                                    onClick={() => setTab(key)}
                                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${tab === key
                                        ? "bg-[#8B2635] text-white shadow-sm"
                                        : "bg-white text-gray-600 border border-gray-200 hover:border-[#8B2635] hover:text-[#8B2635]"
                                        }`}
                                >
                                    {label}
                                    <span className={`ml-2 text-xs ${tab === key ? "text-white/80" : "text-gray-400"}`}>
                                        {counts[key]}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-4 py-2 shadow-sm w-full sm:w-72">
                                <Search className="w-4 h-4 text-gray-400 shrink-0" />
                                <input
                                    type="text"
                                    placeholder="Search by patient or reason..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="text-sm text-gray-700 outline-none w-full bg-transparent"
                                />
                            </div>
                            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
                                <ArrowDownUp className="w-4 h-4 text-gray-400" />
                                <select
                                    value={sortMode}
                                    onChange={(e) => setSortMode(e.target.value as SortMode)}
                                    className="text-sm text-gray-700 outline-none bg-transparent cursor-pointer"
                                >
                                    <option value="time">By appointment time</option>
                                    <option value="booked">Latest booked first</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-[#fafafa] text-gray-600 text-xs uppercase font-semibold">
                                    <tr>
                                        <th className="px-6 py-4 w-12 text-center">#</th>
                                        <th className="px-6 py-4">Patient</th>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Time</th>
                                        <th className="px-6 py-4">Reason / Disease</th>
                                        <th className="px-6 py-4">Booked At</th>
                                        <th className="px-6 py-4">Transcript</th>
                                        <th className="px-6 py-4 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-10 text-center text-gray-400">
                                                <RefreshCw className="w-5 h-5 animate-spin inline-block mr-2" />
                                                Loading appointments...
                                            </td>
                                        </tr>
                                    ) : visible.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-10 text-center text-gray-400 italic">
                                                {selectedDate
                                                    ? `No appointments found for ${selectedDate}.`
                                                    : `No ${tab === "all" ? "" : TABS.find(t => t.key === tab)?.label.toLowerCase() + " "}appointments.`}
                                            </td>
                                        </tr>
                                    ) : (
                                        groups.map((group, gi) => (
                                            <GroupRows key={group.heading ?? gi} heading={group.heading} count={group.items.length}>
                                                {group.items.map((appt) => (
                                                    <AppointmentRow key={appt.id} appt={appt} index={rowNumber++} now={now} onViewTranscript={setTranscriptAppt} />
                                                ))}
                                            </GroupRows>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center text-sm text-gray-500">
                            <span>
                                Showing <strong>{visible.length}</strong> of <strong>{appointments.length}</strong> appointments
                            </span>
                            <span className="text-xs text-gray-400">
                                {selectedDate ? `Filtered by ${selectedDate}` : sortMode === "booked" ? "Latest bookings first" : "Grouped by day"}
                            </span>
                        </div>
                    </div>
                </main>
            </div>

            {transcriptAppt && (
                <TranscriptModal appt={transcriptAppt} onClose={() => setTranscriptAppt(null)} />
            )}
        </div>
    );
}

/** Split a stored "AI: ... / User: ..." transcript into chat turns (unprefixed lines continue the previous turn). */
function parseTranscript(text: string) {
    const turns: { role: "ai" | "user"; text: string }[] = [];
    for (const raw of text.split("\n")) {
        const line = raw.trim();
        if (!line) continue;
        const match = line.match(/^(AI|Assistant|Bot|User|Customer)\s*:\s*(.*)$/i);
        if (match) {
            turns.push({ role: /^(user|customer)$/i.test(match[1]) ? "user" : "ai", text: match[2] });
        } else if (turns.length) {
            turns[turns.length - 1].text += " " + line;
        } else {
            turns.push({ role: "ai", text: line });
        }
    }
    return turns;
}

function TranscriptModal({ appt, onClose }: { appt: Appointment; onClose: () => void }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const start = new Date(appt.start_time);
    const turns = parseTranscript(appt.transcript ?? "");

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">Call Transcript</h3>
                        <p className="text-sm text-gray-500">
                            {appt.patient_name} · {formatDate(start)} at {formatTime(start)} · {appt.reason || "General Checkup"}
                        </p>
                    </div>
                    <button onClick={onClose} title="Close" className="text-gray-400 hover:text-gray-700 p-1">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-50 px-6 py-4 space-y-3 text-sm">
                    {turns.map((turn, i) => (
                        <div key={i} className={`flex gap-2 ${turn.role === "user" ? "justify-end" : "justify-start"}`}>
                            {turn.role === "ai" && <Bot className="w-4 h-4 text-[#8B2635] mt-1 shrink-0" />}
                            <div
                                className={`px-3 py-2 rounded-xl max-w-[80%] ${turn.role === "user"
                                    ? "bg-[#8B2635] text-white rounded-br-none"
                                    : "bg-white text-slate-800 border border-slate-200 rounded-bl-none shadow-sm"
                                    }`}
                            >
                                {turn.text}
                            </div>
                            {turn.role === "user" && <User className="w-4 h-4 text-slate-400 mt-1 shrink-0" />}
                        </div>
                    ))}
                </div>

                <div className="px-6 py-3 border-t border-gray-100 text-xs text-gray-400 flex justify-between">
                    <span>Steven Smith (AI) on the left · Patient on the right</span>
                    <span>{turns.length} messages</span>
                </div>
            </div>
        </div>
    );
}

function GroupRows({ heading, count, children }: { heading: string | null; count: number; children: React.ReactNode }) {
    return (
        <>
            {heading && (
                <tr className="bg-[#fdf6f7]">
                    <td colSpan={8} className="px-6 py-2 text-xs font-semibold text-[#8B2635] uppercase tracking-wide">
                        {heading}
                        <span className="ml-2 text-gray-400 normal-case font-normal">
                            {count} appointment{count === 1 ? "" : "s"}
                        </span>
                    </td>
                </tr>
            )}
            {children}
        </>
    );
}
