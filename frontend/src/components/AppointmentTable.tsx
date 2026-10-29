"use client";

import { Calendar, Clock, User, Stethoscope } from "lucide-react";
import { Appointment } from "@/types";

export function AppointmentTable({ appointments }: { appointments: Appointment[] }) {
    return (
        <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden mt-6">
            <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-lg font-medium text-gray-800">Recent Appointments</h3>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-[#fafafa] text-gray-600 text-sm uppercase font-medium">
                        <tr>
                            <th className="px-6 py-4 font-semibold w-12 text-center">#</th>
                            <th className="px-6 py-4 font-semibold">Patient</th>
                            <th className="px-6 py-4 font-semibold">Date</th>
                            <th className="px-6 py-4 font-semibold">Time</th>
                            <th className="px-6 py-4 font-semibold">Disease Name</th>
                            <th className="px-6 py-4 font-semibold text-right">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {appointments.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-gray-500 italic">
                                    No appointments found.
                                </td>
                            </tr>
                        ) : (
                            appointments.map((appt, index) => {
                                const dateObj = new Date(appt.start_time);
                                const dateStr = dateObj.toLocaleDateString('en-US', {
                                    year: 'numeric', month: 'short', day: 'numeric'
                                });
                                const timeStr = dateObj.toLocaleTimeString('en-US', {
                                    hour: '2-digit', minute: '2-digit'
                                });

                                return (
                                    <tr key={appt.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-center font-medium text-gray-400 w-12">
                                            {index + 1}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                                    <User className="w-4 h-4" />
                                                </div>
                                                <span className="font-medium text-gray-800">{appt.patient_name}</span>
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
                                        <td className="px-6 py-4 text-right">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${appt.canceled
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

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                <span className="text-sm text-gray-500">Showing {appointments.length} appointments</span>
                <a href="/appointments" className="text-[#8B2635] hover:text-[#9C3241] text-sm font-medium cursor-pointer">View All</a>
            </div>
        </div>
    );
}
