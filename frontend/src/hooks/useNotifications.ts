import { useEffect, useState } from "react";

const NOTIFICATIONS_SEEN_KEY = "notifications_last_seen";

/** When the doctor last opened the bell (saved in localStorage), and a function to mark everything seen. */
export function useNotifications() {
  // Bookings made after this moment count as new notifications (defaults to the last 24 hours)
  const [notificationsSeenAt, setNotificationsSeenAt] = useState<Date>(() => new Date(Date.now() - 24 * 60 * 60 * 1000));

  useEffect(() => {
    try {
      const saved = localStorage.getItem(NOTIFICATIONS_SEEN_KEY);
      if (saved) setNotificationsSeenAt(new Date(saved));
    } catch {}
  }, []);

  const markNotificationsSeen = () => {
    const now = new Date();
    setNotificationsSeenAt(now);
    try {
      localStorage.setItem(NOTIFICATIONS_SEEN_KEY, now.toISOString());
    } catch {}
  };

  return { notificationsSeenAt, markNotificationsSeen };
}
