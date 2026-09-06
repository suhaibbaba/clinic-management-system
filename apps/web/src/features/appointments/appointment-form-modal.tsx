import { APPOINTMENT_TYPE, APPOINTMENT_TYPES, type CalendarAppointment } from '@clinic/shared';
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
  useToast,
} from '@web/components/ui';
import { useDoctors } from '@web/features/doctors/queries';
import {
  useAvailability,
  useCreateAppointment,
  useUpdateAppointment,
} from '@web/features/appointments/queries';
import { PatientPicker, type PickedPatient } from '@web/features/appointments/patient-picker';
import { SlotPicker } from '@web/features/appointments/slot-picker';
import { typeLabelKey } from '@web/features/appointments/status';
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
}

/**
 * Booking and rescheduling, on the same form.
 *
 * The time is chosen from the availability endpoint, never typed: a free-text
 * time invites booking a doctor's lunch break or a closed Friday, and the
 * clinic's answer to "when is this doctor free?" already exists. The date uses
 * the shared `DatePicker` so it reads the same as every other date in the app.
 *
 * When editing, the appointment's own slot is excluded from the busy list, so
 * "keep the same time and change the reason" does not report a clash with
 * itself.
 */
export function AppointmentFormModal({
  open,
  onOpenChange,
  appointment,
  defaults,
}: AppointmentFormModalProps): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();

  const doctors = useDoctors({ limit: 100 });
  const create = useCreateAppointment();
  const update = useUpdateAppointment();

  const [patient, setPatient] = useState<PickedPatient | null>(null);
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

    if (appointment) {
      // The feed already carries everything the picker draws, so editing costs
      // no extra request — and works for a receptionist, whose patient
      // response never includes the clinical view.
      setPatient({
        id: appointment.patientId,
        fullName: appointment.patientName,
        phone: appointment.patientPhone,
        fileNumber: appointment.patientFileNumber,
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

    setPatient(null);
    setDoctorId(defaults?.doctorId ?? '');
    setDate(defaults?.date ?? todayIso());
    setStartsAt(defaults?.startsAt ?? null);
    setDurationMinutes('30');
    setType(APPOINTMENT_TYPE.CHECKUP);
    setReason('');
    setNotes('');
  }, [open, appointment, defaults]);

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
    Boolean(startsAt) && Boolean(doctorId) && (Boolean(patient) || Boolean(appointment));

  const submit = async (): Promise<void> => {
    if (!startsAt || !doctorId) {
      return;
    }

    try {
      if (appointment) {
        await update.mutateAsync({
          id: appointment.id,
          body: {
            doctorId,
            startsAt,
            durationMinutes: Number(durationMinutes),
            type: type as (typeof APPOINTMENT_TYPES)[number],
            reason: reason.trim() === '' ? null : reason.trim(),
            notes: notes.trim() === '' ? null : notes.trim(),
          },
        });
        toast.success('appointments.updated');
      } else {
        if (!patient) {
          return;
        }

        await create.mutateAsync({
          patientId: patient.id,
          doctorId,
          startsAt,
          durationMinutes: Number(durationMinutes),
          type: type as (typeof APPOINTMENT_TYPES)[number],
          reason: reason.trim() === '' ? null : reason.trim(),
          notes: notes.trim() === '' ? null : notes.trim(),
        });
        toast.success('appointments.created');
      }

      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={appointment ? 'appointments.edit' : 'appointments.create'}
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
          <PatientPicker id="appointment-patient" value={patient} onChange={setPatient} />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="appointments.doctor" htmlFor="appointment-doctor">
            <Select
              id="appointment-doctor"
              value={doctorId}
              placeholder={t('appointments.allDoctors')}
              options={(doctors.data?.items ?? []).map((doctor) => ({
                value: doctor.id,
                label: doctor.user.name,
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
              options={APPOINTMENT_TYPES.map((value) => ({
                value,
                label: t(typeLabelKey(value)),
              }))}
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
