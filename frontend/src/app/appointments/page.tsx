"use client";

import { useEffect, useState, useCallback } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Calendar, Clock, User, Stethoscope, Search, RefreshCw } from "lucide-react";
import { API_BASE_URL } from "@/config";
import { Appointment } from "@/types";

export default function AppointmentsPage() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchAppointments = useCallback(async (date: string) => {
        console.log(`🔄 Fetching appointments for date: ${date}`);
        console.log(`🌐 API URL: ${API_BASE_URL}/list_appointments/`);
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
            console.log(`📡 Response status: ${response.status}`);
            console.log(`📡 Response headers:`, response.headers);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log(`✅ Received ${data.length} appointments:`, data);
            setAppointments(Array.isArray(data) ? data : (data.appointments || []));
            setLastUpdated(new Date());
        } catch (error) {
            console.error("❌ Failed to fetch appointments:", error);
            console.error("❌ Error details:", error instanceof Error ? error.message : String(error));
            setAppointments([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch on mount & whenever date changes
    useEffect(() => {
        fetchAppointments(selectedDate);
    }, [selectedDate, fetchAppointments]);

    const filtered = appointments.filter((a) => {
        const matchesSearch = a.patient_name.toLowerCase().includes(search.toLowerCase()) ||
            (a.reason ?? "").toLowerCase().includes(search.toLowerCase());
        
        let matchesDate = true;
        if (selectedDate) {
            // Compare the local date of the appointment with the selected date
            const apptDate = new Date(a.start_time);
            // Format to YYYY-MM-DD for comparison
            const apptDateStr = `${apptDate.getFullYear()}-${String(apptDate.getMonth() + 1).padStart(2, '0')}-${String(apptDate.getDate()).padStart(2, '0')}`;
            matchesDate = apptDateStr === selectedDate;
        }

        return matchesSearch && matchesDate;
    });

    return (
        <div className="flex min-h-screen bg-[#f0f2f5] font-sans">
            <Sidebar />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header />

                <main className="flex-1 overflow-auto p-6">
                    {/* Page Header */}
                    <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800">All Appointments</h2>
                            <div className="flex items-center gap-3 mt-1">
                                <p className="text-gray-500 text-sm">View and manage all appointments in the system.</p>
                                {lastUpdated && (
                                    <span className="text-xs text-gray-400">
                                        Updated: {lastUpdated.toLocaleTimeString()}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                            {/* Date picker */}
                            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="text-sm text-gray-700 outline-none bg-transparent"
                                />
                            </div>

                            {/* Refresh */}
                            <button
                                onClick={() => fetchAppointments(selectedDate)}
                                disabled={loading}
                                className="flex items-center gap-2 bg-[#8B2635] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#9C3241] transition-colors disabled:opacity-50"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                                Refresh
                            </button>
                        </div>
                    </div>

                    {/* Search bar */}
                    <div className="mb-4 flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-4 py-2 shadow-sm w-full sm:max-w-md">
                        <Search className="w-4 h-4 text-gray-400 shrink-0" />
                        <input
                            type="text"
                            placeholder="Search by patient or reason..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="text-sm text-gray-700 outline-none w-full bg-transparent"
                        />
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
                                        <th className="px-6 py-4 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-10 text-center text-gray-400">
                                                <RefreshCw className="w-5 h-5 animate-spin inline-block mr-2" />
                                                Loading appointments...
                                            </td>
                                        </tr>
                                    ) : filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-10 text-center text-gray-400 italic">
                                                {selectedDate ? `No appointments found for ${selectedDate}.` : "No appointments found."}
                                            </td>
                                        </tr>
                                    ) : (
                                        filtered.map((appt, index) => {
                                            const startObj = new Date(appt.start_time);
                                            const createdObj = new Date(appt.created_at);
                                            const dateStr = startObj.toLocaleDateString("en-US", {
                                                year: "numeric", month: "short", day: "numeric",
                                            });
                                            const timeStr = startObj.toLocaleTimeString("en-US", {
                                                hour: "2-digit", minute: "2-digit",
                                            });
                                            const bookedAt = createdObj.toLocaleString("en-US", {
                                                year: "numeric", month: "short", day: "numeric",
                                                hour: "2-digit", minute: "2-digit",
                                            });

                                            return (
                                                <tr key={appt.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4 text-center font-medium text-gray-400 w-12">
                                                        {index + 1}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-full bg-[#fde8ea] flex items-center justify-center text-[#8B2635] shrink-0">
                                                                <User className="w-4 h-4" />
                                                            </div>
                                                            <div>
                                                                <p className="font-semibold text-gray-800">{appt.patient_name}</p>
                                                                <p className="text-xs text-gray-400">ID #{appt.id}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-600">
                                                        <div className="flex items-center gap-2">
                                                            <Calendar className="w-4 h-4 text-gray-400" />
                                                            {dateStr}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-600">
                                                        <div className="flex items-center gap-2">
                                                            <Clock className="w-4 h-4 text-gray-400" />
                                                            {timeStr}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-600">
                                                        <div className="flex items-center gap-2">
                                                            <Stethoscope className="w-4 h-4 text-gray-400" />
                                                            {appt.reason || "General Checkup"}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-500 text-xs">
                                                        {bookedAt}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${appt.canceled
                                                            ? "bg-red-100 text-red-600"
                                                            : "bg-green-100 text-green-600"
                                                            }`}>
                                                            {appt.canceled ? "Cancelled" : "Confirmed"}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center text-sm text-gray-500">
                            <span>
                                Showing <strong>{filtered.length}</strong> of <strong>{appointments.length}</strong> appointments
                            </span>
                            <span className="text-xs text-gray-400">
                                {selectedDate ? `Filtered by ${selectedDate}` : "Showing all dates"}
                            </span>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
