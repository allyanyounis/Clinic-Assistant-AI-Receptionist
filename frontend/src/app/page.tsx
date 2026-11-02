"use client";

import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { TopSummaryCards } from "@/components/TopSummaryCards";
import { MainChartArea } from "@/components/MainChartArea";
import { bookedSince } from "@/lib/appointmentStats";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useNotifications } from "@/hooks/useNotifications";

export default function Dashboard() {
    const { appointments, holidays, workingDays } = useDashboardData();
    const { notificationsSeenAt, markNotificationsSeen } = useNotifications();

    const newBookings = bookedSince(appointments, notificationsSeenAt);

    return (
        <div className="flex min-h-screen bg-surface font-sans">

            {/* Sidebar */}
            <Sidebar />

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

                <Header notificationCount={newBookings} onNotificationsClick={markNotificationsSeen} />

                <main className="flex-1 overflow-auto p-6">

                    <TopSummaryCards appointments={appointments} />

                    <div className="mt-6">
                        <MainChartArea appointments={appointments} holidays={holidays} workingDays={workingDays} />
                    </div>

                </main>
            </div>
        </div>
    );
}
