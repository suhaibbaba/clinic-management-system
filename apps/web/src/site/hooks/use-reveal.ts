import { useEffect } from "react";

const TARGETS = "[data-reveal], [data-reveal-group]";

export function useReveal(key: string): void {
  useEffect(() => {
    const root = document.getElementById("site-main");

    if (!root) {
      return;
    }

    const targets = [...root.querySelectorAll<HTMLElement>(TARGETS)];
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (still || !("IntersectionObserver" in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset["revealed"] = "";
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );

    for (const target of targets) {
      observer.observe(target);
    }

    document.documentElement.classList.add("site-reveal");

    return () => observer.disconnect();
  }, [key]);
}
