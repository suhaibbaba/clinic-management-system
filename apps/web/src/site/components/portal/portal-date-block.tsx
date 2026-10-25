import type { JSX } from "react";
import { cx } from "@web/booking/ui";
import type { PortalDateParts } from "@web/site/lib/portal";

export function PortalDateBlock({
  iso,
  parts,
  muted = false,
}: {
  readonly iso: string;
  readonly parts: PortalDateParts;
  readonly muted?: boolean;
}): JSX.Element {
  return (
    <time
      dateTime={iso}
      data-part="date"
      className={cx(
        "flex w-16 shrink-0 flex-col items-center justify-center rounded-panel border px-1 py-1 tabular-nums",
        muted
          ? "border-line bg-canvas text-ink"
          : "border-primary-100 bg-primary-50 text-primary-800",
      )}
    >
      <span className="text-section font-bold">{parts.day}</span>
      <bdi dir="ltr" className="text-micro text-ink-muted">
        {parts.month}/{parts.year}
      </bdi>
    </time>
  );
}
