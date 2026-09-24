import { useEffect, useState } from "react";
import { minutesOf } from "@web/features/appointments/calendar-time";

/** The clinic's current minute of the day, re-read every minute. */
export function useNowMinute(): number {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((tick) => tick + 1), 60_000);

    return () => window.clearInterval(timer);
  }, []);

  // Read on every render rather than kept in state: the clinic's zone arrives after the first one.
  // Floored, because `minutesOf` carries the seconds as a fraction and a label read "11:35.27".
  return Math.floor(minutesOf(new Date().toISOString()));
}
