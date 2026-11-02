import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "@/config";
import { Appointment, ClinicSettings } from "@/types";

async function loadReceptionistData(): Promise<{ appointments: Appointment[]; settings: ClinicSettings }> {
  const headers = { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" };
  const [apptRes, settingsRes] = await Promise.all([
    fetch(`${API_BASE_URL}/list_appointments/?cb=1`, { method: "POST", headers, body: JSON.stringify({}) }),
    fetch(`${API_BASE_URL}/settings/?cb=1`, { headers }),
  ]);
  const apptData = await apptRes.json();
  return {
    appointments: Array.isArray(apptData) ? apptData : (apptData.appointments || []),
    settings: await settingsRes.json(),
  };
}

/** Appointments and clinic settings for the AI Receptionist page. Loaded on mount; call `fetchData` to reload. */
export function useReceptionistData() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [settings, setSettings] = useState<ClinicSettings | null>(null);

  const fetchData = useCallback(() => {
    loadReceptionistData()
      .then(({ appointments, settings }) => {
        setAppointments(appointments);
        setSettings(settings);
      })
      .catch((error) => console.error("Failed to fetch receptionist data:", error));
  }, []);

  useEffect(fetchData, [fetchData]);

  return { appointments, settings, fetchData };
}
