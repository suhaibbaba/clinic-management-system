import type { VendorClinicSummary } from "@clinic/shared";
import { Img } from "@clinic/ui/components/img";
import { cn } from "@clinic/ui/lib/cn";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { initials } from "@web/vendor/lib/clinic-actions";
import { isReadOnly } from "@web/vendor/lib/subscription";

export function ClinicMark({
  clinic,
  size = "row",
}: {
  readonly clinic: VendorClinicSummary;
  readonly size?: "row" | "page";
}): JSX.Element {
  const { i18n } = useTranslation();
  const status = clinic.subscription?.status ?? null;
  const tone = clinic.removedAt
    ? "bg-sunken text-ink-muted"
    : isReadOnly(status)
      ? "bg-danger-50 text-danger-700"
      : status === null
        ? "bg-sunken text-ink-muted"
        : "bg-primary-100 text-primary-700";

  const pixels = size === "row" ? 36 : 56;
  const letters = (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center font-extrabold",
        size === "row" ? "size-9 rounded-control text-label" : "size-14 rounded-card text-title",
        tone,
      )}
    >
      {initials(clinic.name, i18n.language)}
    </span>
  );

  if (!clinic.logoUrl) {
    return letters;
  }

  return (
    <Img
      src={clinic.logoUrl}
      alt=""
      width={pixels}
      height={pixels}
      fit="contain"
      fallback={letters}
      className={cn(
        "shrink-0 border border-line bg-surface p-1",
        size === "row" ? "rounded-control" : "rounded-card",
      )}
    />
  );
}
