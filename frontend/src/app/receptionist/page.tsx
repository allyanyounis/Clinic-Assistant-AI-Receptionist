"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, CalendarPlus, CalendarClock, Clock } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { AIReceptionist, CallStatus } from "@/components/AIReceptionist";
import { API_BASE_URL } from "@/config";
import { Appointment, ClinicSettings } from "@/types";
import { toDateKey } from "@/lib/appointmentStats";

const formatHour12 = (hour: number) => `${hour % 12 || 12}:00 ${hour < 12 ? "AM" : "PM"}`;

const STATUS_BADGE: Record<CallStatus, { label: string; className: string; note: string }> = {
    idle: { label: "Ready", className: "bg-green-100 text-green-700", note: "Agent configured" },
    connecting: { label: "Connecting", className: "bg-amber-100 text-amber-700", note: "Starting the call" },
    active: { label: "On a call", className: "bg-[#fde8ea] text-[#8B2635]", note: "Talking to a patient" },
};

function StatCard({ title, icon: Icon, children, note }: {
    title: string; icon: React.ElementType; children: React.ReactNode; note: string;
}) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between text-gray-600 mb-3">
                <span className="text-sm font-medium">{title}</span>
                <Icon className="w-4 h-4 text-gray-400" />
            </div>
            {children}
            <p className="text-xs text-gray-400 mt-1">{note}</p>
        </div>
    );
}

async function loadReceptionistData(): Promise<{ appointments: Appointment[]; settings: ClinicSettings }> {
    const headers = { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" };
    const [apptRes, settingsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/list_appointments/?cb=1`, { method: "POST", headers, body: JSON.stringify({}) }),
        fetch(`${API_BASE_URL}/settings/?cb=1`, { headers }),
    ]);
    const apptData = await apptRes.json();
    return {
        appointments: Array.isArray(apptData) ? apptData : (apptData.appointments || []),
        settings: await settingsRes.json(),
    };
}

export default function ReceptionistPage() {
    const [callStatus, setCallStatus] = useState<CallStatus>("idle");
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [settings, setSettings] = useState<ClinicSettings | null>(null);

    const fetchData = useCallback(() => {
        loadReceptionistData()
            .then(({ appointments, settings }) => {
                setAppointments(appointments);
                setSettings(settings);
            })
            .catch((error) => console.error("Failed to fetch receptionist data:", error));
    }, []);

    useEffect(fetchData, [fetchData]);

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

    return (
        <div className="flex min-h-screen bg-[#f0f2f5] font-sans">
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
                            title="Clinic Hours"
                            icon={Clock}
                            note={settings ? `${settings.slot_duration_minutes}-minute slots` : "Loading schedule..."}
                        >
                            <p className="text-lg font-bold text-gray-800">
                                {settings ? `${formatHour12(settings.start_hour)} – ${formatHour12(settings.end_hour)}` : "—"}
                            </p>
                        </StatCard>
                    </div>

                    <AIReceptionist onStatusChange={handleStatusChange} />
                </main>
            </div>
        </div>
    );
}
