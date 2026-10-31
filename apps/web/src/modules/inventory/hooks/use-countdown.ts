import { useEffect, useState } from "react";

export function useCountdown(seconds: number, running: boolean): number {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    if (!running) {
      setLeft(seconds);
      return;
    }

    setLeft(seconds);
    const timer = window.setInterval(() => setLeft((current) => Math.max(current - 1, 0)), 1000);

    return () => window.clearInterval(timer);
  }, [seconds, running]);

  return left;
}
