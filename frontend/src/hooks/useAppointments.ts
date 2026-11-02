import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "@/config";
import { Appointment } from "@/types";

/** All appointments from the backend, loaded on mount. `onLoaded` runs after each successful load. */
export function useAppointments(onLoaded?: () => void) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/list_appointments/?cb=1`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAppointments(Array.isArray(data) ? data : (data.appointments || []));
      setLastUpdated(new Date());
      onLoaded?.();
    } catch (error) {
      console.error("Failed to fetch appointments:", error);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [onLoaded]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  return { appointments, loading, lastUpdated, fetchAppointments };
}
