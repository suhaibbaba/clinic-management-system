import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { formatDuration } from "@web/shared/lib/duration";

export function IdleGap({ minutes }: { readonly minutes: number }): JSX.Element {
  const { t } = useTranslation();

  return (
    <span data-part="free" className="flex items-center gap-2 px-1 text-micro text-ink-muted">
      <span aria-hidden="true" className="flex-1 border-t border-dashed border-line-strong" />
      {t("appointments.freeGap", { duration: formatDuration(t, minutes) })}
      <span aria-hidden="true" className="flex-1 border-t border-dashed border-line-strong" />
    </span>
  );
}
