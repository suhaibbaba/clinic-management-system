import {
  WAITING_LIST_PRIORITIES,
  WAITING_LIST_PRIORITY,
  WAITING_LIST_SOURCE,
  WAITING_LIST_STATUS,
  type WaitingListEntry,
} from '@clinic/shared';
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Badge,
  Button,
  Drawer,
  FormField,
  Icon,
  Input,
  Modal,
  PersonName,
  PhoneLink,
  Select,
  Textarea,
  usePersonName,
  useToast,
} from '@web/components/ui';
import { useDoctors } from '@web/features/doctors/queries';
import {
  useAddToWaitingList,
  useContactWaitingEntry,
  useDeclineWaitingEntry,
  useWaitingList,
} from '@web/features/appointments/queries';
import {
  isDraftComplete,
  PatientPicker,
  patientPhoneClash,
  toPatientRef,
  type PatientChoice,
  type PickedPatient,
} from '@web/features/appointments/patient-picker';
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
  /** Adding, ringing back and scheduling are the front desk's; a doctor only reads. */
  readonly canManage: boolean;
  /** Opens the booking form prefilled from the entry — the panel does not book anything itself. */
  readonly onSchedule: (entry: WaitingListEntry) => void;
}

// A side panel rather than a page: it is read while looking at the calendar — "who can I fit into
// the gap at 15:00?" — and a route would mean leaving the day.
export function WaitingListPanel({
  open,
  onOpenChange,
  canManage,
  onSchedule,
}: WaitingListPanelProps): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();

  const entries = useWaitingList({ limit: 50 });
  const contact = useContactWaitingEntry();

  const [addOpen, setAddOpen] = useState(false);
  const [declining, setDeclining] = useState<WaitingListEntry | null>(null);

  const markContacted = async (id: string): Promise<void> => {
    try {
      await contact.mutateAsync(id);
      toast.success('appointments.waiting.contacted');
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
                  {/* Reception's next move on one of these is to ring it. */}
                  <PhoneLink value={entry.patientPhone} className="truncate text-label" />
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                  {entry.source === WAITING_LIST_SOURCE.ONLINE && (
                    <Badge tone="info">{t('appointments.waiting.online')}</Badge>
                  )}
                  <Badge tone={PRIORITY_TONE[entry.priority] ?? 'neutral'}>
                    {t(`appointments.waiting.priorities.${entry.priority}`)}
                  </Badge>
                </div>
              </div>

              {entry.reason && <p className="mt-1.5 text-label text-ink-muted">{entry.reason}</p>}

              <p className="mt-1 text-label text-ink-subtle">
                <PersonName
                  name={entry.doctorName}
                  fallback={t('appointments.waiting.anyDoctor')}
                />{' '}
                ·{' '}
                {t('appointments.waiting.waitingSince', { time: formatDateTime(entry.createdAt) })}
                {entry.status === WAITING_LIST_STATUS.CONTACTED && (
                  <> · {t('appointments.waiting.statuses.contacted')}</>
                )}
              </p>

              {canManage && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  <Button
                    size="sm"
                    icon={<Icon name="calendar" />}
                    onClick={() => onSchedule(entry)}
                  >
                    {t('appointments.waiting.schedule')}
                  </Button>
                  {entry.status === WAITING_LIST_STATUS.PENDING && (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Icon name="phone" />}
                      isLoading={contact.isPending}
                      onClick={() => void markContacted(entry.id)}
                    >
                      {t('appointments.waiting.markContacted')}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Icon name="x" />}
                    onClick={() => setDeclining(entry)}
                  >
                    {t('appointments.waiting.decline')}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Drawer>

      <AddWalkInModal open={addOpen} onOpenChange={setAddOpen} />

      {declining && <DeclineModal entry={declining} onClose={() => setDeclining(null)} />}
    </>
  );
}

function AddWalkInModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const doctorName = usePersonName();
  const toast = useToast();
  const add = useAddToWaitingList();
  const doctors = useDoctors({ limit: 100 });

  const [patient, setPatient] = useState<PatientChoice | null>(null);
  const [clash, setClash] = useState<PickedPatient | null>(null);
  const [doctorId, setDoctorId] = useState('');
  const [priority, setPriority] = useState<string>(WAITING_LIST_PRIORITY.NORMAL);
  const [reason, setReason] = useState('');

  const submit = async (): Promise<void> => {
    if (!patient) {
      return;
    }

    try {
      await add.mutateAsync({
        ...toPatientRef(patient),
        doctorId: doctorId === '' ? null : doctorId,
        reason: reason.trim() === '' ? null : reason.trim(),
        priority: priority as (typeof WAITING_LIST_PRIORITIES)[number],
      });

      toast.success('appointments.waiting.added');
      setPatient(null);
      setReason('');
      onOpenChange(false);
    } catch (error) {
      const existing = patientPhoneClash(error);

      if (existing) {
        setClash(existing);
        return;
      }

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
          <Button
            isLoading={add.isPending}
            disabled={!isDraftComplete(patient)}
            onClick={() => void submit()}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="appointments.patient" htmlFor="waiting-patient">
          <PatientPicker
            id="waiting-patient"
            value={patient}
            clash={clash}
            onChange={(next) => {
              setPatient(next);
              setClash(null);
            }}
          />
        </FormField>

        <FormField label="appointments.doctor" htmlFor="waiting-doctor" optional>
          <Select
            id="waiting-doctor"
            value={doctorId}
            placeholder={t('appointments.waiting.anyDoctor')}
            options={(doctors.data?.items ?? []).map((doctor) => ({
              value: doctor.id,
              label: doctorName(doctor.user.name),
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

// Closing an entry without a booking. The reason is what the patient was told, so it is required
// and it is what the message quotes back to them.
function DeclineModal({
  entry,
  onClose,
}: {
  entry: WaitingListEntry;
  onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const decline = useDeclineWaitingEntry();

  const [reason, setReason] = useState('');
  const notify = entry.source === WAITING_LIST_SOURCE.ONLINE;

  const submit = async (): Promise<void> => {
    try {
      await decline.mutateAsync({ id: entry.id, body: { reason: reason.trim(), notify } });
      toast.success('appointments.waiting.declined');
      onClose();
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <Modal
      open
      onOpenChange={(next) => !next && onClose()}
      title="appointments.waiting.decline"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            isLoading={decline.isPending}
            disabled={reason.trim().length < 3}
            onClick={() => void submit()}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-value text-ink">{entry.patientName}</p>

        <FormField
          label="appointments.waiting.declineReason"
          htmlFor="decline-reason"
          hint={notify ? 'appointments.waiting.declineNotifies' : undefined}
          required
        >
          <Textarea
            id="decline-reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </FormField>
      </div>
    </Modal>
  );
}
