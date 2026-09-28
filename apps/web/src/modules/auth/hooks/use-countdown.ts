import { useCallback, useEffect, useState } from "react";

export function useCountdown(): {
  readonly seconds: number;
  readonly start: (seconds: number) => void;
} {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (seconds <= 0) {
      return;
    }

    const timer = setTimeout(() => setSeconds((value) => value - 1), 1_000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const start = useCallback((from: number) => setSeconds(from), []);

  return { seconds, start };
}
