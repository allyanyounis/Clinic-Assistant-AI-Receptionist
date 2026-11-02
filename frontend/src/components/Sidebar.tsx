"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    FileText,
    CalendarClock,
    Users,
    AlertTriangle,
    Clock,
    Stethoscope,
    LogIn,
    Activity,
    Bot,
} from "lucide-react";

export function Sidebar() {
    const pathname = usePathname();
    const menuItems = [
        { name: "Dashboard", icon: LayoutDashboard, href: "/" },
        { name: "AI Receptionist", icon: Bot, href: "/receptionist" },
        { name: "Recent Appointments", icon: CalendarClock, href: "/appointments" },
        { name: "Account", icon: Users, href: "/account" },
        { name: "Time Scheduling", icon: Clock, href: "/settings" },
        { name: "Monitoring", icon: Activity, href: "/monitoring" },
        { name: "Sign In", icon: LogIn, href: "/login" },
    ];

    return (
        <div className="w-64 bg-gradient-to-b from-brand-900 to-brand-950 min-h-screen text-brand-100/80 flex flex-col hidden md:flex">
            <div className="h-16 flex items-center px-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-brand-500/20 ring-1 ring-brand-300/30 text-brand-200 flex items-center justify-center">
                        <Stethoscope className="w-5 h-5" />
                    </div>
                    <span className="text-white text-xl font-bold tracking-tight">DocAssist AI</span>
                </div>
            </div>

            <div className="flex-1 py-4 px-3">
                <ul className="space-y-1">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <li key={item.name}>
                                <Link
                                    href={item.href}
                                    className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] font-medium ${isActive
                                            ? "bg-amber-400 text-brand-950 shadow-sm"
                                            : "text-white/85 hover:bg-amber-400 hover:text-brand-950"
                                        }`}
                                >
                                    <item.icon className={`w-[18px] h-[18px] transition-transform group-hover:scale-110`} />
                                    <span className="transition-transform group-hover:translate-x-0.5">{item.name}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
