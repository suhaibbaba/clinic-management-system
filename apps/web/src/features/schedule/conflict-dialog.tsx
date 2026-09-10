import type { ConflictingAppointment } from '@clinic/shared';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Icon, Ltr, Modal } from '@web/components/ui';
import { formatClinicDate, formatClinicTime } from '@web/lib/format';

export interface ConflictDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly conflicts: readonly ConflictingAppointment[];
  /** Write it anyway and cancel these appointments, notifying each patient. */
  readonly onCancelThem: () => void;
  /** Write it anyway and leave them standing — reception rings round. */
  readonly onKeepThem: () => void;
  readonly isSaving?: boolean | undefined;
}

// The list, not the count: reception knows these patients by name. No default — cancelling notifies
// everyone and cannot be taken back, so it is the secondary button.
export function ConflictDialog({
  open,
  onOpenChange,
  conflicts,
  onCancelThem,
  onKeepThem,
  isSaving = false,
}: ConflictDialogProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="schedule.conflicts.title"
      titleValues={{ count: conflicts.length }}
      description="schedule.conflicts.description"
      footer={
        <>
          <Button icon={<Icon name="x" />} variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            icon={<Icon name="trash" />}
            variant="secondary"
            isLoading={isSaving}
            onClick={onCancelThem}
          >
            {t('schedule.conflicts.cancelThem')}
          </Button>
          <Button icon={<Icon name="check" />} isLoading={isSaving} onClick={onKeepThem}>
            {t('schedule.conflicts.keepThem')}
          </Button>
        </>
      }
    >
      <ul className="flex flex-col gap-2">
        {conflicts.map((appointment) => (
          <li
            key={appointment.id}
            className="flex flex-wrap items-baseline justify-between gap-2 rounded-panel bg-canvas px-3 py-2"
          >
            <span className="truncate text-value font-medium text-ink">
              {appointment.patientName}
            </span>
            <span className="flex items-baseline gap-3 text-label text-ink-muted">
              {/* The clinic's zone and a 24-hour clock — see `formatClinicTime`. */}
              <Ltr className="tabular-nums">
                {formatClinicDate(appointment.startsAt)} {formatClinicTime(appointment.startsAt)}
              </Ltr>
              <Ltr className="tabular-nums">{appointment.patientPhone}</Ltr>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-label text-ink-subtle">{t('schedule.conflicts.notifyNote')}</p>
    </Modal>
  );
}
