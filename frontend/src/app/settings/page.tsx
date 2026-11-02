"use client";

import { useState } from "react";
import {
    AlertCircle, CalendarDays, CalendarOff, Check, Clock, Copy, ListChecks, Plus, Sun, X,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { DaySchedule } from "@/types";
import { toDateKey } from "@/lib/appointmentStats";
import { Draft, useScheduleSettings } from "@/hooks/useScheduleSettings";
import { useNow } from "@/hooks/useNow";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SLOT_OPTIONS = [15, 30, 45, 60];

// --- Time helpers ("HH:MM" <-> minutes since midnight) ---
const toMin = (t: string) => parseInt(t.slice(0, 2)) * 60 + parseInt(t.slice(3, 5));
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const formatHours = (minutes: number) => {
    const h = minutes / 60;
    return `${Number.isInteger(h) ? h : h.toFixed(1)}h`;
};
const todayIndex = (date: Date) => (date.getDay() + 6) % 7; // Monday = 0

/** Minutes the doctor actually works on a day (breaks excluded). */
function workMinutes(day: DaySchedule) {
    if (!day.enabled) return 0;
    const breaks = day.breaks.reduce((sum, b) => sum + Math.max(0, toMin(b.end) - toMin(b.start)), 0);
    return Math.max(0, toMin(day.end) - toMin(day.start) - breaks);
}

/** Same rule as the backend: slots run from opening, restart after each break, and must finish in time. */
function slotCount(day: DaySchedule, slotMinutes: number) {
    if (!day.enabled || dayError(day)) return 0;
    const edges = [toMin(day.start)];
    [...day.breaks].sort((a, b) => toMin(a.start) - toMin(b.start)).forEach((b) => edges.push(toMin(b.start), toMin(b.end)));
    edges.push(toMin(day.end));
    let count = 0;
    for (let i = 0; i < edges.length; i += 2) count += Math.max(0, Math.floor((edges[i + 1] - edges[i]) / slotMinutes));
    return count;
}

function dayError(day: DaySchedule): string | null {
    if (!day.enabled) return null;
    if (toMin(day.end) <= toMin(day.start)) return "Finish time must be after start time.";
    let previousEnd = toMin(day.start);
    for (const b of [...day.breaks].sort((a, c) => toMin(a.start) - toMin(c.start))) {
        if (toMin(b.end) <= toMin(b.start)) return "A break must end after it starts.";
        if (toMin(b.start) < previousEnd || toMin(b.end) > toMin(day.end)) {
            return "Breaks must be inside working hours and must not overlap.";
        }
        previousEnd = toMin(b.end);
    }
    return null;
}

/** First free hour for a new break: lunch at 1 PM if it fits, otherwise the first gap in the day. */
function suggestBreak(day: DaySchedule) {
    const start = toMin(day.start), end = toMin(day.end);
    const length = end - start >= 180 ? 60 : 30;
    const fits = (s: number) => s >= start && s + length <= end &&
        day.breaks.every((b) => s + length <= toMin(b.start) || s >= toMin(b.end));
    const candidates = [13 * 60, ...Array.from({ length: Math.ceil((end - start) / 30) }, (_, i) => start + 30 * (i + 1))];
    const found = candidates.find(fits);
    return found === undefined ? null : { start: toHHMM(found), end: toHHMM(found + length) };
}

const weekdays = (enabled: number[], start: string, end: string, lunch: boolean): DaySchedule[] =>
    DAYS.map((_, i) => ({
        enabled: enabled.includes(i), start, end,
        breaks: lunch ? [{ start: "13:00", end: "14:00" }] : [],
    }));

const PRESETS = [
    { label: "9–5 with lunch", schedule: () => weekdays([0, 1, 2, 3, 4], "09:00", "17:00", true) },
    { label: "8–6 with lunch", schedule: () => weekdays([0, 1, 2, 3, 4], "08:00", "18:00", true) },
    { label: "Mornings", schedule: () => weekdays([0, 1, 2, 3, 4, 5], "08:00", "13:00", false) },
];

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------
function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
    return (
        <button
            type="button" role="switch" aria-checked={on} aria-label={label} onClick={onChange}
            className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${on ? "bg-brand-700" : "bg-slate-300"}`}
        >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : ""}`} />
        </button>
    );
}

function TimeInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
    return (
        <input
            type="time" value={value} aria-label={label}
            onChange={(e) => e.target.value && onChange(e.target.value)}
            className="w-[7.5rem] px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700"
        />
    );
}

function StatCard({ icon: Icon, value, label, highlight = false }: {
    icon: React.ElementType; value: string; label: string; highlight?: boolean;
}) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3 card-hover">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${highlight ? "bg-amber-400 text-white" : "bg-brand-50 text-brand-700"}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
                <p className="text-xl font-bold text-slate-800 truncate">{value}</p>
                <p className="text-xs text-slate-500 truncate">{label}</p>
            </div>
        </div>
    );
}

function DayRow({ index, day, isToday, onChange, onCopy }: {
    index: number; day: DaySchedule; isToday: boolean;
    onChange: (day: DaySchedule) => void; onCopy: () => void;
}) {
    const error = dayError(day);
    const suggestion = day.enabled ? suggestBreak(day) : null;
    const name = DAYS[index];
    const setBreak = (i: number, field: "start" | "end", value: string) =>
        onChange({ ...day, breaks: day.breaks.map((b, j) => (j === i ? { ...b, [field]: value } : b)) });

    return (
        <div className={`px-5 py-3 border-t border-slate-100 ${isToday ? "bg-amber-50/50" : ""}`}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Toggle on={day.enabled} label={`${name} working`} onChange={() => onChange({ ...day, enabled: !day.enabled })} />
                <div className="w-32 flex items-center gap-2">
                    <span className={`text-sm font-semibold ${day.enabled ? "text-slate-800" : "text-slate-400"}`}>{name}</span>
                    {isToday && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400 text-white">TODAY</span>}
                </div>

                {day.enabled ? (
                    <>
                        <div className="flex items-center gap-2">
                            <TimeInput value={day.start} label={`${name} start`} onChange={(start) => onChange({ ...day, start })} />
                            <span className="text-slate-400">–</span>
                            <TimeInput value={day.end} label={`${name} finish`} onChange={(end) => onChange({ ...day, end })} />
                        </div>
                        <button
                            type="button" disabled={!suggestion}
                            onClick={() => suggestion && onChange({ ...day, breaks: [...day.breaks, suggestion] })}
                            className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline disabled:text-slate-300 disabled:no-underline"
                        >
                            <Plus className="w-3.5 h-3.5" /> Add break
                        </button>
                        <div className="ml-auto flex items-center gap-3">
                            <span className="text-sm text-slate-600 w-12 text-right">{formatHours(workMinutes(day))}</span>
                            <button
                                type="button" onClick={onCopy} title="Copy these hours to all working days"
                                aria-label={`Copy ${name} hours to all working days`}
                                className="p-1.5 rounded-md text-slate-400 hover:text-brand-700 hover:bg-slate-100"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>
                    </>
                ) : (
                    <span className="text-sm text-slate-400">Day off</span>
                )}
            </div>

            {day.enabled && day.breaks.map((b, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 mt-2 sm:pl-[11.5rem]">
                    <span className="text-xs font-medium text-slate-500 w-10">Break</span>
                    <TimeInput value={b.start} label={`${name} break ${i + 1} start`} onChange={(v) => setBreak(i, "start", v)} />
                    <span className="text-slate-400">–</span>
                    <TimeInput value={b.end} label={`${name} break ${i + 1} end`} onChange={(v) => setBreak(i, "end", v)} />
                    <button
                        type="button" aria-label="Remove break"
                        onClick={() => onChange({ ...day, breaks: day.breaks.filter((_, j) => j !== i) })}
                        className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}

            {error && (
                <p className="mt-2 sm:pl-[11.5rem] text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {error}
                </p>
            )}
        </div>
    );
}

function WeekAtAGlance({ schedule, now }: { schedule: DaySchedule[]; now: Date }) {
    const enabled = schedule.filter((d) => d.enabled);
    const first = Math.min(6, ...enabled.map((d) => Math.floor(toMin(d.start) / 60)));
    const last = Math.max(22, ...enabled.map((d) => Math.ceil(toMin(d.end) / 60)));
    const span = (last - first) * 60;
    const pct = (minutes: number) => `${((minutes - first * 60) / span) * 100}%`;
    const ticks = Array.from({ length: Math.floor((last - first) / 2) + 1 }, (_, i) => first + i * 2);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const today = todayIndex(now);

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-800">Week at a glance</h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">Working time in maroon, breaks hatched. The amber line is now.</p>

            <div className="overflow-x-auto">
                <div className="min-w-[420px]">
                    <div className="relative h-4 ml-10 mr-12 mb-1">
                        {ticks.map((h) => (
                            <span key={h} className="absolute -translate-x-1/2 text-[10px] text-slate-400" style={{ left: pct(h * 60) }}>
                                {String(h).padStart(2, "0")}:00
                            </span>
                        ))}
                    </div>

                    {schedule.map((day, i) => (
                        <div key={DAYS[i]} className="flex items-center h-9">
                            <span className={`w-10 text-xs font-semibold ${i === today ? "text-amber-600" : "text-slate-500"}`}>
                                {DAYS[i].slice(0, 3)}
                            </span>
                            <div className="relative flex-1 h-6 rounded bg-slate-100 overflow-hidden">
                                {ticks.slice(1, -1).map((h) => (
                                    <span key={h} className="absolute top-0 bottom-0 w-px bg-white" style={{ left: pct(h * 60) }} />
                                ))}
                                {day.enabled && !dayError(day) ? (
                                    <>
                                        <div
                                            className="absolute top-0 bottom-0 bg-brand-700 rounded-sm"
                                            style={{ left: pct(toMin(day.start)), width: `${((toMin(day.end) - toMin(day.start)) / span) * 100}%` }}
                                        />
                                        {day.breaks.map((b, j) => (
                                            <div
                                                key={j} title={`Break ${b.start}–${b.end}`}
                                                className="absolute top-0 bottom-0 bg-brand-50"
                                                style={{
                                                    left: pct(toMin(b.start)),
                                                    width: `${((toMin(b.end) - toMin(b.start)) / span) * 100}%`,
                                                    backgroundImage: "repeating-linear-gradient(135deg, rgba(15,118,110,.45) 0 2px, transparent 2px 6px)",
                                                }}
                                            />
                                        ))}
                                    </>
                                ) : (
                                    <span className="absolute inset-0 flex items-center justify-center text-[11px] text-slate-400">
                                        {day.enabled ? "Fix hours" : "Day off"}
                                    </span>
                                )}
                                {i === today && nowMin >= first * 60 && nowMin <= last * 60 && (
                                    <span className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-amber-400" style={{ left: pct(nowMin) }} />
                                )}
                            </div>
                            <span className="w-12 text-right text-xs text-slate-600">
                                {day.enabled ? formatHours(workMinutes(day)) : "—"}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function ClosedDates({ holidays, onChange }: { holidays: string[]; onChange: (h: string[]) => void }) {
    const [newDate, setNewDate] = useState("");
    const todayKey = toDateKey(new Date());
    const add = () => {
        if (newDate && !holidays.includes(newDate)) onChange([...holidays, newDate].sort());
        setNewDate("");
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-800">Closed dates</h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-3">Holidays or leave. The AI receptionist won&apos;t book on these days.</p>
            <div className="flex gap-2 mb-3">
                <input
                    type="date" value={newDate} min={todayKey} aria-label="Closed date"
                    onChange={(e) => setNewDate(e.target.value)}
                    className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700"
                />
                <button
                    type="button" onClick={add} disabled={!newDate}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-brand-700 text-white hover:bg-brand-800 disabled:opacity-40"
                >
                    Add
                </button>
            </div>
            {holidays.length === 0 ? (
                <p className="text-xs text-slate-400">No closed dates.</p>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {holidays.map((h) => (
                        <span
                            key={h}
                            className={`flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-xs font-medium border ${h < todayKey ? "bg-slate-50 text-slate-400 border-slate-200" : "bg-brand-50 text-brand-700 border-brand-200"}`}
                        >
                            {new Date(`${h}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                            <button type="button" aria-label={`Remove ${h}`} onClick={() => onChange(holidays.filter((x) => x !== h))} className="p-0.5 rounded-full hover:bg-white">
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function SchedulerPage() {
    const { saved, draft, setDraft, isDefault, loadError, saving, notice, setNotice, handleSave } = useScheduleSettings();
    const [now] = useNow(60_000);

    if (!draft || !saved) {
        return (
            <div className="flex min-h-screen bg-surface font-sans">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0">
                    <Header title="Time Scheduling" />
                    <main className="p-6 text-sm text-slate-500">{loadError || "Loading your schedule..."}</main>
                </div>
            </div>
        );
    }

    const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
    const hasErrors = draft.schedule.some((d) => dayError(d));
    const today = todayIndex(now);
    const todaySchedule = draft.schedule[today];
    const weeklyMinutes = draft.schedule.reduce((sum, d) => sum + workMinutes(d), 0);
    const weeklySlots = draft.schedule.reduce((sum, d) => sum + slotCount(d, draft.slotMinutes), 0);

    const update = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
    const setDay = (i: number, day: DaySchedule) => update({ schedule: draft.schedule.map((d, j) => (j === i ? day : d)) });
    const copyToAll = (i: number) => {
        const source = draft.schedule[i];
        update({
            schedule: draft.schedule.map((d) => d.enabled
                ? { ...d, start: source.start, end: source.end, breaks: source.breaks.map((b) => ({ ...b })) }
                : d),
        });
    };

    return (
        <div className="flex min-h-screen bg-surface font-sans">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header title="Time Scheduling" />

                <main className="flex-1 overflow-auto p-6 space-y-5">
                    {/* Title + actions */}
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                <CalendarDays className="w-6 h-6 text-brand-700" /> Scheduler
                            </h2>
                            <p className="text-sm text-slate-500 mt-1">
                                Set the hours you work each week. The AI receptionist only books appointments inside these hours, never during breaks.
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button" disabled={!dirty || saving}
                                onClick={() => { setDraft(saved); setNotice(null); }}
                                className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                            >
                                Discard
                            </button>
                            <button
                                type="button" disabled={!dirty || hasErrors || saving} onClick={handleSave}
                                className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-700 text-white hover:bg-brand-800 disabled:opacity-40 flex items-center gap-1.5"
                            >
                                <Check className="w-4 h-4" /> {saving ? "Saving..." : "Save hours"}
                            </button>
                        </div>
                    </div>

                    {/* Banners */}
                    {isDefault && !dirty && (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            You&apos;re seeing the clinic default (same hours every working day). Adjust it to your own hours and save.
                        </div>
                    )}
                    {dirty && (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-brand-200 bg-brand-50 text-sm text-brand-700">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {hasErrors ? "Fix the highlighted days before saving." : "You have unsaved changes."}
                        </div>
                    )}
                    {notice && !dirty && (
                        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm ${notice.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"}`}>
                            {notice.ok ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                            {notice.text}
                        </div>
                    )}
                    {notice && !notice.ok && dirty && (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
                            <AlertCircle className="w-4 h-4 shrink-0" /> {notice.text}
                        </div>
                    )}

                    {/* Summary cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        <StatCard icon={Clock} value={formatHours(weeklyMinutes)} label="Hours per week" />
                        <StatCard icon={CalendarDays} value={`${draft.schedule.filter((d) => d.enabled).length} of 7`} label="Working days" />
                        <StatCard
                            icon={todaySchedule.enabled ? Sun : CalendarOff} highlight
                            value={todaySchedule.enabled ? `${todaySchedule.start}–${todaySchedule.end}` : "Day off"}
                            label={`Today · ${DAYS[today]}`}
                        />
                        <StatCard icon={ListChecks} value={String(weeklySlots)} label={`Appointment slots / week (${draft.slotMinutes} min)`} />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-5 items-start">
                        {/* Weekly hours editor */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-5">
                                <h3 className="text-sm font-semibold text-slate-800">Weekly hours</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Toggle a day off, set your start and finish, and add a break if you take one.</p>
                                <div className="flex flex-wrap items-center gap-2 mt-3">
                                    <span className="text-xs text-slate-500">Presets:</span>
                                    {PRESETS.map((p) => (
                                        <button
                                            key={p.label} type="button" onClick={() => update({ schedule: p.schedule() })}
                                            className="px-2.5 py-1 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:border-brand-700 hover:text-brand-700"
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {draft.schedule.map((day, i) => (
                                <DayRow
                                    key={DAYS[i]} index={i} day={day} isToday={i === today}
                                    onChange={(d) => setDay(i, d)} onCopy={() => copyToAll(i)}
                                />
                            ))}

                            <div className="px-5 py-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
                                <label htmlFor="slot-length" className="text-sm font-semibold text-slate-800">Appointment slot length</label>
                                <select
                                    id="slot-length" value={draft.slotMinutes}
                                    onChange={(e) => update({ slotMinutes: parseInt(e.target.value) })}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700"
                                >
                                    {SLOT_OPTIONS.map((m) => <option key={m} value={m}>{m} minutes</option>)}
                                </select>
                                <span className="text-xs text-slate-500">Patients can only book at these steps, counted from your start time and after each break.</span>
                            </div>
                        </div>

                        <div className="space-y-5">
                            <WeekAtAGlance schedule={draft.schedule} now={now} />
                            <ClosedDates holidays={draft.holidays} onChange={(holidays) => update({ holidays })} />
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
