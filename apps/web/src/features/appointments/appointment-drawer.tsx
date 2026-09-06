import { APPOINTMENT_STATUS, type CalendarAppointment } from '@clinic/shared';
import { useState, type JSX, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Badge, Button, Drawer, Icon, Modal, Textarea, useToast } from '@web/components/ui';
import { useSession } from '@web/features/auth/session';
import {
  useAppointmentStep,
  useCancelAppointment,
  useConvertToVisit,
  type AppointmentStep,
} from '@web/features/appointments/queries';
import { canOpenVisit } from '@web/features/appointments/permissions';
import {
  APPOINTMENT_STATUS_STYLES,
  CANCELLABLE_STATUSES,
  statusLabelKey,
  typeLabelKey,
} from '@web/features/appointments/status';
import { minutesOf, toTimeLabel } from '@web/features/appointments/calendar-time';
import { errorMessageKey } from '@web/lib/api-error';
import { formatDate } from '@web/lib/format';

export interface AppointmentDrawerProps {
  readonly appointment: CalendarAppointment | undefined;
  readonly onClose: () => void;
  readonly onEdit: (appointment: CalendarAppointment) => void;
}

/**
 * One appointment, with the buttons that move it along.
 *
 * The action row is derived from the status rather than always shown: an
 * appointment that has been cancelled has nothing to confirm, and a button
 * that only ever returns 400 is worse than no button. The transitions the UI
 * offers come from the same table in `@clinic/shared` that the API validates
 * against, so the two cannot drift.
 */
export function AppointmentDrawer({
  appointment,
  onClose,
  onEdit,
}: AppointmentDrawerProps): JSX.Element | null {
  const { t } = useTranslation();
  const { user } = useSession();
  const toast = useToast();
  const navigate = useNavigate();

  const step = useAppointmentStep();
  const cancel = useCancelAppointment();
  const convert = useConvertToVisit();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  if (!appointment) {
    return null;
  }

  const status = appointment.status;
  const style = APPOINTMENT_STATUS_STYLES[status];
  const mayOpenVisit = user ? canOpenVisit(user.role) : false;

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
      toast.success('appointments.visit.created');
      onClose();
      // Straight into the file, on the visits tab — the point of one click.
      navigate(`/patients/${visit.patientId}`);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const submitCancel = async (): Promise<void> => {
    try {
      await cancel.mutateAsync({ id: appointment.id, reason: cancelReason.trim() });
      toast.success('appointments.cancel.done');
      setCancelOpen(false);
      setCancelReason('');
      onClose();
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const busy = step.isPending || cancel.isPending || convert.isPending;

  return (
    <>
      <Drawer
        open
        onOpenChange={(next) => !next && onClose()}
        title={appointment.patientName}
        descriptionKey="appointments.title"
        footer={
          <div className="flex flex-wrap items-center gap-2">
            {status === APPOINTMENT_STATUS.REQUESTED && (
              <Button
                icon={<Icon name="check" />}
                isLoading={busy}
                onClick={() => void move('confirm', 'appointments.updated')}
              >
                {t('appointments.actions.confirm')}
              </Button>
            )}

            {status === APPOINTMENT_STATUS.CONFIRMED && (
              <Button
                icon={<Icon name="user-plus" />}
                isLoading={busy}
                onClick={() => void move('arrived', 'appointments.updated')}
              >
                {t('appointments.actions.arrived')}
              </Button>
            )}

            {status === APPOINTMENT_STATUS.ARRIVED && mayOpenVisit && (
              <Button
                icon={<Icon name="stethoscope" />}
                isLoading={busy}
                onClick={() => void openVisit()}
              >
                {t('appointments.actions.openVisit')}
              </Button>
            )}

            {status === APPOINTMENT_STATUS.ARRIVED && !mayOpenVisit && (
              <Button
                icon={<Icon name="activity" />}
                isLoading={busy}
                onClick={() => void move('start', 'appointments.updated')}
              >
                {t('appointments.actions.start')}
              </Button>
            )}

            {(status === APPOINTMENT_STATUS.IN_PROGRESS ||
              status === APPOINTMENT_STATUS.ARRIVED) && (
              <Button
                variant="secondary"
                icon={<Icon name="check" />}
                isLoading={busy}
                onClick={() => void move('complete', 'appointments.updated')}
              >
                {t('appointments.actions.complete')}
              </Button>
            )}

            {status === APPOINTMENT_STATUS.CONFIRMED && (
              <Button
                variant="secondary"
                isLoading={busy}
                onClick={() => void move('noShow', 'appointments.updated')}
              >
                {t('appointments.actions.noShow')}
              </Button>
            )}

            {CANCELLABLE_STATUSES.includes(status) && (
              <Button
                variant="ghost"
                icon={<Icon name="x" />}
                disabled={busy}
                onClick={() => setCancelOpen(true)}
              >
                {t('appointments.actions.cancel')}
              </Button>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={style.tone}>{t(statusLabelKey(status))}</Badge>
            <Badge>{t(typeLabelKey(appointment.type))}</Badge>
            {appointment.visitId && (
              <Badge tone="success">{t('appointments.visit.existing')}</Badge>
            )}
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-value">
            <Field label={t('appointments.date')}>{formatDate(appointment.startsAt)}</Field>
            <Field label={t('appointments.time')}>
              <span dir="ltr" className="tabular-nums">
                {toTimeLabel(minutesOf(appointment.startsAt))} –{' '}
                {toTimeLabel(minutesOf(appointment.endsAt))}
              </span>
            </Field>
            <Field label={t('appointments.doctor')}>{appointment.doctorName}</Field>
            <Field label={t('appointments.patient')}>
              {/* A gap rather than a margin: the file number is an LTR island,
                  so a logical margin on it resolves against *its* direction and
                  lands on the far side — the name and the number came out
                  glued together. */}
              <span className="flex flex-wrap items-baseline gap-2">
                <span>{appointment.patientName}</span>
                <span dir="ltr" className="tabular-nums text-ink-subtle">
                  {appointment.patientFileNumber}
                </span>
              </span>
            </Field>
            <Field label={t('patients.phone')}>
              <span dir="ltr" className="tabular-nums">
                {appointment.patientPhone}
              </span>
            </Field>
            {appointment.reason && (
              <Field label={t('appointments.reason')}>{appointment.reason}</Field>
            )}
            {appointment.notes && (
              <Field label={t('appointments.notes')}>{appointment.notes}</Field>
            )}
            {appointment.cancelledReason && (
              <Field label={t('appointments.cancel.reason')}>{appointment.cancelledReason}</Field>
            )}
          </dl>

          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <Button
              variant="secondary"
              size="sm"
              icon={<Icon name="edit" />}
              onClick={() => onEdit(appointment)}
            >
              {t('appointments.actions.reschedule')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Icon name="user" />}
              onClick={() => {
                onClose();
                navigate(`/patients/${appointment.patientId}`);
              }}
            >
              {t('appointments.actions.openFile')}
            </Button>
          </div>
        </div>
      </Drawer>

      {/* Cancelling states a reason — the API refuses one without it, and the
          reason is what the next person reading the file needs. */}
      <Modal
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="appointments.cancel.title"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              isLoading={cancel.isPending}
              disabled={cancelReason.trim().length < 3}
              onClick={() => void submitCancel()}
            >
              {t('appointments.cancel.confirm')}
            </Button>
          </>
        }
      >
        <label htmlFor="cancel-reason" className="mb-1.5 block text-label font-medium text-ink">
          {t('appointments.cancel.reason')}
        </label>
        <Textarea
          id="cancel-reason"
          rows={3}
          placeholder={t('appointments.cancel.reasonPlaceholder')}
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
        />
      </Modal>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <>
      <dt className="text-label text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </>
  );
}
