import {
  WAITING_LIST_PRIORITIES,
  WAITING_LIST_PRIORITY,
  type WaitingListEntry,
} from '@clinic/shared';
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Badge,
  Button,
  DatePicker,
  Drawer,
  FormField,
  Icon,
  Input,
  Modal,
  Select,
  useToast,
} from '@web/components/ui';
import { useDoctors } from '@web/features/doctors/queries';
import {
  useAddToWaitingList,
  useAvailability,
  usePromoteWaitingEntry,
  useResolveWaitingEntry,
  useWaitingList,
} from '@web/features/appointments/queries';
import { PatientPicker, type PickedPatient } from '@web/features/appointments/patient-picker';
import { SlotPicker } from '@web/features/appointments/slot-picker';
import { todayIso } from '@web/features/appointments/calendar-time';
import { errorMessageKey } from '@web/lib/api-error';
import { formatDateTime } from '@web/lib/format';
import type { BadgeTone } from '@web/components/ui/badge';

const PRIORITY_TONE: Record<string, BadgeTone> = {
  [WAITING_LIST_PRIORITY.URGENT]: 'danger',
  [WAITING_LIST_PRIORITY.HIGH]: 'warning',
  [WAITING_LIST_PRIORITY.NORMAL]: 'neutral',
};

export interface WaitingListPanelProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Adding and promoting are the front desk's; a doctor only reads. */
  readonly canManage: boolean;
}

/**
 * The queue of people with no slot yet.
 *
 * A side panel rather than a page: it is read *while* looking at the calendar
 * — "who can I fit into the gap at 15:00?" — and a route would mean leaving
 * the day to answer that.
 *
 * Ordering (urgent first, then longest waiting) comes from the API, which
 * reads the same rank table in `@clinic/shared` that the badge tones do.
 */
export function WaitingListPanel({
  open,
  onOpenChange,
  canManage,
}: WaitingListPanelProps): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();

  const entries = useWaitingList({ limit: 50 });
  const resolve = useResolveWaitingEntry();

  const [addOpen, setAddOpen] = useState(false);
  const [promoting, setPromoting] = useState<WaitingListEntry | null>(null);

  const remove = async (id: string): Promise<void> => {
    try {
      await resolve.mutateAsync(id);
      toast.success('appointments.waiting.resolved');
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        title={t('appointments.waiting.title')}
        descriptionKey="appointments.waiting.title"
        footer={
          canManage ? (
            <Button icon={<Icon name="user-plus" />} onClick={() => setAddOpen(true)}>
              {t('appointments.waiting.add')}
            </Button>
          ) : undefined
        }
      >
        {entries.data?.items.length === 0 && (
          <p className="rounded-control bg-inset px-3 py-6 text-center text-value text-ink-muted">
            {t('appointments.waiting.empty')}
          </p>
        )}

        <ul className="flex flex-col gap-3">
          {entries.data?.items.map((entry) => (
            <li key={entry.id} className="rounded-card border border-line p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-value font-medium text-ink">{entry.patientName}</p>
                  <p dir="ltr" className="truncate text-label tabular-nums text-ink-subtle">
                    {entry.patientPhone}
                  </p>
                </div>
                <Badge tone={PRIORITY_TONE[entry.priority] ?? 'neutral'}>
                  {t(`appointments.waiting.priorities.${entry.priority}`)}
                </Badge>
              </div>

              {entry.reason && <p className="mt-1.5 text-label text-ink-muted">{entry.reason}</p>}

              <p className="mt-1 text-label text-ink-subtle">
                {entry.doctorName ?? t('appointments.waiting.anyDoctor')} ·{' '}
                {t('appointments.waiting.waitingSince', { time: formatDateTime(entry.createdAt) })}
              </p>

              {canManage && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  <Button
                    size="sm"
                    icon={<Icon name="calendar" />}
                    onClick={() => setPromoting(entry)}
                  >
                    {t('appointments.waiting.promote')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Icon name="x" />}
                    isLoading={resolve.isPending}
                    onClick={() => void remove(entry.id)}
                  >
                    {t('appointments.waiting.resolve')}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Drawer>

      <AddWalkInModal open={addOpen} onOpenChange={setAddOpen} />

      {promoting && <PromoteModal entry={promoting} onClose={() => setPromoting(null)} />}
    </>
  );
}

/** Adding a walk-in: a patient, a priority, and why they are here. */
function AddWalkInModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const add = useAddToWaitingList();
  const doctors = useDoctors({ limit: 100 });

  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const [doctorId, setDoctorId] = useState('');
  const [priority, setPriority] = useState<string>(WAITING_LIST_PRIORITY.NORMAL);
  const [reason, setReason] = useState('');

  const submit = async (): Promise<void> => {
    if (!patient) {
      return;
    }

    try {
      await add.mutateAsync({
        patientId: patient.id,
        doctorId: doctorId === '' ? null : doctorId,
        reason: reason.trim() === '' ? null : reason.trim(),
        priority: priority as (typeof WAITING_LIST_PRIORITIES)[number],
      });

      toast.success('appointments.waiting.added');
      setPatient(null);
      setReason('');
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="appointments.waiting.add"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button isLoading={add.isPending} disabled={!patient} onClick={() => void submit()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="appointments.patient" htmlFor="waiting-patient">
          <PatientPicker id="waiting-patient" value={patient} onChange={setPatient} />
        </FormField>

        <FormField label="appointments.doctor" htmlFor="waiting-doctor" optional>
          <Select
            id="waiting-doctor"
            value={doctorId}
            placeholder={t('appointments.waiting.anyDoctor')}
            options={(doctors.data?.items ?? []).map((doctor) => ({
              value: doctor.id,
              label: doctor.user.name,
            }))}
            onChange={(event) => setDoctorId(event.target.value)}
          />
        </FormField>

        <FormField label="appointments.waiting.priority" htmlFor="waiting-priority">
          <Select
            id="waiting-priority"
            value={priority}
            options={WAITING_LIST_PRIORITIES.map((value) => ({
              value,
              label: t(`appointments.waiting.priorities.${value}`),
            }))}
            onChange={(event) => setPriority(event.target.value)}
          />
        </FormField>

        <FormField label="appointments.reason" htmlFor="waiting-reason" optional>
          <Input
            id="waiting-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </FormField>
      </div>
    </Modal>
  );
}

/**
 * Promoting: pick a doctor and a real slot.
 *
 * The booking goes through the same endpoint as any other, so a slot taken
 * while the patient waited comes back 409 and the entry stays open — they are
 * still waiting, which is the honest outcome.
 */
function PromoteModal({
  entry,
  onClose,
}: {
  entry: WaitingListEntry;
  onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const promote = usePromoteWaitingEntry();
  const doctors = useDoctors({ limit: 100 });

  const [doctorId, setDoctorId] = useState(entry.doctorId ?? '');
  const [date, setDate] = useState(todayIso());
  const [startsAt, setStartsAt] = useState<string | null>(null);

  const availability = useAvailability({ doctorId, date, durationMinutes: 30 }, true);

  const submit = async (): Promise<void> => {
    if (!startsAt || !doctorId) {
      return;
    }

    try {
      await promote.mutateAsync({
        id: entry.id,
        body: { doctorId, startsAt, durationMinutes: 30 },
      });
      toast.success('appointments.waiting.promoted');
      onClose();
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <Modal
      open
      onOpenChange={(next) => !next && onClose()}
      title="appointments.waiting.promote"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button isLoading={promote.isPending} disabled={!startsAt} onClick={() => void submit()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-value text-ink">{entry.patientName}</p>

        <FormField label="appointments.doctor" htmlFor="promote-doctor">
          <Select
            id="promote-doctor"
            value={doctorId}
            placeholder={t('appointments.allDoctors')}
            options={(doctors.data?.items ?? []).map((doctor) => ({
              value: doctor.id,
              label: doctor.user.name,
            }))}
            onChange={(event) => {
              setDoctorId(event.target.value);
              setStartsAt(null);
            }}
          />
        </FormField>

        <FormField label="appointments.date" htmlFor="promote-date">
          <DatePicker
            id="promote-date"
            label={t('appointments.date')}
            value={date}
            onChange={(next) => {
              setDate(next);
              setStartsAt(null);
            }}
          />
        </FormField>

        <FormField label="appointments.slots.label" htmlFor="promote-slot">
          <SlotPicker
            availability={availability.data}
            isLoading={availability.isFetching}
            ready={Boolean(doctorId && date)}
            value={startsAt}
            onChange={setStartsAt}
          />
        </FormField>
      </div>
    </Modal>
  );
}
