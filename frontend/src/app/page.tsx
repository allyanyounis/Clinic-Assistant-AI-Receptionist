"use client";

import { useEffect, useState, useCallback } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { TopSummaryCards } from "@/components/TopSummaryCards";
import { MainChartArea } from "@/components/MainChartArea";
import { VoiceDialer } from "@/components/VoiceDialer";
import { API_BASE_URL } from "@/config";
import { Appointment } from "@/types";

export default function Dashboard() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [holidays, setHolidays] = useState<string[]>([]);
    const [workingDays, setWorkingDays] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchAppointments = useCallback(async () => {
        console.log('Dashboard: Fetching appointments for today');
        setLoading(true);
        try {
            // Fetch Settings first to get holidays
            const settingsRes = await fetch(`${API_BASE_URL}/settings/?cb=1`, {
                headers: { "ngrok-skip-browser-warning": "true" }
            });
            const settingsData = await settingsRes.json();
            if (settingsData.holidays) {
                setHolidays(settingsData.holidays.split(',').map((h: string) => h.trim()));
            }
            if (settingsData.working_days) {
                setWorkingDays(settingsData.working_days.split(',').map((d: string) => parseInt(d.trim())));
            }

            const today = new Date().toLocaleDateString('en-CA');
            console.log(`Dashboard: Today's date = ${today}`);
            const response = await fetch(`${API_BASE_URL}/list_appointments/?cb=1`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "ngrok-skip-browser-warning": "true",
                },
                body: JSON.stringify({}),
            });
            const data = await response.json();
            console.log(`Dashboard: Received ${data.length} appointments:`, data);
            setAppointments(Array.isArray(data) ? data : (data.appointments || []));
            setLastUpdated(new Date());
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial fetch on mount
    useEffect(() => {
        fetchAppointments();
    }, [fetchAppointments]);

    const totalCanceled = appointments.filter(a => a.canceled).length;

    return (
        <div className="flex min-h-screen bg-[#f0f2f5] font-sans">

            {/* Sidebar */}
            <Sidebar />

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

                <Header />

                <main className="flex-1 overflow-auto p-6">

                    <TopSummaryCards
                        totalAppointments={appointments.length}
                        totalCanceled={totalCanceled}
                    />

                    <div className="flex gap-6 mt-6 items-start flex-wrap">
                        <div className="flex-1 min-w-0">
                            <MainChartArea appointments={appointments} holidays={holidays} workingDays={workingDays} />
                        </div>
                        <div className="shrink-0 w-full max-w-sm">
                            <VoiceDialer />
                        </div>
                    </div>

                </main>
            </div>
        </div>
    );
}
