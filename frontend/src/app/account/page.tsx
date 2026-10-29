"use client";

import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { Search, HelpCircle, Bell, Pencil, ChevronRight } from "lucide-react";

export default function AccountPage() {
    return (
        <div className="flex min-h-screen bg-[#f0f2f5] font-sans">
            <Sidebar />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header title="Account" />

                <main className="flex-1 overflow-auto p-8">
                    <div className="max-w-4xl mx-auto">
                        <div className="mb-8">
                            <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Account & Profile Settings</h1>
                            <p className="text-gray-500 font-medium">Edit your information and manage account security</p>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-8">
                                <h2 className="text-xl font-bold text-gray-800 mb-8 tracking-tight">Personal Information</h2>

                                <div className="flex flex-col md:flex-row justify-between gap-12">
                                    {/* Info Column */}
                                    <div className="flex-1 space-y-8">
                                        <div>
                                            <p className="text-sm text-gray-400 font-bold mb-1 uppercase tracking-wider">User's full name</p>
                                            <p className="text-2xl font-bold text-gray-800 tracking-tight">Dr. Olivia Bennett</p>
                                        </div>

                                        <div>
                                            <p className="text-sm text-gray-400 font-bold mb-1 uppercase tracking-wider">Job Title</p>
                                            <p className="text-lg font-semibold text-gray-700 tracking-tight">Senior Practitioner</p>
                                        </div>

                                        <div>
                                            <p className="text-sm text-gray-400 font-bold mb-1 uppercase tracking-wider">Clinic</p>
                                            <p className="text-lg font-semibold text-gray-700 tracking-tight">Downtown Clinic</p>
                                        </div>
                                    </div>

                                    {/* Avatar Column */}
                                    <div className="relative shrink-0 flex items-center justify-center md:mr-4">
                                        <div className="w-40 h-40 rounded-full bg-[#fde8e9] border-4 border-white shadow-lg overflow-hidden flex items-center justify-center">
                                            {/* Doctor Avatar Placeholder */}
                                            <svg className="w-full h-full text-[#8B2635]" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                                            </svg>
                                        </div>
                                        <button className="absolute bottom-2 right-2 bg-[#8B2635] text-white p-2.5 rounded-full shadow-xl hover:bg-[#6B1925] transition-all hover:scale-110 active:scale-95 border-2 border-white">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-12 pt-8 border-t border-gray-100 flex flex-col gap-6">
                                    {/* Email */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <p className="font-bold text-gray-800 text-lg tracking-tight shrink-0">Email:</p>
                                            <p className="text-lg text-gray-600 font-medium">dr.olivia@bennett.com</p>
                                        </div>
                                        <button className="px-6 py-1.5 border-2 border-[#8B2635]/20 text-[#8B2635] rounded-lg text-sm font-bold hover:bg-[#8B2635] hover:text-white transition-all active:scale-95">
                                            Edit
                                        </button>
                                    </div>

                                    {/* Phone */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <p className="font-bold text-gray-800 text-lg tracking-tight shrink-0">Phone:</p>
                                            <p className="text-lg text-gray-600 font-medium">+1-903-527-1270</p>
                                        </div>
                                        <button className="px-6 py-1.5 border-2 border-[#8B2635]/20 text-[#8B2635] rounded-lg text-sm font-bold hover:bg-[#8B2635] hover:text-white transition-all active:scale-95">
                                            Edit
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
