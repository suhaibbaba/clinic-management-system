import type { PortalAccount } from "@clinic/shared";
import { useRef, type JSX } from "react";
import { cx } from "@web/booking/ui";
import { useSegmentThumb } from "@web/site/hooks/use-segment-thumb";
import { useSite } from "@web/site/hooks/use-site";

export function PortalFamilySwitch({
  patients,
  patientId,
  onPick,
}: {
  readonly patients: PortalAccount["patients"];
  readonly patientId: string | undefined;
  readonly onPick: (patientId: string) => void;
}): JSX.Element {
  const { t } = useSite();
  const track = useRef<HTMLDivElement>(null);
  const thumb = useSegmentThumb(track, '[aria-pressed="true"]', patientId);

  return (
    <div
      ref={track}
      role="group"
      aria-label={t("portal.family")}
      data-testid="site-portal-family"
      className="relative isolate inline-flex gap-0.5 rounded-pill border border-primary-600/20 bg-surface/60 p-0.5"
    >
      <span
        aria-hidden
        data-part="thumb"
        style={thumb.style}
        className={cx(
          "pointer-events-none absolute top-0 left-0 rounded-pill bg-surface shadow-pill",
          thumb.animate
            ? "transition-[transform,width] duration-300 ease-out motion-reduce:transition-none"
            : "transition-none",
          !thumb.style && "hidden",
        )}
      />
      {patients.map((entry) => (
        <button
          key={entry.id}
          type="button"
          aria-pressed={entry.id === patientId}
          data-testid={`site-portal-patient-${entry.id}`}
          onClick={() => onPick(entry.id)}
          className="pill-text relative z-10 inline-flex min-h-(--control-h) cursor-pointer items-center gap-1.5 rounded-pill ps-1 pe-3 text-label font-medium text-ink-muted transition-colors duration-200 hover:text-primary-900 aria-pressed:text-primary-900 motion-reduce:transition-none"
        >
          <span
            aria-hidden
            className="inline-flex size-6 items-center justify-center rounded-pill bg-primary-100 text-micro font-bold text-primary-700"
          >
            {entry.firstName.charAt(0)}
          </span>
          {entry.firstName}
        </button>
      ))}
    </div>
  );
}
