import type { JSX, ReactNode } from "react";
import { cx } from "@web/booking/ui";
import type { PortalTone } from "@web/site/lib/portal";

const TONES: Record<PortalTone, { readonly pill: string; readonly dot: string }> = {
  success: { pill: "bg-success-50 text-success-800", dot: "bg-success-600" },
  warning: { pill: "bg-warning-50 text-warning-800", dot: "bg-warning-500" },
  neutral: { pill: "bg-neutral-100 text-ink-muted", dot: "bg-neutral-500" },
  primary: { pill: "bg-primary-50 text-primary-800", dot: "bg-primary-600" },
};

export function PortalStatusPill({
  tone,
  children,
}: {
  readonly tone: PortalTone;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <span
      data-part="status"
      data-tone={tone}
      className={cx(
        "pill-text inline-flex min-h-(--control-h-sm) items-center gap-1.5 rounded-pill px-2.5 text-meta font-medium whitespace-nowrap",
        TONES[tone].pill,
      )}
    >
      <span aria-hidden className={cx("size-1.5 rounded-pill", TONES[tone].dot)} />
      {children}
    </span>
  );
}
