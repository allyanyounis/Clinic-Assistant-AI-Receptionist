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
    BookOpen,
} from "lucide-react";

export function Sidebar() {
    const pathname = usePathname();
    const menuItems = [
        { name: "Dashboard", icon: LayoutDashboard, href: "/" },
        { name: "Recent Appointments", icon: CalendarClock, href: "/appointments" },
        { name: "Account", icon: Users, href: "/account" },
        { name: "Time Scheduling", icon: Clock, href: "/settings" },
        { name: "Clinical Guidelines", icon: BookOpen, href: "/guidelines" },
        { name: "Sign In", icon: LogIn, href: "/login" },
    ];

    return (
        <div className="w-64 bg-[#53131D] min-h-screen text-slate-300 flex flex-col hidden md:flex">
            <div className="h-16 flex items-center px-6 border-b border-[#6B1925]">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 text-white flex items-center justify-center">
                        <Stethoscope className="w-7 h-7" />
                    </div>
                    <span className="text-white text-xl font-bold tracking-tight">DocAssist AI</span>
                </div>
            </div>

            <div className="flex-1 py-4">
                <ul className="space-y-1">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <li key={item.name}>
                                <Link
                                    href={item.href}
                                    className={`flex items-center gap-3 px-6 py-3 text-sm transition-colors ${isActive
                                            ? "bg-[#8B2635] text-white"
                                            : "hover:text-white hover:bg-[#6B1925]"
                                        }`}
                                >
                                    <item.icon className="w-4 h-4" />
                                    <span>{item.name}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
