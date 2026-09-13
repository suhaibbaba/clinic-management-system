import {
  APPOINTMENT_TYPE,
  LOOKUP_LIST,
  WAITING_LIST_SOURCE,
  type CalendarAppointment,
  type WaitingListEntry,
} from '@clinic/shared';
import { useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  DatePicker,
  FormField,
  Input,
  Modal,
  Select,
  Textarea,
  usePersonName,
  useToast,
} from '@web/components/ui';
import { useDoctors } from '@web/features/doctors/queries';
import { useLookupOptions } from '@web/features/lookups/queries';
import {
  useAvailability,
  useCreateAppointment,
  usePromoteWaitingEntry,
  useUpdateAppointment,
} from '@web/features/appointments/queries';
import {
  isDraftComplete,
  PatientPicker,
  patientPhoneClash,
  toPatientRef,
  type PatientChoice,
  type PickedPatient,
} from '@web/features/appointments/patient-picker';
import { SlotPicker } from '@web/features/appointments/slot-picker';
import { toIsoDate, todayIso } from '@web/features/appointments/calendar-time';
import { errorMessageKey } from '@web/lib/api-error';

export interface AppointmentFormModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Editing when present, booking when not. */
  readonly appointment?: CalendarAppointment | undefined;
  /** Pre-filled by clicking an empty spot in the day grid. */
  readonly defaults?:
    { readonly date?: string; readonly doctorId?: string; readonly startsAt?: string } | undefined;
  // Scheduling somebody off the queue. The booking goes through the queue's own endpoint, so a slot
  // taken while they waited is the same 409 and the entry stays open.
  readonly waitingEntry?: WaitingListEntry | undefined;
  /** Where the calendar should be standing once this closes. */
  readonly onBooked?: ((booked: { date: string; doctorId: string }) => void) | undefined;
}

// The time comes from the availability endpoint, never typed. When editing, the appointment's own
// slot is excluded so it does not clash with itself.
export function AppointmentFormModal({
  open,
  onOpenChange,
  appointment,
  defaults,
  waitingEntry,
  onBooked,
}: AppointmentFormModalProps): JSX.Element {
  const { t } = useTranslation();
  const doctorName = usePersonName();
  const typeOptions = useLookupOptions(LOOKUP_LIST.APPOINTMENT_TYPE);
  const toast = useToast();

  const doctors = useDoctors({ limit: 100 });
  const create = useCreateAppointment();
  const update = useUpdateAppointment();
  const promote = usePromoteWaitingEntry();

  const [patient, setPatient] = useState<PatientChoice | null>(null);
  const [clash, setClash] = useState<PickedPatient | null>(null);
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState(todayIso());
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [type, setType] = useState<string>(APPOINTMENT_TYPE.CHECKUP);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setClash(null);

    if (appointment) {
      // The feed already carries what the picker draws, so editing costs no request — and works for
      // a receptionist, whose patient response has no clinical view.
      setPatient({
        kind: 'existing',
        patient: {
          id: appointment.patientId,
          fullName: appointment.patientName,
          phone: appointment.patientPhone,
          fileNumber: appointment.patientFileNumber,
        },
      });
      setDoctorId(appointment.doctorId);
      setDate(toIsoDate(new Date(appointment.startsAt)));
      setStartsAt(appointment.startsAt);
      setDurationMinutes(String(appointment.durationMinutes));
      setType(appointment.type);
      setReason(appointment.reason ?? '');
      setNotes(appointment.notes ?? '');
      return;
    }

    if (waitingEntry) {
      setPatient({
        kind: 'existing',
        patient: {
          id: waitingEntry.patientId,
          fullName: waitingEntry.patientName,
          phone: waitingEntry.patientPhone,
          fileNumber: '',
        },
      });
      setDoctorId(waitingEntry.doctorId ?? '');
      setReason(waitingEntry.reason ?? '');
    } else {
      setPatient(null);
      setDoctorId(defaults?.doctorId ?? '');
      setReason('');
    }

    setDate(defaults?.date ?? todayIso());
    setStartsAt(defaults?.startsAt ?? null);
    setDurationMinutes('30');
    setType(APPOINTMENT_TYPE.CHECKUP);
    setNotes('');
  }, [open, appointment, defaults, waitingEntry]);

  const availability = useAvailability(
    {
      doctorId,
      date,
      durationMinutes: Number(durationMinutes) || 30,
      ...(appointment && { excludeAppointmentId: appointment.id }),
    },
    open,
  );

  const ready = Boolean(doctorId && date);
  const canSubmit =
    Boolean(startsAt) && Boolean(doctorId) && (isDraftComplete(patient) || Boolean(appointment));

  const submit = async (): Promise<void> => {
    if (!startsAt || !doctorId) {
      return;
    }

    const body = {
      doctorId,
      startsAt,
      durationMinutes: Number(durationMinutes),
      type,
      reason: reason.trim() === '' ? null : reason.trim(),
      notes: notes.trim() === '' ? null : notes.trim(),
    };

    try {
      if (appointment) {
        await update.mutateAsync({ id: appointment.id, body });
        toast.success('appointments.updated');
      } else if (waitingEntry) {
        await promote.mutateAsync({
          id: waitingEntry.id,
          body: {
            doctorId,
            startsAt,
            durationMinutes: Number(durationMinutes),
            type,
            // Only the ones who asked from a phone. A walk-in is standing at the desk being told
            // the time out loud, and does not need a text about it.
            notify: waitingEntry.source === WAITING_LIST_SOURCE.ONLINE,
          },
        });
        toast.success('appointments.waiting.scheduled');
      } else {
        if (!patient) {
          return;
        }

        await create.mutateAsync({ ...body, ...toPatientRef(patient) });
        toast.success('appointments.created');
      }

      onBooked?.({ date: toIsoDate(new Date(startsAt)), doctorId });
      onOpenChange(false);
    } catch (error) {
      // Not a dead end: the number is already somebody's, and the picker offers
      // to book that somebody instead.
      const existing = patientPhoneClash(error);

      if (existing) {
        setClash(existing);
        return;
      }

      toast.error(errorMessageKey(error));
    }
  };

  const isPending = create.isPending || update.isPending || promote.isPending;
  const title = appointment
    ? 'appointments.edit'
    : waitingEntry
      ? 'appointments.waiting.schedule'
      : 'appointments.create';

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button isLoading={isPending} disabled={!canSubmit} onClick={() => void submit()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="appointments.patient" htmlFor="appointment-patient">
          <PatientPicker
            id="appointment-patient"
            value={patient}
            clash={clash}
            allowNew={waitingEntry === undefined && appointment === undefined}
            onChange={(next) => {
              setPatient(next);
              setClash(null);
            }}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="appointments.doctor" htmlFor="appointment-doctor">
            <Select
              id="appointment-doctor"
              value={doctorId}
              placeholder={t('appointments.allDoctors')}
              options={(doctors.data?.items ?? []).map((doctor) => ({
                value: doctor.id,
                label: doctorName(doctor.user.name),
              }))}
              onChange={(event) => {
                setDoctorId(event.target.value);
                // The old slot belongs to the old doctor's day.
                setStartsAt(null);
              }}
            />
          </FormField>

          <FormField label="appointments.date" htmlFor="appointment-date">
            <DatePicker
              id="appointment-date"
              label={t('appointments.date')}
              value={date}
              onChange={(next) => {
                setDate(next);
                setStartsAt(null);
              }}
            />
          </FormField>

          <FormField label="appointments.type" htmlFor="appointment-type">
            <Select
              id="appointment-type"
              value={type}
              options={typeOptions}
              onChange={(event) => setType(event.target.value)}
            />
          </FormField>

          <FormField label="appointments.duration" htmlFor="appointment-duration">
            <Select
              id="appointment-duration"
              value={durationMinutes}
              options={['15', '30', '45', '60', '90'].map((value) => ({
                value,
                label: t('appointments.durationMinutes', { count: Number(value) }),
              }))}
              onChange={(event) => {
                setDurationMinutes(event.target.value);
                // A longer appointment may no longer fit where the old one did.
                setStartsAt(null);
              }}
            />
          </FormField>
        </div>

        <FormField
          label="appointments.slots.label"
          htmlFor="appointment-slot"
          hint="appointments.slots.hint"
        >
          <SlotPicker
            availability={availability.data}
            isLoading={availability.isFetching}
            ready={ready}
            value={startsAt}
            onChange={setStartsAt}
          />
        </FormField>

        <FormField label="appointments.reason" htmlFor="appointment-reason" optional>
          <Input
            id="appointment-reason"
            placeholder={t('appointments.reason')}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </FormField>

        <FormField label="appointments.notes" htmlFor="appointment-notes" optional>
          <Textarea
            id="appointment-notes"
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </FormField>
      </div>
    </Modal>
  );
}
