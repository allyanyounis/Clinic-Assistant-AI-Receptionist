import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "@/config";
import { Appointment } from "@/types";

/** Appointments plus the clinic's holidays and working days, for the dashboard. Loaded on mount. */
export function useDashboardData() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [workingDays, setWorkingDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAppointments = useCallback(async () => {
    console.log('Dashboard: Fetching appointments for today');
    setLoading(true);
    try {
      // Fetch Settings first to get holidays
      const settingsRes = await fetch(`${API_BASE_URL}/settings/?cb=1`, {
        headers: { "ngrok-skip-browser-warning": "true" }
      });
      const settingsData = await settingsRes.json();
      if (settingsData.holidays) {
        setHolidays(settingsData.holidays.split(',').map((h: string) => h.trim()));
      }
      if (settingsData.working_days) {
        setWorkingDays(settingsData.working_days.split(',').map((d: string) => parseInt(d.trim())));
      }

      const today = new Date().toLocaleDateString('en-CA');
      console.log(`Dashboard: Today's date = ${today}`);
      const response = await fetch(`${API_BASE_URL}/list_appointments/?cb=1`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      console.log(`Dashboard: Received ${data.length} appointments:`, data);
      setAppointments(Array.isArray(data) ? data : (data.appointments || []));
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  return { appointments, holidays, workingDays, loading, lastUpdated, fetchAppointments };
}
