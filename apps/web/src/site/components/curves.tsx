import { useId, type JSX } from "react";
import { cx } from "@web/booking/ui";

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

export function HeroDipRibbon({ className }: { readonly className?: string }): JSX.Element {
  const band = useId();

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      fill="none"
      className={cx("pointer-events-none ltr:-scale-x-100", className)}
    >
      <defs>
        <linearGradient id={band} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--color-primary-200)", stopOpacity: 0.2 }} />
          <stop offset="0.5" style={{ stopColor: "var(--color-primary-500)", stopOpacity: 0.7 }} />
          <stop offset="1" style={{ stopColor: "var(--color-primary-700)", stopOpacity: 0.9 }} />
        </linearGradient>
      </defs>
      <path
        d="M0 91C25 94 45 94 60 87C72 81 86 74 100 72L100 79C86 81 72 88 60 93C45 100 25 100 0 96Z"
        style={{ fill: "var(--color-primary-100)", fillOpacity: 0.7 }}
      />
      <path
        d="M0 89C25 91 45 87 60 77C72 69 86 61 100 59L100 71C86 72 72 79 60 86C45 94 25 93 0 90Z"
        fill={`url(#${band})`}
      />
    </svg>
  );
}

export function PhotoWave({ className }: { readonly className?: string }): JSX.Element {
  const mist = useId();
  const trail = useId();
  const band = useId();

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 851 460"
      preserveAspectRatio="none"
      fill="none"
      className={cx("pointer-events-none ltr:-scale-x-100", className)}
    >
      <defs>
        <radialGradient
          id={mist}
          gradientUnits="userSpaceOnUse"
          cx="0"
          cy="0"
          r="1"
          gradientTransform="translate(851 372) scale(520 190)"
        >
          <stop offset="0" style={{ stopColor: "var(--color-primary-100)" }} />
          <stop offset="1" style={{ stopColor: "var(--color-primary-100)", stopOpacity: 0 }} />
        </radialGradient>
        <linearGradient id={trail} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--color-primary-100)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--color-primary-200)" }} />
          <stop offset="1" style={{ stopColor: "var(--color-primary-200)", stopOpacity: 0.2 }} />
        </linearGradient>
        <linearGradient id={band} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--color-primary-500)" }} />
          <stop offset="0.45" style={{ stopColor: "var(--color-primary-600)" }} />
          <stop
            offset="1"
            style={{
              stopColor:
                "color-mix(in oklab, var(--color-primary-500) 75%, var(--color-primary-300))",
            }}
          />
        </linearGradient>
      </defs>
      <path
        d="M0 346C90 410 190 436 290 436C430 436 500 395 590 365C680 330 760 306 851 304V461H0Z"
        style={{ fill: "var(--color-surface)" }}
      />
      <path
        d="M851 360C760 350 690 362 610 388C520 418 430 444 330 452V570H851Z"
        fill={`url(#${mist})`}
      />
      <path
        d="M0 356C90 420 190 446 290 446C320 446 350 443 375 439C330 454 260 460 200 457C120 452 50 428 0 394Z"
        fill={`url(#${trail})`}
      />
      <path
        d="M330 452C420 440 500 412 590 374C680 338 760 314 851 312V372C760 358 690 368 610 392C520 420 430 444 330 452Z"
        fill={`url(#${band})`}
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

export function GlassLobe({ className }: { readonly className?: string }): JSX.Element {
  const glass = useId();

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      fill="none"
      className={cx("pointer-events-none ltr:-scale-x-100", className)}
    >
      <defs>
        <linearGradient id={glass} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" style={{ stopColor: "var(--color-primary-50)", stopOpacity: 0.95 }} />
          <stop offset="0.45" style={{ stopColor: "var(--color-primary-100)", stopOpacity: 0.9 }} />
          <stop offset="1" style={{ stopColor: "var(--color-primary-200)", stopOpacity: 0.9 }} />
        </linearGradient>
      </defs>
      <path
        d="M76 -2C89 -3 102 4 104 18C106 38 102 68 82 104"
        stroke="var(--color-primary-200)"
        strokeWidth="1.5"
        opacity="0.8"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M70 0C80 -1 92 2 98 8C102 14 101 30 100 44C99 64 92 84 72 102L66 100C86 84 94 62 93 42C92 24 84 8 74 0Z"
        fill={`url(#${glass})`}
      />
      <path
        d="M70 0C80 -1 92 2 98 8C102 14 101 30 100 44C99 64 92 84 72 102"
        stroke="var(--color-surface)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M74 0C84 8 92 24 93 42C94 62 86 84 66 100"
        stroke="var(--color-primary-300)"
        strokeWidth="1.5"
        opacity="0.7"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function TitleStroke({ className }: { readonly className?: string }): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 206 16"
      preserveAspectRatio="none"
      className={cx("pointer-events-none block ltr:-scale-x-100", className)}
    >
      <path d="M0 15C60 0 140 -2 206 8C140 2 60 4 0 15Z" fill="currentColor" />
    </svg>
  );
}
