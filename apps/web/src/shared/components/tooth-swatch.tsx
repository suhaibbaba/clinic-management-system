import type { JSX } from "react";
import type { ToothStateStyle } from "@web/shared/lib/tooth-state";

export function ToothSwatch({
  style,
  className,
}: {
  readonly style: ToothStateStyle;
  readonly className?: string;
}): JSX.Element {
  return (
    <span
      data-testid="tooth-swatch"
      aria-hidden="true"
      className={className ?? "inline-block size-3.5 shrink-0 rounded-sm border"}
      style={{
        backgroundColor: style.fill,
        borderColor: style.stroke,
        borderStyle: style.dashed ? "dashed" : "solid",
      }}
    />
  );
}
