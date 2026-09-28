import type { JSX } from "react";
import { Ltr } from "@clinic/ui";

export function Quantity({
  value,
  unit,
}: {
  readonly value: string;
  readonly unit: string;
}): JSX.Element {
  return (
    <span className="flex items-baseline gap-1.5">
      <Ltr className="tabular-nums">{value}</Ltr>
      <span className="text-label font-normal text-ink-muted">{unit}</span>
    </span>
  );
}
