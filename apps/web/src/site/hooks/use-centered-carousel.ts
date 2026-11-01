import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export interface CenteredCarousel {
  readonly list: RefObject<HTMLUListElement | null>;
  readonly active: number;
  readonly center: (index: number, smooth?: boolean) => void;
}

const reducedMotion = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function useCenteredCarousel(count: number, start: number): CenteredCarousel {
  const list = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(start);
  const placed = useRef(false);

  const center = useCallback((index: number, smooth = true) => {
    const element = list.current;
    const item = element?.children[index];

    if (!element || !(item instanceof HTMLElement)) {
      return;
    }

    const box = element.getBoundingClientRect();
    const rect = item.getBoundingClientRect();
    const delta = rect.left + rect.width / 2 - (box.left + box.width / 2);

    element.scrollBy({ left: delta, behavior: smooth && !reducedMotion() ? "smooth" : "instant" });
  }, []);

  useEffect(() => {
    if (placed.current || count === 0) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      placed.current = true;
      center(start, false);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [center, start, count]);

  useEffect(() => {
    const element = list.current;

    if (!element) {
      return;
    }

    let frame = 0;
    const measure = (): void => {
      frame = 0;
      const box = element.getBoundingClientRect();
      const middle = box.left + box.width / 2;
      let closest = 0;
      let distance = Number.POSITIVE_INFINITY;

      Array.from(element.children).forEach((child, index) => {
        const rect = child.getBoundingClientRect();
        const gap = Math.abs(rect.left + rect.width / 2 - middle);

        if (gap < distance) {
          distance = gap;
          closest = index;
        }
      });

      setActive(closest);
    };
    const onScroll = (): void => {
      if (!frame) {
        frame = window.requestAnimationFrame(measure);
      }
    };

    element.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      element.removeEventListener("scroll", onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, [count]);

  return { list, active, center };
}
