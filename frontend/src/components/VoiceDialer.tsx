"use client";

import { useEffect, useRef, useState } from "react";
import Vapi from "@vapi-ai/web";
import { Phone, PhoneOff, Mic, Bot, User, AlertCircle } from "lucide-react";

// VAPI credentials (loaded from .env.local with safe fallbacks)
const VAPI_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || "d5ff950e-41e8-43e1-8d83-f0b33e539a6c";
const ASSISTANT_ID = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || "353a0909-4321-4a6a-901c-b577d41c7d7c";

// Store Vapi on globalThis so it survives Next.js HMR (Fast Refresh).
declare global { var __vapiInstance: Vapi | undefined; }
function getVapi(): Vapi {
  if (!globalThis.__vapiInstance) {
    globalThis.__vapiInstance = new Vapi(VAPI_PUBLIC_KEY);
  }
  return globalThis.__vapiInstance;
}

interface Message {
  role: "user" | "assistant";
  text: string;
}

export function VoiceDialer() {
  const [isCalling, setIsCalling] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Attach / detach event listeners only
  useEffect(() => {
    const vapi = getVapi();

    const onCallStart = () => {
      setIsCalling(true);
      setCurrentSpeaker("Assistant is speaking...");
      setErrorMessage(null);
    };

    const onCallEnd = () => {
      setIsCalling(false);
      setCurrentSpeaker(null);
    };

    const onMessage = (msg: any) => {
      if (msg.type === "transcript" && msg.transcriptType === "final") {
        setMessages((prev) => [...prev, { role: msg.role, text: msg.transcript }]);
      }
      if (msg.type === "speech-start") setCurrentSpeaker("Speaking...");
      if (msg.type === "speech-end") setCurrentSpeaker(null);
    };

    const onError = (e: any) => {
      // "Meeting has ended" is the normal room-closure event (e.g. assistant hung up).
      // The SDK wraps it as { type: "daily-error", error: { errorMsg, error: { type: "ejected" } } }.
      const endedMsg = e?.errorMsg || e?.error?.errorMsg || e?.error?.msg;
      if (endedMsg === "Meeting has ended" || e?.error?.error?.type === "ejected") {
        setIsCalling(false);
        setCurrentSpeaker(null);
        return;
      }

      console.error("Vapi Error:", e);

      // Extract meaningful error message
      let msg = "";
      if (e?.error?.message) {
        msg = typeof e.error.message === "string" ? e.error.message : JSON.stringify(e.error.message);
      } else if (e?.message) {
        msg = typeof e.message === "string" ? e.message : JSON.stringify(e.message);
      }

      if (e?.type === "start-method-error" || msg.toLowerCase().includes("credit") || msg.toLowerCase().includes("balance")) {
        setErrorMessage(
          msg || "Call failed to start: Insufficient VAPI credits (Current balance is under minimum required to start a call). Please check or recharge credits on dashboard.vapi.ai."
        );
      } else if (msg) {
        setErrorMessage(msg);
      } else {
        setErrorMessage("Call failed to connect. Please check microphone permissions or VAPI credits.");
      }

      setIsCalling(false);
      setCurrentSpeaker(null);
    };

    vapi.on("call-start", onCallStart);
    vapi.on("call-end", onCallEnd);
    vapi.on("message", onMessage);
    vapi.on("error", onError);

    return () => {
      vapi.off("call-start", onCallStart);
      vapi.off("call-end", onCallEnd);
      vapi.off("message", onMessage);
      vapi.off("error", onError);
    };
  }, []);

  const startCall = async () => {
    setMessages([]);
    setErrorMessage(null);
    try {
      await getVapi().start(ASSISTANT_ID);
    } catch (err: any) {
      console.error("Failed to start call:", err);
      setErrorMessage(
        err?.message || "Failed to start call. Please check your VAPI dashboard credits."
      );
    }
  };

  const endCall = () => getVapi().stop();

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 max-w-md w-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-slate-800 text-lg">AI Receptionist (Steven Smith)</h3>
          <p className="text-xs text-slate-400">Click to call the clinic voice assistant</p>
        </div>
        <div className={`w-3 h-3 rounded-full ${isCalling ? "bg-green-500 animate-pulse" : "bg-slate-300"}`} />
      </div>

      {/* Error Alert Banner */}
      {errorMessage && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold block">Connection Error</span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Transcription Window */}
      <div className="my-4 h-64 overflow-y-auto bg-slate-50 rounded-xl p-4 space-y-3 text-sm border border-slate-100">
        {messages.length === 0 ? (
          <p className="text-slate-400 text-center italic mt-20">
            {isCalling ? "Listening... Speak into your microphone." : "Start call to speak with the AI receptionist."}
          </p>
        ) : (
          messages.map((m, idx) => (
            <div key={idx} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && <Bot className="w-4 h-4 text-[#8B2635] mt-1 shrink-0" />}
              <div
                className={`px-3 py-2 rounded-xl max-w-[80%] ${
                  m.role === "user"
                    ? "bg-[#8B2635] text-white rounded-br-none"
                    : "bg-white text-slate-800 border border-slate-200 rounded-bl-none shadow-sm"
                }`}
              >
                {m.text}
              </div>
              {m.role === "user" && <User className="w-4 h-4 text-slate-400 mt-1 shrink-0" />}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Status Bar */}
      {isCalling && currentSpeaker && (
        <div className="text-xs text-emerald-600 font-medium flex items-center gap-1.5 mb-3">
          <Mic className="w-3.5 h-3.5 animate-pulse" />
          <span>{currentSpeaker}</span>
        </div>
      )}

      {/* Call Button */}
      {!isCalling ? (
        <button
          onClick={startCall}
          className="w-full bg-[#8B2635] hover:bg-[#6B1925] text-white font-semibold py-3 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <Phone className="w-5 h-5" />
          Call AI Receptionist
        </button>
      ) : (
        <button
          onClick={endCall}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <PhoneOff className="w-5 h-5" />
          End Call
        </button>
      )}
    </div>
  );
}
