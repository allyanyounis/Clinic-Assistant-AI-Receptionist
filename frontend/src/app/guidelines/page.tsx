"use client";

import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { 
    Search, 
    Filter, 
    ChevronRight, 
    BookOpen, 
    FileText, 
    CheckCircle2, 
    ArrowRight,
    ExternalLink,
    Calendar,
    ChevronDown
} from "lucide-react";
import { CLINICAL_PROTOCOLS, ClinicalProtocol } from "@/data/clinicalData";

export default function GuidelinesPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedProtocol, setSelectedProtocol] = useState<ClinicalProtocol>(CLINICAL_PROTOCOLS[0]);

    const filteredProtocols = CLINICAL_PROTOCOLS.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex min-h-screen bg-[#f0f2f5] font-sans">
            <Sidebar />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header />

                <main className="flex-1 overflow-hidden flex flex-col">
                    {/* Inner Header */}
                    <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">CLINICAL GUIDELINES</h2>
                            <p className="text-sm text-gray-400 font-medium">Internal Protocol Library</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm">
                                <span className="text-xs font-bold text-[#8B2635]">Time and Date</span>
                                <div className="h-4 w-[1px] bg-gray-200"></div>
                                <span className="text-xs text-gray-500 font-mono">2026-03-18 - 2026-03-27</span>
                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 flex overflow-hidden">
                        {/* Left Column: Search & List */}
                        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
                            <div className="p-4 border-b border-gray-100">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input 
                                        type="text" 
                                        placeholder="Search..." 
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 pl-10 pr-4 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8B2635]/20 focus:border-[#8B2635] transition-all"
                                    />
                                    <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 cursor-pointer hover:text-[#8B2635]" />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {filteredProtocols.map(protocol => (
                                    <button
                                        key={protocol.id}
                                        onClick={() => setSelectedProtocol(protocol)}
                                        className={`w-full text-left px-6 py-4 border-l-4 transition-all hover:bg-gray-50 flex items-center justify-between group ${
                                            selectedProtocol.id === protocol.id 
                                            ? "border-[#8B2635] bg-[#fff1f2]" 
                                            : "border-transparent text-gray-600"
                                        }`}
                                    >
                                        <span className={`text-sm font-semibold ${selectedProtocol.id === protocol.id ? "text-[#8B2635]" : "group-hover:text-gray-900"}`}>
                                            {protocol.name}
                                        </span>
                                        {selectedProtocol.id === protocol.id && <ChevronRight className="w-4 h-4 text-[#8B2635]" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Middle Column: Detailed Protocol */}
                        <div className="flex-1 overflow-y-auto bg-gray-50 p-8">
                            <div className="max-w-4xl mx-auto space-y-8">
                                {/* Protocol Title Card */}
                                <div className="bg-[#53131D] text-white rounded-xl p-6 shadow-xl flex items-center gap-4">
                                    <div className="bg-[#8B2635] p-3 rounded-lg shadow-inner">
                                        <BookOpen className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold uppercase tracking-widest">{selectedProtocol.name.toUpperCase()}</h3>
                                    </div>
                                </div>

                                {/* Content Sections */}
                                <div className="grid gap-6">
                                    {/* Introduction */}
                                    <section className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                                        <div className="flex items-start gap-4 mb-4">
                                            <div className="bg-[#8B2635] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1">1</div>
                                            <div>
                                                <h4 className="font-bold text-gray-800 text-lg mb-2">Introduction</h4>
                                                <p className="text-gray-500 leading-relaxed text-sm">{selectedProtocol.introduction}</p>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Diagnosis & Assessment */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <section className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm h-full">
                                            <div className="flex items-start gap-4 mb-4">
                                                <div className="bg-[#8B2635] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1">2</div>
                                                <h4 className="font-bold text-gray-800 text-lg">Diagnosis</h4>
                                            </div>
                                            <ul className="space-y-3 pl-10">
                                                {selectedProtocol.diagnosis.map((item, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-sm text-gray-500">
                                                        <span className="text-[#8B2635] font-bold mt-0.5">•</span>
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>
                                        </section>

                                        <section className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm h-full">
                                            <div className="flex items-start gap-4 mb-4">
                                                <div className="bg-[#8B2635] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1">3</div>
                                                <h4 className="font-bold text-gray-800 text-lg">Assessment</h4>
                                            </div>
                                            <ul className="space-y-3 pl-10">
                                                {selectedProtocol.assessment.map((item, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-sm text-gray-500">
                                                        <span className="text-[#8B2635] font-bold mt-0.5">•</span>
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>
                                        </section>
                                    </div>

                                    {/* Treatment Plan & Flowchart */}
                                    <section className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative overflow-hidden">
                                        <div className="flex items-start gap-4 mb-4">
                                            <div className="bg-[#8B2635] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1">4</div>
                                            <h4 className="font-bold text-gray-800 text-lg">Treatment Plan</h4>
                                        </div>
                                        <div className="pl-10 space-y-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                                {selectedProtocol.treatmentPlan.map((item, i) => (
                                                    <div key={i} className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-center gap-3 group hover:border-[#8B2635]/30 transition-all">
                                                        <div className="w-5 h-5 rounded-full bg-[#fde8e9] flex items-center justify-center text-[#8B2635]">
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                        </div>
                                                        <span className="text-sm text-gray-600 font-medium">{item}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Mock Flowchart Design */}
                                            <div className="bg-[#fcf8f8] border-2 border-dashed border-[#8B2635]/20 rounded-xl p-8 flex flex-col items-center">
                                                <div className="w-40 bg-white border-2 border-[#8B2635] text-[#8B2635] text-[10px] font-bold py-2 px-3 rounded text-center shadow-md">
                                                    Initial Assessment
                                                </div>
                                                <div className="h-6 w-0.5 bg-gray-300 my-1"></div>
                                                <div className="w-0.5 h-0.5 bg-gray-300 rounded-full mb-1"></div>
                                                <div className="flex items-center gap-12">
                                                    <div className="flex flex-col items-center">
                                                        <div className="w-32 bg-white border border-gray-200 text-gray-500 text-[9px] py-1 px-2 rounded text-center">Stable</div>
                                                        <div className="h-4 w-0.5 bg-gray-300"></div>
                                                        <div className="w-24 bg-[#8B2635] text-white text-[9px] py-1.5 px-2 rounded text-center shadow-lg">Observation</div>
                                                    </div>
                                                    <div className="flex flex-col items-center">
                                                        <div className="w-32 bg-white border border-gray-200 text-[#8B2635] text-[9px] py-1 px-2 rounded font-bold text-center">Critical</div>
                                                        <div className="h-4 w-0.5 bg-gray-300"></div>
                                                        <div className="w-24 bg-[#fde8e9] border border-[#8B2635]/30 text-[#8B2635] text-[9px] py-1.5 px-2 rounded font-bold text-center shadow-md">Emergency Care</div>
                                                    </div>
                                                </div>
                                                <div className="mt-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Medication Flowchart</div>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Follow-up & Related */}
                        <div className="w-72 bg-white border-l border-gray-200 overflow-y-auto p-6 flex flex-col gap-8">
                            {/* Follow-up Section */}
                            <section>
                                <h4 className="font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">Follow-up</h4>
                                <div className="space-y-4">
                                    {selectedProtocol.followUp.map((item, i) => (
                                        <div key={i} className="flex gap-3">
                                            <div className="bg-[#fde8e9] text-[#8B2635] w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i+1}</div>
                                            <p className="text-xs text-gray-500 leading-relaxed font-medium">{item}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* Related Protocols */}
                            <section>
                                <h4 className="font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">Related Protocols</h4>
                                <div className="space-y-2">
                                    {selectedProtocol.relatedProtocols.map((name, i) => (
                                        <button 
                                            key={i} 
                                            className="w-full text-left flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors group"
                                        >
                                            <FileText className="w-3.5 h-3.5 text-[#8B2635]" />
                                            <span className="text-xs text-gray-600 font-semibold group-hover:text-[#8B2635]">{name}</span>
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {/* References */}
                            <section>
                                <h4 className="font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4 uppercase text-[10px] tracking-widest">References</h4>
                                <div className="space-y-3">
                                    {selectedProtocol.references.map((ref, i) => (
                                        <div key={i} className="flex gap-2">
                                            <span className="text-[10px] text-gray-400 font-bold mt-0.5">{i+1}.</span>
                                            <p className="text-[10px] text-gray-400 italic leading-tight">{ref}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
