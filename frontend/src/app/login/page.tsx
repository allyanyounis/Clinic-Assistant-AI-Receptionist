"use client";

import { AuthCard } from "@/components/AuthCard";
import { Stethoscope } from "lucide-react";

export default function LoginPage() {
    return (
        <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 bg-slate-900 font-sans overflow-hidden">
            {/* Blurred Background Image */}
            <div 
                className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-60 scale-105"
                style={{ backgroundImage: "url('/images/clinic-bg.png')" }}
            />
            
            {/* Overlay Gradient for more premium feel */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-white/10" />

            {/* Logo */}
            <div className="relative mb-10 flex flex-col items-center gap-1 group">
                <div className="flex items-center gap-3">
                    <Stethoscope className="w-8 h-8 text-[#53131D] group-hover:scale-110 transition-transform duration-300" />
                    <span className="text-3xl font-bold tracking-tight text-[#53131D]">DocAssist AI</span>
                </div>
            </div>

            {/* Auth Card */}
            <div className="relative z-10 w-full flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                <AuthCard />
            </div>

            {/* Footer */}
            <footer className="relative mt-12 text-center text-slate-500 z-10">
                <div className="flex gap-6 justify-center mb-3">
                    <button className="text-xs font-medium hover:text-[#8B2635] transition-colors">Privacy Policy</button>
                    <button className="text-xs font-medium hover:text-[#8B2635] transition-colors">Terms of Service</button>
                    <button className="text-xs font-medium hover:text-[#8B2635] transition-colors">About</button>
                </div>
                <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-400">
                    © 2026 DocAssist AI. All rights reserved.
                </p>
            </footer>
        </div>
    );
}
