import { useId, type JSX } from "react";
import { cx } from "@web/booking/ui";

const LAYER = "pointer-events-none absolute block w-full ltr:-scale-x-100";

export function FooterCurtain({ className }: { readonly className?: string }): JSX.Element {
  const sheet = useId();
  const haze = useId();
  const left = useId();
  const right = useId();

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1024 480"
      preserveAspectRatio="none"
      fill="none"
      className={cx(LAYER, className)}
    >
      <defs>
        <linearGradient id={sheet} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--color-surface)" }} />
          <stop
            offset="1"
            style={{
              stopColor: "color-mix(in oklab, var(--color-primary-50) 70%, var(--color-surface))",
            }}
          />
        </linearGradient>
        <linearGradient id={haze} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--color-primary-200)", stopOpacity: 0.75 }} />
          <stop offset="0.5" style={{ stopColor: "var(--color-primary-100)", stopOpacity: 0.7 }} />
          <stop offset="1" style={{ stopColor: "var(--color-primary-50)", stopOpacity: 0 }} />
        </linearGradient>
        <linearGradient id={left} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--color-primary-500)" }} />
          <stop offset="0.45" style={{ stopColor: "var(--color-primary-300)" }} />
          <stop offset="1" style={{ stopColor: "var(--color-primary-100)" }} />
        </linearGradient>
        <linearGradient id={right} x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0" style={{ stopColor: "var(--color-primary-100)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--color-primary-300)" }} />
          <stop
            offset="1"
            style={{
              stopColor: "color-mix(in oklab, var(--color-primary-500), var(--color-primary-600))",
            }}
          />
        </linearGradient>
      </defs>
      <path
        d="M0 -1H1024V474C940 390 830 327 700 327C590 327 510 368 400 368C230 368 90 290 0 183Z"
        fill={`url(#${sheet})`}
      />
      <path d="M0 14C28 160 150 310 345 366C200 340 70 245 0 120Z" fill={`url(#${haze})`} />
      <path
        d="M0 120C70 245 200 340 345 366C360 367 380 368 400 368C230 368 90 290 0 183Z"
        fill={`url(#${left})`}
      />
      <path
        d="M700 327C840 329 945 385 1024 444V474C940 390 830 327 700 327Z"
        fill={`url(#${right})`}
      />
    </svg>
  );
}

export function FooterBasin({ className }: { readonly className?: string }): JSX.Element {
  const rim = useId();

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1024 60"
      preserveAspectRatio="none"
      className={cx(LAYER, className)}
    >
      <defs>
        <linearGradient id={rim} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--color-primary-200)" }} />
          <stop offset="0.45" style={{ stopColor: "var(--color-primary-100)" }} />
          <stop offset="1" style={{ stopColor: "var(--color-primary-200)" }} />
        </linearGradient>
      </defs>
      <path d="M0 9C300 50 700 56 1024 4V20C700 64 300 58 0 22Z" fill={`url(#${rim})`} />
      <path d="M0 22C300 58 700 64 1024 20V61H0Z" className="fill-(--site-footer-panel)" />
    </svg>
  );
}

export function FooterRibbon({ className }: { readonly className?: string }): JSX.Element {
  const band = useId();
  const fold = useId();

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1024 100"
      preserveAspectRatio="none"
      className={cx(LAYER, className)}
    >
      <defs>
        <linearGradient id={band} x1="0" y1="0" x2="1" y2="0">
          <stop
            offset="0"
            style={{
              stopColor: "color-mix(in oklab, var(--color-primary-500), var(--color-primary-600))",
            }}
          />
          <stop
            offset="1"
            style={{
              stopColor:
                "color-mix(in oklab, var(--color-primary-500) 85%, var(--color-primary-300))",
            }}
          />
        </linearGradient>
        <linearGradient id={fold} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--color-primary-600)", stopOpacity: 0.1 }} />
          <stop offset="1" style={{ stopColor: "var(--color-primary-600)", stopOpacity: 0.7 }} />
        </linearGradient>
      </defs>
      <path
        d="M0 51C100 20 230 16 330 17C520 19 620 30 760 29C880 28 940 17 1024 10V53C900 63 800 59 700 54C560 46 420 40 300 40C190 42 90 60 0 89Z"
        fill={`url(#${band})`}
      />
      <path
        d="M230 18C330 14 420 18 520 22C620 27 690 30 760 29C640 33 560 25 430 23C340 22 270 24 200 33Z"
        fill={`url(#${fold})`}
      />
    </svg>
  );
}

export function FooterSmile({ className }: { readonly className?: string }): JSX.Element {
  const stroke = useId();

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 230 24"
      preserveAspectRatio="none"
      className={cx("pointer-events-none block ltr:-scale-x-100", className)}
    >
      <defs>
        <linearGradient id={stroke} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--color-primary-300)", stopOpacity: 0.3 }} />
          <stop offset="0.55" style={{ stopColor: "var(--color-primary-500)" }} />
          <stop offset="1" style={{ stopColor: "var(--color-primary-600)", stopOpacity: 0.5 }} />
        </linearGradient>
      </defs>
      <path d="M0 4C70 22 160 22 230 0C165 30 65 28 0 4Z" fill={`url(#${stroke})`} />
    </svg>
  );
}

export function ToothRibbon({ className }: { readonly className?: string }): JSX.Element {
  const ink = useId();

  return (
    <svg aria-hidden="true" viewBox="0 0 172 200" className={cx("pointer-events-none", className)}>
      <defs>
        <linearGradient id={ink} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--color-primary-200)" }} />
          <stop offset="0.6" style={{ stopColor: "var(--color-primary-100)" }} />
          <stop offset="1" style={{ stopColor: "var(--color-primary-200)", stopOpacity: 0.7 }} />
        </linearGradient>
      </defs>
      <path
        d="M112 22C80 28 62 2 34 3C8 4 -2 28 1 54C4 88 22 110 32 140C40 164 46 186 58 196C62 176 66 152 78 131C66 142 60 158 56 176C46 152 40 128 28 104C18 84 10 62 14 42C18 20 36 14 54 20C74 28 92 34 112 22Z"
        fill={`url(#${ink})`}
      />
      <path
        d="M82 28C100 6 130 2 148 10C166 18 174 40 171 62C168 96 152 122 138 150C128 170 118 188 106 196C110 178 106 158 100 138C110 150 114 162 116 174C130 156 142 132 150 110C158 90 164 66 158 46C150 18 112 18 82 28Z"
        fill={`url(#${ink})`}
      />
    </svg>
  );
}
