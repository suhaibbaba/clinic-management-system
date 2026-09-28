import type { CalendarAppointment } from "@clinic/shared";
import type { JSX, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Ltr } from "@clinic/ui";
import { cn } from "@clinic/ui/lib/cn";
import { formatTime } from "@web/shared/lib/format";
import { APPOINTMENT_STATUS_STYLES } from "@web/shared/lib/appointment-status";

export interface AppointmentLineProps {
  readonly "data-testid": string;
  readonly appointment: CalendarAppointment;
  readonly onOpen: () => void;
  readonly trailing?: ReactNode;
  readonly title?: string | undefined;
  readonly target?: boolean | undefined;
}

export function AppointmentLine({
  appointment,
  onOpen,
  trailing,
  title,
  target = false,
  "data-testid": testId,
}: AppointmentLineProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onOpen}
      data-appointment={appointment.id}
      data-testid={testId}
      title={title}
      aria-label={`${formatTime(appointment.startsAt)} — ${appointment.patientName} — ${t(
        `appointments.statuses.${appointment.status}`,
      )}`}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 rounded-panel border px-2.5 text-start text-meta",
        "transition-shadow duration-150 hover:shadow-card",
        target ? "min-h-(--control-h)" : "min-h-(--control-h-sm) py-1",
        APPOINTMENT_STATUS_STYLES[appointment.status].block,
      )}
    >
      <Ltr className="shrink-0 font-medium tabular-nums">{formatTime(appointment.startsAt)}</Ltr>
      <span className="truncate">{appointment.patientName}</span>
      {trailing !== undefined && (
        <span className="ms-auto flex shrink-0 items-center gap-1.5 text-micro opacity-80">
          {trailing}
        </span>
      )}
    </button>
  );
}
