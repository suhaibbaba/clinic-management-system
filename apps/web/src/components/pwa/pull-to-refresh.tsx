import { Icon } from "@clinic/ui";
import { cn } from "@clinic/ui/lib/cn";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { checkForUpdate } from "@web/lib/service-worker";
import { isStandalone } from "@web/lib/use-install-prompt";

/** How far the finger travels, after damping, before letting go refreshes. */
export const PULL_THRESHOLD = 64;
const PULL_MAX = 96;
const DAMPING = 0.5;

/** A touch that starts inside something already scrolled down is that element's scroll, not a pull. */
function scrolledAncestor(target: EventTarget | null): boolean {
  for (let node = target instanceof Element ? target : null; node; node = node.parentElement) {
    if (node.scrollTop > 0) {
      return true;
    }
  }

  return false;
}

/**
 * A home-screen app has no browser around it, so no pull-to-refresh of its own. Pulling down at the
 * top refetches what is on screen and asks for a newer build — never a reload, which would lose a
 * half-filled form.
 */
export function PullToRefresh({
  enabled = isStandalone(),
}: {
  readonly enabled?: boolean;
}): JSX.Element | null {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<number | null>(null);
  const pulled = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onStart = (event: TouchEvent): void => {
      const touch = event.touches[0];
      const locked = document.body.hasAttribute("data-scroll-locked");

      start.current =
        !busy.current &&
        !locked &&
        event.touches.length === 1 &&
        touch &&
        window.scrollY <= 0 &&
        !scrolledAncestor(event.target)
          ? touch.clientY
          : null;
    };

    const onMove = (event: TouchEvent): void => {
      const touch = event.touches[0];

      if (start.current === null || !touch) {
        return;
      }

      pulled.current = Math.min(Math.max(0, (touch.clientY - start.current) * DAMPING), PULL_MAX);
      setDistance(pulled.current);
    };

    const onEnd = (): void => {
      if (start.current === null) {
        return;
      }

      start.current = null;
      const release = pulled.current >= PULL_THRESHOLD;
      pulled.current = 0;
      setDistance(0);

      if (release) {
        busy.current = true;
        setRefreshing(true);
        void Promise.allSettled([
          queryClient.refetchQueries({ type: "active" }),
          checkForUpdate(),
        ]).finally(() => {
          busy.current = false;
          setRefreshing(false);
        });
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);

    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled, queryClient]);

  if (!enabled || (distance === 0 && !refreshing)) {
    return null;
  }

  const armed = refreshing || distance >= PULL_THRESHOLD;
  const offset = refreshing ? PULL_THRESHOLD : distance;

  return (
    <div
      role="status"
      data-testid="pull-to-refresh"
      data-state={refreshing ? "refreshing" : armed ? "armed" : "pulling"}
      aria-label={t(
        refreshing ? "pwa.refreshing" : armed ? "pwa.releaseToRefresh" : "pwa.pullToRefresh",
      )}
      className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center"
      style={{ transform: `translateY(calc(env(safe-area-inset-top) + ${offset - 40}px))` }}
    >
      <span
        data-part="indicator"
        className={cn(
          "flex size-10 items-center justify-center rounded-pill border border-line bg-surface shadow-float",
          armed ? "text-primary-700" : "text-ink-muted",
        )}
      >
        {refreshing ? (
          <Icon name="spinner" className="animate-spin" />
        ) : (
          <span
            className="flex"
            style={{ transform: `rotate(${(distance / PULL_THRESHOLD) * 270}deg)` }}
          >
            <Icon name="reset" />
          </span>
        )}
      </span>
    </div>
  );
}
