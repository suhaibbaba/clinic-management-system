import { useId, type JSX } from "react";
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

export function HeroSwoosh({ className }: { readonly className?: string }): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 600 600"
      preserveAspectRatio="none"
      fill="none"
      className={cx("pointer-events-none text-surface rtl:-scale-x-100", className)}
    >
      <path
        d="M600 40C380 140 260 330 330 600"
        stroke="currentColor"
        strokeWidth="60"
        opacity="0.7"
      />
      <path
        d="M600 140C430 230 360 400 420 600"
        stroke="currentColor"
        strokeWidth="24"
        opacity="0.5"
      />
    </svg>
  );
}

export function HeroRibbon({ className }: { readonly className?: string }): JSX.Element {
  const band = useId();
  const sheen = useId();

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      fill="none"
      className={cx("pointer-events-none ltr:-scale-x-100", className)}
    >
      <defs>
        <linearGradient id={band} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" style={{ stopColor: "var(--color-primary-100)", stopOpacity: 0.2 }} />
          <stop offset="0.3" style={{ stopColor: "var(--color-primary-200)", stopOpacity: 0.85 }} />
          <stop
            offset="0.75"
            style={{ stopColor: "var(--color-primary-500)", stopOpacity: 0.85 }}
          />
          <stop offset="1" style={{ stopColor: "var(--color-primary-700)", stopOpacity: 0.6 }} />
        </linearGradient>
        <linearGradient id={sheen} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--color-surface)", stopOpacity: 0 }} />
          <stop offset="0.5" style={{ stopColor: "var(--color-surface)", stopOpacity: 0.7 }} />
          <stop offset="1" style={{ stopColor: "var(--color-surface)", stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path
        d="M96 -2C109 24 112 50 107 71C103 86 96 96 90 103"
        stroke="var(--color-primary-200)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M86.5 -2C97.5 22 101.5 46 97.5 66.5C94.5 82 88 93 81.5 102L80 102C86 93 92.5 82 95.5 66.5C99.5 46 95.5 22 84.5 -2Z"
        fill="var(--color-surface)"
        opacity="0.9"
      />
      <path
        d="M87 -2C98 22 102 46 98 66.5C95 82 88.5 93 82 102L88 102C95 92 102 80 104.5 64C107.5 43 102 20 91 -2Z"
        fill={`url(#${band})`}
      />
      <path
        d="M89 6C98 26 101.5 48 98.5 66C96 80 91 90 86 97C92.5 89 98.5 78 101 64C104 46 99.5 25 89 6Z"
        fill={`url(#${sheen})`}
      />
    </svg>
  );
}

export function HeroWave({ className }: { readonly className?: string }): JSX.Element {
  const fill = useId();

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 600 160"
      preserveAspectRatio="none"
      className={cx("pointer-events-none ltr:-scale-x-100", className)}
    >
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--color-primary-500)", stopOpacity: 0.35 }} />
          <stop offset="1" style={{ stopColor: "var(--color-primary-100)", stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path d="M0 40C160 120 360 150 600 110V160H0Z" fill={`url(#${fill})`} />
    </svg>
  );
}
