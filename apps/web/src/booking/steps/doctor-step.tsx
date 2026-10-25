import type { PublicDoctor } from "@clinic/shared";
import type { JSX } from "react";
import { failureKey } from "@web/booking/api";
import { t } from "@web/booking/i18n";
import { Alert, Button, cx, Img, Skeleton } from "@web/booking/ui";
import type { AsyncState } from "@web/booking/use-async";
import { bookingName } from "@web/booking/format";

const initial = (name: string): string => {
  const stripped = name.replace(/^\s*(?:د\.|dr\.?)\s*/i, "").trim(); // i18n-allow: an honorific being matched in stored data, not text on screen

  return (stripped[0] ?? name[0] ?? "").toUpperCase();
};

export function DoctorStep({
  doctors,
  selectedId,
  onSelect,
}: {
  readonly doctors: AsyncState<PublicDoctor[]>;
  readonly selectedId: string | undefined;
  readonly onSelect: (doctor: PublicDoctor) => void;
}): JSX.Element {
  if (doctors.loading) {
    return (
      <ul className="grid gap-3 sm:grid-cols-2">
        {[0, 1].map((index) => (
          <li key={index}>
            <Skeleton className="h-24 rounded-card" />
          </li>
        ))}
      </ul>
    );
  }

  if (doctors.error) {
    return (
      <div className="flex flex-col gap-3">
        <Alert>{t(failureKey(doctors.error))}</Alert>
        <Button variant="secondary" data-testid="doctor-step-retry" onClick={doctors.reload}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  const list = doctors.data ?? [];

  if (list.length === 0) {
    return (
      <Alert tone="info" data-testid="doctor-step-empty">
        {t("doctor.empty")}
      </Alert>
    );
  }

  return (
    <ul data-testid="doctor-step-list" className="grid gap-3 sm:grid-cols-2">
      {list.map((doctor) => {
        const selected = doctor.id === selectedId;
        const name = bookingName(doctor.name);

        return (
          <li key={doctor.id}>
            <button
              type="button"
              data-testid={`doctor-option-${doctor.id}`}
              aria-pressed={selected}
              aria-label={t("doctor.choose", { name })}
              onClick={() => onSelect(doctor)}
              className={cx(
                "relative flex w-full cursor-pointer items-center gap-3.5 rounded-card border-2 p-3.5 text-start",
                "transition-[background-color,border-color,box-shadow] duration-200",
                selected
                  ? "border-primary-600 bg-primary-50"
                  : "border-line bg-surface hover:border-primary-300 hover:shadow-card",
              )}
            >
              <span className="overflow-hidden rounded-panel">
                <Img
                  src={doctor.photoUrl}
                  alt=""
                  width={64}
                  height={64}
                  fit="cover"
                  fallback={
                    <span
                      aria-hidden
                      className="flex size-full items-center justify-center bg-primary-100 text-title font-bold text-primary-800"
                    >
                      {initial(name)}
                    </span>
                  }
                />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-section font-bold text-primary-900">{name}</span>
                <span className="truncate text-label text-ink-muted">{doctor.specialty}</span>
              </span>
              {selected && (
                <span
                  aria-hidden
                  className="absolute end-2.5 top-2.5 inline-flex size-6 items-center justify-center rounded-pill bg-primary-600 text-ink-inverse"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-3.5"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
