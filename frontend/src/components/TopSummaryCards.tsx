"use client";

import { Info, Target } from "lucide-react";
import { useEffect, useState } from "react";
import {
    AreaChart, Area,
    BarChart, Bar,
    ResponsiveContainer, Tooltip, XAxis
} from "recharts";



const paymentsData = [
    { name: '1', uv: 400 },
    { name: '2', uv: 300 },
    { name: '3', uv: 200 },
    { name: '4', uv: 278 },
    { name: '5', uv: 189 },
    { name: '6', uv: 239 },
];

export function TopSummaryCards({
    totalAppointments,
    totalCanceled
}: {
    totalAppointments: number,
    totalCanceled: number
}) {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) return null; // Prevent hydration mismatch

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

            {/* 1. Total Appointments (matches "Total Sales") */}
            <div className="bg-white p-5 rounded-md shadow-sm border border-gray-100 flex flex-col justify-between">
                <div>
                    <div className="flex justify-between items-center text-gray-500 mb-2">
                        <span className="text-sm">Total Appointments</span>
                        <Info className="w-4 h-4 cursor-pointer" />
                    </div>
                    <div className="text-3xl font-normal text-gray-800 tracking-tight">
                        {totalAppointments.toLocaleString()}
                    </div>
                </div>

                <div className="mt-4 mb-4 text-sm text-gray-500 flex items-center gap-4">
                    <span className="flex items-center gap-1">
                        Week ratio 12% <span className="text-red-500 text-xs">▲</span>
                    </span>
                    <span className="flex items-center gap-1">
                        Day ratio 11% <span className="text-green-500 text-xs">▼</span>
                    </span>
                </div>

                <div className="border-t border-gray-100 pt-3 text-sm text-gray-600">
                    Daily Appointments: {totalAppointments > 0 ? Math.max(1, Math.round(totalAppointments / 30)) : 0}
                </div>
            </div>



            {/* 3. Cancellations (matches "Payments" Bar Chart) */}
            <div className="bg-white p-5 rounded-md shadow-sm border border-gray-100 flex flex-col justify-between">
                <div>
                    <div className="flex justify-between items-center text-gray-500 mb-2">
                        <span className="text-sm">Cancellations</span>
                        <Info className="w-4 h-4" />
                    </div>
                    <div className="text-3xl font-normal text-gray-800 tracking-tight">
                        {totalCanceled.toLocaleString()}
                    </div>
                </div>

                <div className="h-12 mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={paymentsData}>
                            <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ display: 'none' }} />
                            <Bar dataKey="uv" fill="#8B2635" barSize={12} radius={[2, 2, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="border-t border-gray-100 pt-3 text-sm text-gray-600">
                    Cancellation Rate {(totalAppointments > 0 ? (totalCanceled / totalAppointments) * 100 : 0).toFixed(0)}%
                </div>
            </div>

            {/* 4. Operation Effect (matches screenshot) */}
            <div className="bg-white p-5 rounded-md shadow-sm border border-gray-100 flex flex-col justify-between">
                <div>
                    <div className="flex justify-between items-center text-gray-500 mb-2">
                        <span className="text-sm border-b-2 border-transparent">Operation Effect</span>
                    </div>
                </div>

                <div className="flex flex-col items-center justify-center flex-1 py-4">
                    {/* Placeholder for the custom circle progress from the screenshot */}
                    <div className="relative flex items-center justify-center w-24 h-24">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="48" cy="48" r="40" stroke="#f0f2f5" strokeWidth="8" fill="none" />
                            <circle cx="48" cy="48" r="40" stroke="#8B2635" strokeWidth="8" fill="none" strokeDasharray="251" strokeDashoffset="50" strokeLinecap="round" />
                        </svg>
                        <div className="absolute text-2xl font-normal text-gray-800">
                            88%
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}
