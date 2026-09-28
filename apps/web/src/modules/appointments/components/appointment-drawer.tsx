import {
  APPOINTMENT_STATUS,
  appointmentTimingError,
  LOOKUP_LIST,
  type AppointmentStatus,
  occupiesSlot,
  type CalendarAppointment,
} from "@clinic/shared";
import { formatTime, formatDate } from "@web/shared/lib/format";
import { useState, type JSX, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  Drawer,
  Icon,
  Ltr,
  Modal,
  PersonName,
  PhoneLink,
  Textarea,
  useToast,
} from "@clinic/ui";
import { useLookupLabels } from "@web/shared/queries/lookups";
import { useSession } from "@web/shared/providers/session";
import { useCancelAppointment, useConvertToVisit } from "@web/modules/appointments/queries";
import { useAppointmentStep, type AppointmentStep } from "@web/shared/queries/appointments";
import {
  canCancelAppointment,
  canMoveAppointment,
  canOpenVisit,
} from "@web/shared/permissions/appointments";
import {
  APPOINTMENT_STATUS_STYLES,
  CANCELLABLE_STATUSES,
  statusLabelKey,
} from "@web/shared/lib/appointment-status";
import { errorMessageKey } from "@web/shared/lib/api-error";
import { cn } from "@clinic/ui/lib/cn";
import { ellipsis } from "@web/i18n/ellipsis";
import { todayIso, toIsoDate } from "@web/shared/lib/dates";
import { useNowMinute } from "@web/shared/hooks/use-now-minute";

export interface AppointmentDrawerProps {
  readonly "data-testid"?: string | undefined;
  readonly appointment: CalendarAppointment | undefined;
  readonly onClose: () => void;
  readonly onEdit: (appointment: CalendarAppointment) => void;
}

export function AppointmentDrawer({
  appointment,
  onClose,
  onEdit,
  "data-testid": testId = "appointment-drawer",
}: AppointmentDrawerProps): JSX.Element | null {
  const { t } = useTranslation();
  const typeLabel = useLookupLabels(LOOKUP_LIST.APPOINTMENT_TYPE);
  const { can } = useSession();
  const toast = useToast();
  const navigate = useNavigate();

  const step = useAppointmentStep();
  const cancel = useCancelAppointment();
  const convert = useConvertToVisit();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  useNowMinute();

  if (!appointment) {
    return null;
  }

  const status = appointment.status;
  const style = APPOINTMENT_STATUS_STYLES[status];
  const mayOpenVisit = canOpenVisit(can);
  const may = (step: AppointmentStep): boolean => canMoveAppointment(can, step);
  const startsAt = new Date(appointment.startsAt);
  const onTime = (next: AppointmentStatus): boolean =>
    appointmentTimingError(next, {
      day: toIsoDate(startsAt),
      today: todayIso(),
      startsAt,
      now: new Date(),
    }) === null;
  const attendanceOpen = onTime(APPOINTMENT_STATUS.ARRIVED);
  const noShowOpen = onTime(APPOINTMENT_STATUS.NO_SHOW);
  const attendanceHint =
    status !== APPOINTMENT_STATUS.CONFIRMED && status !== APPOINTMENT_STATUS.ARRIVED
      ? null
      : !attendanceOpen
        ? "appointments.attendance.fromDay"
        : status === APPOINTMENT_STATUS.CONFIRMED && !noShowOpen && may("noShow")
          ? "appointments.attendance.afterStart"
          : null;

  const move = async (next: AppointmentStep, successKey: string): Promise<void> => {
    try {
      await step.mutateAsync({ id: appointment.id, step: next });
      toast.success(successKey);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const openVisit = async (): Promise<void> => {
    try {
      const visit = await convert.mutateAsync(appointment.id);
      toast.success("appointments.visit.created");
      onClose();
      navigate(`/patients/${visit.patientId}`);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const submitCancel = async (): Promise<void> => {
    try {
      await cancel.mutateAsync({ id: appointment.id, reason: cancelReason.trim() });
      toast.success("appointments.cancel.done");
      setCancelOpen(false);
      setCancelReason("");
      onClose();
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const busy = step.isPending || cancel.isPending || convert.isPending;
  const editable = occupiesSlot(status) && status !== APPOINTMENT_STATUS.COMPLETED;
  const cancellable = CANCELLABLE_STATUSES.includes(status) && canCancelAppointment(can);

  return (
    <>
      <Drawer
        data-testid={testId}
        open
        onOpenChange={(next) => !next && onClose()}
        title={appointment.patientName}
        descriptionKey="appointments.title"
        footer={
          <div className="flex flex-wrap items-center gap-2">
            {status === APPOINTMENT_STATUS.REQUESTED && may("confirm") && (
              <Button
                icon={<Icon name="check" />}
                data-testid={`${testId}-confirm`}
                isLoading={busy}
                onClick={() => void move("confirm", "appointments.updated")}
              >
                {t("appointments.actions.confirm")}
              </Button>
            )}

            {status === APPOINTMENT_STATUS.CONFIRMED && attendanceOpen && may("arrived") && (
              <Button
                icon={<Icon name="user-plus" />}
                data-testid={`${testId}-arrived`}
                isLoading={busy}
                onClick={() => void move("arrived", "appointments.updated")}
              >
                {t("appointments.actions.arrived")}
              </Button>
            )}

            {status === APPOINTMENT_STATUS.ARRIVED && attendanceOpen && mayOpenVisit && (
              <Button
                icon={<Icon name="stethoscope" />}
                data-testid={`${testId}-open-visit`}
                isLoading={busy}
                onClick={() => void openVisit()}
              >
                {t("appointments.actions.openVisit")}
              </Button>
            )}

            {status === APPOINTMENT_STATUS.ARRIVED &&
              attendanceOpen &&
              !mayOpenVisit &&
              may("start") && (
                <Button
                  icon={<Icon name="activity" />}
                  data-testid={`${testId}-start`}
                  isLoading={busy}
                  onClick={() => void move("start", "appointments.updated")}
                >
                  {t("appointments.actions.start")}
                </Button>
              )}

            {(status === APPOINTMENT_STATUS.IN_PROGRESS || status === APPOINTMENT_STATUS.ARRIVED) &&
              attendanceOpen &&
              may("complete") && (
                <Button
                  variant="secondary"
                  icon={<Icon name="check" />}
                  data-testid={`${testId}-complete`}
                  isLoading={busy}
                  onClick={() => void move("complete", "appointments.updated")}
                >
                  {t("appointments.actions.complete")}
                </Button>
              )}

            {status === APPOINTMENT_STATUS.CONFIRMED && noShowOpen && may("noShow") && (
              <Button
                variant="secondary"
                data-testid={`${testId}-no-show`}
                isLoading={busy}
                onClick={() => void move("noShow", "appointments.updated")}
              >
                {t("appointments.actions.noShow")}
              </Button>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={style.tone} data-testid={`${testId}-status`}>
              {t(statusLabelKey(status))}
            </Badge>
            <Badge data-testid={`${testId}-type`}>{typeLabel(appointment.type)}</Badge>
            {appointment.visitId && (
              <Badge tone="success" data-testid={`${testId}-visit`}>
                {t("appointments.visit.existing")}
              </Badge>
            )}
          </div>

          {attendanceHint && (
            <p data-testid={`${testId}-attendance-hint`} className="text-meta text-ink-muted">
              {t(attendanceHint)}
            </p>
          )}

          <dl
            data-testid={`${testId}-details`}
            className="grid grid-cols-2 gap-x-4 gap-y-3 text-value"
          >
            <Field label={t("appointments.date")}>{formatDate(appointment.startsAt)}</Field>
            <Field label={t("appointments.time")}>
              <Ltr className="tabular-nums">
                {formatTime(appointment.startsAt)} – {formatTime(appointment.endsAt)}
              </Ltr>
            </Field>
            <Field label={t("appointments.doctor")}>
              <PersonName name={appointment.doctorName} />
            </Field>
            <Field label={t("appointments.patient")}>
              <span className="flex flex-wrap items-baseline gap-2">
                <Link
                  to={`/patients/${appointment.patientId}`}
                  data-testid={`${testId}-open-file`}
                  title={t("appointments.actions.openFile")}
                  onClick={onClose}
                  className="font-medium text-primary-600 hover:underline"
                >
                  {appointment.patientName}
                </Link>
                <Ltr className="tabular-nums text-ink-subtle">{appointment.patientFileNumber}</Ltr>
              </span>
            </Field>
            <Field label={t("patients.phone")}>
              <PhoneLink value={appointment.patientPhone} data-testid={`${testId}-phone`} />
            </Field>
            {appointment.reason && (
              <Field wide label={t("appointments.reason")}>
                {appointment.reason}
              </Field>
            )}
            {appointment.notes && (
              <Field wide label={t("appointments.notes")}>
                {appointment.notes}
              </Field>
            )}
            {appointment.cancelledReason && (
              <Field wide label={t("appointments.cancel.reason")}>
                {appointment.cancelledReason}
              </Field>
            )}
          </dl>

          {(editable || cancellable) && (
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              {editable && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Icon name="edit" />}
                  data-testid={`${testId}-reschedule`}
                  onClick={() => onEdit(appointment)}
                >
                  {t("appointments.actions.reschedule")}
                </Button>
              )}
              {cancellable && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Icon name="x" />}
                  data-testid={`${testId}-cancel`}
                  disabled={busy}
                  onClick={() => setCancelOpen(true)}
                >
                  {t("appointments.actions.cancel")}
                </Button>
              )}
            </div>
          )}
        </div>
      </Drawer>

      <Modal
        data-testid="appointment-cancel-modal"
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="appointments.cancel.title"
        footer={
          <>
            <Button
              variant="secondary"
              data-testid="appointment-cancel-dismiss"
              onClick={() => setCancelOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              icon={<Icon name="x" />}
              data-testid="appointment-cancel-confirm"
              isLoading={cancel.isPending}
              disabled={cancelReason.trim().length < 3}
              onClick={() => void submitCancel()}
            >
              {t("appointments.cancel.confirm")}
            </Button>
          </>
        }
      >
        <label htmlFor="cancel-reason" className="mb-1.5 block text-label font-medium text-ink">
          {t("appointments.cancel.reason")}
        </label>
        <Textarea
          id="cancel-reason"
          data-testid="appointment-cancel-reason"
          rows={3}
          placeholder={ellipsis(t("appointments.cancel.reasonPlaceholder"))}
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
        />
      </Modal>
    </>
  );
}

function Field({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className={cn("min-w-0", wide && "col-span-2")}>
      <dt className="text-meta text-ink-muted">{label}</dt>
      <dd className="mt-0.5 min-w-0 text-ink">{children}</dd>
    </div>
  );
}
