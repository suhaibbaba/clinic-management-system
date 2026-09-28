import { useEffect, useState } from "react";
import { minutesOf } from "@web/modules/appointments/lib/calendar-time";

export function useNowMinute(): number {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((tick) => tick + 1), 60_000);

    return () => window.clearInterval(timer);
  }, []);

  return Math.floor(minutesOf(new Date().toISOString()));
}
