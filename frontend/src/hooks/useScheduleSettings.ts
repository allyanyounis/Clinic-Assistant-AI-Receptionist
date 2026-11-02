import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/config";
import { ClinicSettings, DaySchedule } from "@/types";

const HEADERS = { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" };

export interface Draft {
  schedule: DaySchedule[];
  slotMinutes: number;
  holidays: string[];
}

async function loadSettings(): Promise<Draft & { isDefault: boolean }> {
  const res = await fetch(`${API_BASE_URL}/settings/?cb=1`, { headers: HEADERS });
  const data: ClinicSettings = await res.json();
  return {
    schedule: data.weekly_schedule,
    slotMinutes: data.slot_duration_minutes ?? 15,
    holidays: (data.holidays || "").split(",").map((h) => h.trim()).filter(Boolean).sort(),
    isDefault: data.is_default_schedule,
  };
}

/** The doctor's weekly schedule: the saved copy, an editable draft, and saving the draft to the backend. */
export function useScheduleSettings() {
  const [saved, setSaved] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    loadSettings()
      .then(({ isDefault, ...data }) => {
        setSaved(data);
        setDraft(data);
        setIsDefault(isDefault);
      })
      .catch((error) => {
        console.error("Failed to fetch settings:", error);
        setLoadError("Couldn't load your schedule. Is the backend running?");
      });
  }, []);

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch(`${API_BASE_URL}/settings/?cb=1`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({
          slot_duration_minutes: draft.slotMinutes,
          holidays: draft.holidays.join(","),
          weekly_schedule: draft.schedule,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        const detail = typeof data.detail === "string" ? data.detail : "Please check the hours and try again.";
        setNotice({ ok: false, text: `Couldn't save: ${detail}` });
        return;
      }
      setSaved(draft);
      setIsDefault(data.is_default_schedule);
      setNotice({ ok: true, text: "Hours saved. The AI receptionist now books with this schedule." });
    } catch (error) {
      console.error("Error saving settings:", error);
      setNotice({ ok: false, text: "Couldn't reach the server. Your changes are not saved yet." });
    } finally {
      setSaving(false);
    }
  };

  return { saved, draft, setDraft, isDefault, loadError, saving, notice, setNotice, handleSave };
}
