import type { JSX } from "react";
import { cx } from "@web/booking/ui";

const LAYERS = [
  "M0,46 C240,104 470,4 720,34 C970,64 1190,8 1440,48 L1440,120 L0,120 Z",
  "M0,74 C300,22 560,112 860,62 C1100,22 1280,84 1440,62 L1440,120 L0,120 Z",
  "M0,98 C320,62 620,120 940,90 C1160,68 1320,102 1440,92 L1440,120 L0,120 Z",
] as const;

export function WaveDivider({
  fills,
  flip = false,
  className,
}: {
  readonly fills: readonly [string, string, string];
  readonly flip?: boolean;
  readonly className?: string;
}): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      data-testid="site-wave"
      className={cx(
        "pointer-events-none block h-14 w-full sm:h-20 lg:h-24",
        flip && "-scale-y-100",
        className,
      )}
    >
      {LAYERS.map((path, layer) => (
        <path key={layer} d={path} className={fills[layer]} />
      ))}
    </svg>
  );
}
