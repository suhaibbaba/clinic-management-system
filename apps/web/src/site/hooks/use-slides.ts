import { useEffect, useState } from "react";
import { HERO_SLIDE_MS } from "@web/site/constants";

const reducedMotion = (): boolean =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface Slides {
  readonly active: number;
  readonly playing: boolean;
  readonly show: (slide: number) => void;
  readonly hold: (held: boolean) => void;
}

export function useSlides(count: number): Slides {
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const playing = !held && count > 1 && !reducedMotion();

  useEffect(() => {
    if (!playing) {
      return;
    }

    const timer = window.setTimeout(
      () => setIndex((current) => (current + 1) % count),
      HERO_SLIDE_MS,
    );

    return () => window.clearTimeout(timer);
  }, [playing, count, index]);

  return { active: index % Math.max(count, 1), playing, show: setIndex, hold: setHeld };
}
