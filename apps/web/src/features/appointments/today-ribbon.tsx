import { APPOINTMENT_STATUS, type CalendarAppointment } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { Button, Icon, Ltr, PersonName, useToast } from "@clinic/ui";
import { useAppointmentStep } from "@web/features/appointments/queries";
import { APPOINTMENT_STATUS_STYLES } from "@web/features/appointments/status";
import { minutesOf, toTimeLabel } from "@web/features/appointments/calendar-time";
import { errorMessageKey } from "@web/lib/api-error";
import { cn } from "@clinic/ui/lib/cn";

export interface TodayRibbonProps {
  readonly "data-testid"?: string | undefined;
  readonly appointments: readonly CalendarAppointment[];
  readonly onOpen: (appointment: CalendarAppointment) => void;
  /** Reception marks arrivals; a technician sees the ribbon but no button. */
  readonly canMark: boolean;
}

export function TodayRibbon({
  appointments,
  onOpen,
  canMark,
  "data-testid": testId = "today-ribbon",
}: TodayRibbonProps): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const step = useAppointmentStep();

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const upcoming = appointments
    .filter(
      (entry) =>
        entry.status === APPOINTMENT_STATUS.CONFIRMED ||
        entry.status === APPOINTMENT_STATUS.REQUESTED ||
        entry.status === APPOINTMENT_STATUS.ARRIVED,
    )
    .filter((entry) => minutesOf(entry.startsAt) >= nowMinutes - 60)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 6);

  const markArrived = async (id: string): Promise<void> => {
    try {
      await step.mutateAsync({ id, step: "arrived" });
      toast.success("appointments.updated");
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <section
      data-testid={testId}
      aria-label={t("appointments.ribbon.title")}
      className="border border-line rounded-card bg-surface p-4 shadow-card"
    >
      <div className="mb-3 flex items-center gap-2">
        <Icon name="clock" className="size-4 text-primary-600" />
        <h2 className="text-heading font-medium text-ink">{t("appointments.ribbon.title")}</h2>
      </div>

      {upcoming.length === 0 ? (
        <p data-testid={`${testId}-empty`} className="text-label text-ink-muted">
          {t("appointments.ribbon.none")}
        </p>
      ) : (
        <ul
          data-testid={`${testId}-list`}
          className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]"
        >
          {upcoming.map((appointment) => {
            const style = APPOINTMENT_STATUS_STYLES[appointment.status];
            const arrived = appointment.status === APPOINTMENT_STATUS.ARRIVED;

            return (
              <li
                key={appointment.id}
                data-testid={`${testId}-item-${appointment.id}`}
                className="shrink-0"
              >
                <div
                  className={cn("flex w-52 flex-col gap-1.5 rounded-panel border p-3", style.block)}
                >
                  <button
                    type="button"
                    data-testid={`${testId}-open-${appointment.id}`}
                    onClick={() => onOpen(appointment)}
                    className="cursor-pointer text-start"
                  >
                    <Ltr className="text-value font-medium tabular-nums">
                      {toTimeLabel(minutesOf(appointment.startsAt))}
                    </Ltr>
                    <span className="block truncate text-label font-medium">
                      {appointment.patientName}
                    </span>
                    <span className="block truncate text-micro opacity-80">
                      <PersonName name={appointment.doctorName} />
                    </span>
                  </button>

                  {canMark && !arrived && (
                    <Button
                      size="sm"
                      variant="secondary"
                      data-testid={`${testId}-arrived-${appointment.id}`}
                      isLoading={step.isPending}
                      onClick={() => void markArrived(appointment.id)}
                    >
                      {t("appointments.actions.arrived")}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
