"use client";

import { Info } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, Tooltip } from "recharts";
import { Appointment } from "@/types";
import {
    Trend,
    cancellationsByDay,
    dayTrend,
    todaysActiveCount,
    weekTrend,
} from "@/lib/appointmentStats";
import { useMounted } from "@/hooks/useMounted";

function TrendLabel({ label, trend }: { label: string; trend: Trend }) {
    const up = trend.current > trend.previous;
    const down = trend.current < trend.previous;
    const value = trend.percent !== null
        ? `${Math.abs(trend.percent)}%`
        : trend.current > 0 ? `+${trend.current}` : "0";

    return (
        <span
            className="flex items-center gap-1"
            title={`${trend.current} booked vs ${trend.previous} in the previous period`}
        >
            {label} {value}
            {up && <span className="text-green-500 text-xs">▲</span>}
            {down && <span className="text-red-500 text-xs">▼</span>}
        </span>
    );
}

export function TopSummaryCards({ appointments }: { appointments: Appointment[] }) {
    const isMounted = useMounted();

    if (!isMounted) return null; // Prevent hydration mismatch

    const total = appointments.length;
    const canceled = appointments.filter(a => a.canceled).length;
    const active = total - canceled;
    const cancellationRate = total > 0 ? Math.round((canceled / total) * 100) : 0;
    const activeRate = total > 0 ? Math.round((active / total) * 100) : 0;
    const cancellationData = cancellationsByDay(appointments);

    // Progress ring geometry
    const circumference = 2 * Math.PI * 40;
    const ringOffset = circumference * (1 - activeRate / 100);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

            {/* 1. Total Appointments */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between card-hover">
                <div>
                    <div className="flex justify-between items-center text-gray-500 mb-2">
                        <span className="text-[15px] font-semibold text-gray-700">Total Appointments</span>
                        <span title="All bookings, including canceled ones. Ratios compare bookings made in each period.">
                            <Info className="w-4 h-4 cursor-help" />
                        </span>
                    </div>
                    <div className="text-4xl font-bold text-gray-900 tracking-tight">
                        {total.toLocaleString()}
                    </div>
                </div>

                <div className="mt-4 mb-4 text-sm font-medium text-gray-600 flex items-center gap-4">
                    <TrendLabel label="Week ratio" trend={weekTrend(appointments)} />
                    <TrendLabel label="Day ratio" trend={dayTrend(appointments)} />
                </div>

                <div className="border-t border-gray-100 pt-3 text-sm font-medium text-gray-700">
                    Today&apos;s Appointments: {todaysActiveCount(appointments)}
                </div>
            </div>

            {/* 2. Cancellations */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between card-hover">
                <div>
                    <div className="flex justify-between items-center text-gray-500 mb-2">
                        <span className="text-[15px] font-semibold text-gray-700">Cancellations</span>
                        <span title="Bars show canceled appointments per day over the next 10 days.">
                            <Info className="w-4 h-4 cursor-help" />
                        </span>
                    </div>
                    <div className="text-4xl font-bold text-gray-900 tracking-tight">
                        {canceled.toLocaleString()}
                    </div>
                </div>

                <div className="h-12 mt-2">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={48} initialDimension={{ width: 1, height: 48 }}>
                        <BarChart data={cancellationData}>
                            <Tooltip
                                cursor={{ fill: "transparent" }}
                                content={({ active, payload }) =>
                                    active && payload?.length ? (
                                        <div className="bg-white px-2 py-1 border border-gray-100 shadow-sm rounded text-xs text-gray-700">
                                            {payload[0].payload.name}: {payload[0].payload.count} canceled
                                        </div>
                                    ) : null
                                }
                            />
                            <Bar dataKey="count" fill="#8B2635" barSize={12} radius={[2, 2, 0, 0]} minPointSize={2} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="border-t border-gray-100 pt-3 text-sm font-medium text-gray-700">
                    Cancellation Rate {cancellationRate}%
                </div>
            </div>

            {/* 3. Booking Retention: share of bookings still active */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between card-hover">
                <div className="flex justify-between items-center text-gray-500 mb-2">
                    <span className="text-[15px] font-semibold text-gray-700">Booking Retention</span>
                    <span title="Share of all bookings that have not been canceled.">
                        <Info className="w-4 h-4 cursor-help" />
                    </span>
                </div>

                <div className="flex flex-col items-center justify-center flex-1 py-2">
                    <div className="relative flex items-center justify-center w-24 h-24">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="48" cy="48" r="40" stroke="#f6f8fa" strokeWidth="8" fill="none" />
                            <circle
                                cx="48" cy="48" r="40" stroke="#8B2635" strokeWidth="8" fill="none"
                                strokeDasharray={circumference} strokeDashoffset={ringOffset} strokeLinecap="round"
                                className="transition-all duration-700"
                            />
                        </svg>
                        <div className="absolute text-2xl font-bold text-gray-900">
                            {activeRate}%
                        </div>
                    </div>
                    <p className="text-xs font-medium text-gray-500 mt-2">
                        {active} of {total} bookings active
                    </p>
                </div>
            </div>

        </div>
    );
}
