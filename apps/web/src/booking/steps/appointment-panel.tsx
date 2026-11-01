import type { PublicDoctor } from "@clinic/shared";
import type { JSX, ReactNode } from "react";
import { bookingName, formatLongDate, formatTime } from "@web/booking/format";
import { t } from "@web/booking/i18n";
import { cx, Img } from "@web/booking/ui";

export function AppointmentPanel({
  doctor,
  startsAt,
  children,
}: {
  readonly doctor: PublicDoctor | undefined;
  readonly startsAt: string | undefined;
  readonly children: ReactNode;
}): JSX.Element {
  const name = doctor ? bookingName(doctor.name) : undefined;

  return (
    <div data-testid="appointment-panel" className="flex flex-col">
      <div
        data-part="summary"
        className="flex flex-col gap-3.5 border-b border-primary-100 bg-primary-50 px-5 py-4"
      >
        <p className="text-label font-bold text-primary-700">{t("board.yourAppointment")}</p>

        <div className="flex items-center gap-3">
          <span className="overflow-hidden rounded-panel">
            <Img
              src={doctor?.photoUrl}
              alt=""
              width={48}
              height={48}
              fit="cover"
              fallback={
                <span
                  aria-hidden
                  className="flex size-full items-center justify-center bg-primary-100 text-heading font-bold text-primary-800"
                >
                  {name?.slice(0, 1) ?? "?"}
                </span>
              }
            />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-section font-bold text-primary-900">
              {name ?? t("board.pickDoctor")}
            </span>
            {doctor && (
              <span className="truncate text-label text-ink-muted">
                {bookingName(doctor.specialty)}
              </span>
            )}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-0.5 rounded-panel border border-primary-100 bg-surface px-3 py-2.5">
            <dt className="text-micro text-ink-muted">{t("board.date")}</dt>
            <dd data-testid="appointment-panel-date" className="text-value font-bold text-ink">
              {startsAt ? formatLongDate(startsAt) : "—"}
            </dd>
          </div>
          <div
            className={cx(
              "flex flex-col gap-0.5 rounded-panel border px-3 py-2.5",
              startsAt
                ? "border-primary-600 bg-primary-600 text-ink-inverse"
                : "border-primary-100 bg-surface text-ink",
            )}
          >
            <dt className={cx("text-micro", startsAt ? "text-ink-inverse/80" : "text-ink-muted")}>
              {t("board.time")}
            </dt>
            <dd data-testid="appointment-panel-time" className="text-value font-bold">
              {startsAt ? <bdi dir="ltr">{formatTime(startsAt)}</bdi> : t("board.pickTime")}
            </dd>
          </div>
        </dl>
      </div>

      <div data-part="body" className="flex flex-col gap-4 px-5 pt-4 pb-5">
        {children}
      </div>
    </div>
  );
}
