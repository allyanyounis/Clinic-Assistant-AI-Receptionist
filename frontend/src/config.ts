/**
 * Centralized API base URL configuration.
 * - For local development: "http://127.0.0.1:4444"
 * - For remote/ngrok testing: replace with your ngrok forwarding URL (e.g. "https://xxxx.ngrok-free.dev")
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:4444";
