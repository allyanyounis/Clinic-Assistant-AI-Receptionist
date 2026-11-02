"use client";

import { useCallback, useRef, useState } from "react";
import { Bot, CalendarPlus, CalendarClock, Clock } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { AIReceptionist, CallStatus } from "@/components/AIReceptionist";
import { toDateKey } from "@/lib/appointmentStats";
import { useReceptionistData } from "@/hooks/useReceptionistData";

/** "13:30" -> "1:30 PM" */
const formatTime12 = (hhmm: string) => {
    const hour = parseInt(hhmm.slice(0, 2));
    return `${hour % 12 || 12}:${hhmm.slice(3, 5)} ${hour < 12 ? "AM" : "PM"}`;
};

const STATUS_BADGE: Record<CallStatus, { label: string; className: string; note: string }> = {
    idle: { label: "Ready", className: "bg-green-100 text-green-700", note: "Agent configured" },
    connecting: { label: "Connecting", className: "bg-amber-100 text-amber-700", note: "Starting the call" },
    active: { label: "On a call", className: "bg-brand-100 text-brand-700", note: "Talking to a patient" },
};

function StatCard({ title, icon: Icon, children, note }: {
    title: string; icon: React.ElementType; children: React.ReactNode; note: string;
}) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 card-hover">
            <div className="flex items-center justify-between text-gray-600 mb-3">
                <span className="text-sm font-medium">{title}</span>
                <Icon className="w-4 h-4 text-gray-400" />
            </div>
            {children}
            <p className="text-xs text-gray-400 mt-1">{note}</p>
        </div>
    );
}

export default function ReceptionistPage() {
    const [callStatus, setCallStatus] = useState<CallStatus>("idle");
    const { appointments, settings, fetchData } = useReceptionistData();

    // Refresh the numbers when a call ends, since the agent may have just booked an appointment
    const prevStatus = useRef<CallStatus>("idle");
    const handleStatusChange = useCallback((status: CallStatus) => {
        if (prevStatus.current === "active" && status === "idle") setTimeout(fetchData, 1500);
        prevStatus.current = status;
        setCallStatus(status);
    }, [fetchData]);

    const now = new Date();
    const todayKey = toDateKey(now);
    const bookedToday = appointments.filter((a) => toDateKey(new Date(a.created_at)) === todayKey).length;
    const upcoming = appointments.filter((a) => !a.canceled && new Date(a.start_time) >= now).length;
    const badge = STATUS_BADGE[callStatus];
    const todaySchedule = settings?.weekly_schedule?.[(now.getDay() + 6) % 7];

    return (
        <div className="flex min-h-screen bg-surface font-sans">
            <Sidebar />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header title="AI Receptionist" />

                <main className="flex-1 overflow-auto p-6">
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-gray-800">AI Receptionist</h2>
                        <p className="text-gray-500 text-sm mt-1">
                            Talk to Steven Smith, your AI voice agent that books, checks and cancels appointments.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                        <StatCard title="Agent Status" icon={Bot} note={badge.note}>
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${badge.className}`}>
                                {badge.label}
                            </span>
                        </StatCard>
                        <StatCard title="Booked Today" icon={CalendarPlus} note="New appointments made today">
                            <p className="text-3xl font-bold text-gray-800">{bookedToday}</p>
                        </StatCard>
                        <StatCard title="Upcoming" icon={CalendarClock} note="Active appointments ahead">
                            <p className="text-3xl font-bold text-gray-800">{upcoming}</p>
                        </StatCard>
                        <StatCard
                            title="Today's Hours"
                            icon={Clock}
                            note={settings ? `${settings.slot_duration_minutes}-minute slots` : "Loading schedule..."}
                        >
                            <p className="text-lg font-bold text-gray-800">
                                {!todaySchedule ? "—" : todaySchedule.enabled
                                    ? `${formatTime12(todaySchedule.start)} – ${formatTime12(todaySchedule.end)}`
                                    : "Day off"}
                            </p>
                        </StatCard>
                    </div>

                    <AIReceptionist onStatusChange={handleStatusChange} />
                </main>
            </div>
        </div>
    );
}
