import type { JSX } from "react";
import { cx } from "@web/booking/ui";

export function SideCurve({ className }: { readonly className?: string }): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cx("pointer-events-none text-surface ltr:-scale-x-100", className)}
    >
      <path
        d="M100 0H55C24 0 6 14 6 36C6 60 36 72 58 84C68 90 72 95 68 100H100Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function BottomCurve({ className }: { readonly className?: string }): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      className={cx("pointer-events-none block w-full", className)}
    >
      <path d="M0 120V64C220 122 430 22 760 48S1210 124 1440 34V120Z" fill="currentColor" />
    </svg>
  );
}
