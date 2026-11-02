import { useCallback, useEffect, useState } from "react";

/** The current time, refreshed every `intervalMs`, plus a function to refresh it right away. */
export function useNow(intervalMs: number): [Date, () => void] {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  const refreshNow = useCallback(() => setNow(new Date()), []);
  return [now, refreshNow];
}
