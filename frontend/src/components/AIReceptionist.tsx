"use client";

import { useEffect, useRef, useState } from "react";
import Vapi from "@vapi-ai/web";
import { Phone, PhoneOff, Mic, MicOff, Bot, AlertCircle, Loader2 } from "lucide-react";

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

export type CallStatus = "idle" | "connecting" | "active";

interface TranscriptEntry {
  role: "assistant" | "user";
  text: string;
  final: boolean;
  /** Seconds since the call started. */
  at: number;
}

const SPEAKERS = {
  assistant: { tag: "S1", label: "Agent · Steven Smith" },
  user: { tag: "S2", label: "Patient" },
} as const;

// Relative heights for the waveform bars (tallest in the middle)
const BAR_SHAPE = [0.35, 0.5, 0.65, 0.8, 0.95, 1, 0.95, 0.8, 0.65, 0.5, 0.35];

// Minimal shapes of the Vapi SDK events this component reads
interface VapiMessage { type?: string; role?: string; transcript?: string; transcriptType?: string }
interface VapiError {
  type?: string;
  errorMsg?: string;
  message?: unknown;
  error?: { msg?: string; errorMsg?: string; message?: unknown; error?: { type?: string } };
}

const formatClock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export function AIReceptionist({ onStatusChange }: { onStatusChange?: (status: CallStatus) => void }) {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [assistantSpeaking, setAssistantSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const callStartRef = useRef<number | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Let the page reflect call state (e.g. the Agent Status card)
  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  // Auto-scroll to newest line
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [entries]);

  // Call timer
  useEffect(() => {
    if (status !== "active") return;
    const timer = setInterval(() => {
      if (callStartRef.current) setElapsed(Math.floor((Date.now() - callStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  // Attach / detach Vapi event listeners
  useEffect(() => {
    const vapi = getVapi();
    const secondsIntoCall = () =>
      callStartRef.current ? Math.floor((Date.now() - callStartRef.current) / 1000) : 0;

    const resetCallState = () => {
      setStatus("idle");
      setAssistantSpeaking(false);
      setVolume(0);
      setMuted(false);
      callStartRef.current = null;
    };

    const onCallStart = () => {
      callStartRef.current = Date.now();
      setElapsed(0);
      setErrorMessage(null);
      setStatus("active");
    };

    const onMessage = (msg: VapiMessage) => {
      if (msg.type !== "transcript" || (msg.role !== "assistant" && msg.role !== "user")) return;
      const role = msg.role;
      const text = msg.transcript ?? "";
      const isFinal = msg.transcriptType === "final";
      setEntries((prev) => {
        const last = prev[prev.length - 1];
        // Replace the in-progress (partial) line of the same speaker with the newer text
        if (last && !last.final && last.role === role) {
          return [...prev.slice(0, -1), { ...last, text, final: isFinal }];
        }
        return [...prev, { role, text, final: isFinal, at: secondsIntoCall() }];
      });
    };

    const onError = (e: VapiError) => {
      // "Meeting has ended" is the normal room-closure event (e.g. assistant hung up).
      // The SDK wraps it as { type: "daily-error", error: { errorMsg, error: { type: "ejected" } } }.
      const endedMsg = e?.errorMsg || e?.error?.errorMsg || e?.error?.msg;
      if (endedMsg === "Meeting has ended" || e?.error?.error?.type === "ejected") {
        resetCallState();
        return;
      }

      console.error("Vapi Error:", e);
      let msg = "";
      if (e?.error?.message) {
        msg = typeof e.error.message === "string" ? e.error.message : JSON.stringify(e.error.message);
      } else if (e?.message) {
        msg = typeof e.message === "string" ? e.message : JSON.stringify(e.message);
      }

      if (e?.type === "start-method-error" || msg.toLowerCase().includes("credit") || msg.toLowerCase().includes("balance")) {
        setErrorMessage(msg || "Call failed to start: insufficient VAPI credits. Please recharge on dashboard.vapi.ai.");
      } else {
        setErrorMessage(msg || "Call failed to connect. Please check microphone permissions or VAPI credits.");
      }
      resetCallState();
    };

    const onSpeechStart = () => setAssistantSpeaking(true);
    const onSpeechEnd = () => setAssistantSpeaking(false);
    const onVolume = (level: number) => setVolume(level);

    vapi.on("call-start", onCallStart);
    vapi.on("call-end", resetCallState);
    vapi.on("message", onMessage);
    vapi.on("error", onError);
    vapi.on("speech-start", onSpeechStart);
    vapi.on("speech-end", onSpeechEnd);
    vapi.on("volume-level", onVolume);

    return () => {
      vapi.off("call-start", onCallStart);
      vapi.off("call-end", resetCallState);
      vapi.off("message", onMessage);
      vapi.off("error", onError);
      vapi.off("speech-start", onSpeechStart);
      vapi.off("speech-end", onSpeechEnd);
      vapi.off("volume-level", onVolume);
    };
  }, []);

  const startCall = async () => {
    setEntries([]);
    setErrorMessage(null);
    setElapsed(0);
    setStatus("connecting");
    try {
      await getVapi().start(ASSISTANT_ID);
    } catch (err) {
      console.error("Failed to start call:", err);
      setErrorMessage((err instanceof Error && err.message) || "Failed to start call. Please check your VAPI dashboard credits.");
      setStatus("idle");
    }
  };

  const endCall = () => getVapi().stop();

  const toggleMute = () => {
    const next = !muted;
    getVapi().setMuted(next);
    setMuted(next);
  };

  const isActive = status === "active";
  const headline =
    status === "connecting" ? "Connecting..." :
      !isActive ? "Ready to take calls" :
        assistantSpeaking ? "AI Speaking..." : "Listening...";
  const subline =
    status === "connecting" ? "Setting up the voice line" :
      isActive ? `Call in progress · ${formatClock(elapsed)}` : "Press the call button to talk to Steven";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

      {/* Call stage */}
      <div className="xl:col-span-3 relative overflow-hidden rounded-2xl border border-gray-100 shadow-sm bg-gradient-to-br from-[#fdf2f4] via-white to-[#f6f7f9] px-6 py-10 flex flex-col items-center justify-center min-h-[460px]">

        {errorMessage && (
          <div className="absolute top-4 left-4 right-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Connection Error</span>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Orb */}
        <div className="relative flex items-center justify-center w-48 h-48">
          {isActive && (
            <>
              <span className="absolute inset-0 rounded-full bg-[#8B2635]/10 animate-ping" style={{ animationDuration: "2s" }} />
              <span
                className="absolute rounded-full border-2 border-[#8B2635]/30 transition-all duration-150"
                style={{ inset: `${12 - volume * 12}px` }}
              />
            </>
          )}
          <span className="absolute inset-6 rounded-full border border-[#8B2635]/20" />
          <div
            className={`relative w-28 h-28 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${isActive ? "bg-[#8B2635] text-white" : "bg-[#fde8ea] text-[#8B2635]"
              }`}
          >
            {status === "connecting" ? <Loader2 className="w-12 h-12 animate-spin" /> : <Bot className="w-12 h-12" />}
          </div>
        </div>

        <h3 className="mt-6 text-2xl font-bold text-gray-800">{headline}</h3>
        <p className="mt-1 text-sm text-gray-500">{subline}</p>

        {/* Waveform */}
        <div className="mt-6 h-16 flex items-end gap-1.5" aria-hidden>
          {BAR_SHAPE.map((shape, i) => {
            const level = isActive ? (assistantSpeaking ? Math.max(volume, 0.15) : 0.08) : 0.05;
            return (
              <span
                key={i}
                className={`w-2 rounded-full transition-all duration-150 ${isActive ? "bg-[#8B2635]" : "bg-gray-300"}`}
                style={{ height: `${Math.max(6, shape * level * 64 + (assistantSpeaking ? (i % 3) * 3 : 0))}px` }}
              />
            );
          })}
        </div>

        {/* Controls */}
        <div className="mt-8 flex items-center gap-5">
          {isActive && (
            <button
              onClick={toggleMute}
              title={muted ? "Unmute microphone" : "Mute microphone"}
              className={`w-14 h-14 rounded-full flex items-center justify-center border shadow-sm transition-colors ${muted ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
            >
              {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          )}

          {status === "idle" ? (
            <button
              onClick={startCall}
              title="Start call"
              className="px-8 h-16 rounded-full bg-[#8B2635] hover:bg-[#6B1925] text-white font-semibold shadow-lg flex items-center gap-3 transition-all active:scale-95"
            >
              <Phone className="w-6 h-6" />
              Call AI Receptionist
            </button>
          ) : (
            <button
              onClick={endCall}
              title="End call"
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg flex items-center justify-center transition-all active:scale-95"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          )}
        </div>
        {muted && isActive && <p className="mt-3 text-xs text-gray-500">Your microphone is muted</p>}
      </div>

      {/* Live transcript */}
      <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col min-h-[460px] max-h-[600px]">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800">Live Transcript</h3>
            <p className="text-xs text-gray-400">
              <span className="font-semibold text-[#8B2635]">S1</span> Agent ·{" "}
              <span className="font-semibold text-slate-600">S2</span> Patient
            </p>
          </div>
          {isActive && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" /> LIVE
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm">
          {entries.length === 0 ? (
            <p className="text-gray-400 text-center italic mt-24">
              {isActive ? "Listening... speak into your microphone." : "The conversation will appear here during the call."}
            </p>
          ) : (
            entries.map((entry, idx) => {
              const speaker = SPEAKERS[entry.role];
              const isAgent = entry.role === "assistant";
              return (
                <div key={idx} className="flex gap-3">
                  <span
                    className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${isAgent ? "bg-[#8B2635] text-white" : "bg-slate-200 text-slate-700"
                      }`}
                  >
                    {speaker.tag}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-400 mb-0.5">
                      <span className={`font-semibold ${isAgent ? "text-[#8B2635]" : "text-slate-600"}`}>{speaker.label}</span>
                      {" · "}{formatClock(entry.at)}
                    </p>
                    <p className={`text-gray-800 leading-relaxed ${entry.final ? "" : "text-gray-400 italic"}`}>{entry.text}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={transcriptEndRef} />
        </div>
      </div>
    </div>
  );
}
