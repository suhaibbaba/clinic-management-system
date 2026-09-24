import { APPOINTMENT_STATUS, LOOKUP_LIST, type CalendarAppointment } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Avatar, Badge, Icon, Ltr, usePersonName } from "@clinic/ui";
import { minutesOf, toTimeLabel } from "@web/features/appointments/calendar-time";
import { APPOINTMENT_STATUS_STYLES, statusLabelKey } from "@web/features/appointments/status";
import { useLookupLabels } from "@web/features/lookups/queries";
import { cn } from "@clinic/ui/lib/cn";

export interface ScheduleTimelineProps {
  readonly "data-testid"?: string | undefined;
  readonly rows: readonly CalendarAppointment[];
  /** A technician reads the day, but the file behind the name is not theirs. */
  readonly linkPatients: boolean;
  readonly onConfirm: ((appointment: CalendarAppointment) => void) | undefined;
  readonly nowMinute: number | null;
}

const SPENT_STATUSES: readonly string[] = [
  APPOINTMENT_STATUS.COMPLETED,
  APPOINTMENT_STATUS.NO_SHOW,
  APPOINTMENT_STATUS.CANCELLED,
];

// `dir="auto"` so an Arabic name in the English interface keeps its own order.
const PATIENT_NAME = cn(
  "block text-label font-medium text-ink",
  "page-ltr:text-left page-rtl:text-right",
);

export function ScheduleTimeline({
  rows,
  linkPatients,
  onConfirm,
  nowMinute,
  "data-testid": testId = "schedule-timeline",
}: ScheduleTimelineProps): JSX.Element {
  const { t } = useTranslation();
  const doctorName = usePersonName();
  // The clinic's own list, never a constant: a clinic that added "تبييض" sees it here too.
  const typeLabel = useLookupLabels(LOOKUP_LIST.APPOINTMENT_TYPE);
  const ordered = [...rows].sort((a, b) => minutesOf(a.startsAt) - minutesOf(b.startsAt));
  const currentMinute = nowMinute === null ? null : currentStart(ordered, nowMinute);

  return (
    <ol
      data-testid={testId}
      className="flex flex-col gap-2 px-3 pt-3 pb-4 md:px-[22px] md:pb-[22px]"
    >
      {ordered.map((appointment) => {
        const minute = minutesOf(appointment.startsAt);
        const isNow = minute === currentMinute;

        return (
          <li
            key={appointment.id}
            data-testid={`${testId}-appointment-${appointment.id}`}
            className={cn(
              "flex items-center gap-3 rounded-panel border bg-surface px-3 py-2.5",
              SPENT_STATUSES.includes(appointment.status) && "opacity-55",
              isNow ? "border-success-500 shadow-now" : "border-line",
            )}
          >
            {/* A phone has no room to spare for a picture of initials. */}
            <Avatar
              name={`${appointment.patientFirstName} ${appointment.patientLastName}`}
              tintKey={appointment.patientId}
              size={34}
              className="hidden shrink-0 text-meta md:inline-flex"
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Ltr
                  data-testid={`${testId}-time-${appointment.id}`}
                  className="text-label font-bold text-ink tabular-nums"
                >
                  {toTimeLabel(minute)}
                </Ltr>

                {/* Only where there is something to do: a confirm button beside a completed
                    appointment is a button that does nothing. */}
                {appointment.status === APPOINTMENT_STATUS.REQUESTED && (
                  <div className="ms-auto hidden shrink-0 items-center gap-1.5 sm:flex">
                    {onConfirm && (
                      <QuickAction
                        data-testid={`${testId}-confirm-${appointment.id}`}
                        label={t("appointments.actions.confirm")}
                        icon="check"
                        onClick={() => onConfirm(appointment)}
                      />
                    )}
                    <QuickAction
                      data-testid={`${testId}-call-${appointment.id}`}
                      label={t("dashboard.call")}
                      icon="phone"
                      href={`tel:${appointment.patientPhone.replace(/[\s-]/g, "")}`}
                    />
                  </div>
                )}

                <Badge
                  tone={APPOINTMENT_STATUS_STYLES[appointment.status].tone}
                  data-testid={`${testId}-status-${appointment.id}`}
                  className="ms-auto shrink-0 gap-1.5 px-2 text-micro"
                >
                  {t(
                    appointment.status === APPOINTMENT_STATUS.ARRIVED
                      ? "dashboard.schedule.arrived"
                      : statusLabelKey(appointment.status),
                  )}
                </Badge>
              </div>

              {linkPatients ? (
                <Link
                  to={`/patients/${appointment.patientId}`}
                  data-testid={`${testId}-patient-${appointment.id}`}
                  dir="auto"
                  className={cn(
                    PATIENT_NAME,
                    "transition-colors duration-150 hover:text-primary-700",
                  )}
                >
                  {`${appointment.patientFirstName} ${appointment.patientLastName}`}
                </Link>
              ) : (
                <b dir="auto" className={PATIENT_NAME}>
                  {`${appointment.patientFirstName} ${appointment.patientLastName}`}
                </b>
              )}

              <span
                data-testid={`${testId}-detail-${appointment.id}`}
                className="block text-micro text-ink-muted"
              >
                {typeLabel(appointment.type)} ·{" "}
                {t("dashboard.schedule.doctor", { name: doctorName(appointment.doctorName) })}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function QuickAction({
  label,
  icon,
  onClick,
  href,
  "data-testid": testId,
}: {
  readonly "data-testid"?: string | undefined;
  readonly label: string;
  readonly icon: "check" | "phone";
  readonly onClick?: (() => void) | undefined;
  readonly href?: string | undefined;
}): JSX.Element {
  const className = cn(
    "inline-flex size-(--control-h) cursor-pointer items-center justify-center lg:size-(--control-h-sm)",
    "rounded-chip border border-line bg-canvas text-ink-muted",
    "transition-colors duration-150 hover:border-success-700 hover:text-success-700",
  );

  return href === undefined ? (
    <button
      type="button"
      data-testid={testId}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={className}
    >
      <Icon name={icon} className="size-3.5" />
    </button>
  ) : (
    <a href={href} data-testid={testId} aria-label={label} title={label} className={className}>
      <Icon name={icon} className="size-3.5" />
    </a>
  );
}

/** The start "now" falls in: the latest already begun, or the first if the day has not. */
function currentStart(ordered: readonly CalendarAppointment[], nowMinute: number): number | null {
  const starts = ordered.map((row) => minutesOf(row.startsAt));
  const begun = starts.filter((minute) => minute <= nowMinute);

  return begun.at(-1) ?? starts[0] ?? null;
}
