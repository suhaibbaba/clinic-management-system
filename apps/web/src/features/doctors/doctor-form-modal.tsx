import { USER_ROLE, type Doctor, type WeeklySchedule } from '@clinic/shared';
import { useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, FormField, Input, Modal, Select, useToast } from '@web/components/ui';
import { ScheduleEditor } from '@web/components/schedule-editor';
import { useCreateDoctor, useSpecialties, useUpdateDoctor } from '@web/features/doctors/queries';
import { useUsers } from '@web/features/users/queries';
import { errorMessageKey } from '@web/lib/api-error';

interface DoctorFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctor: Doctor | null;
}

const DEFAULT_DURATION = 30;

/**
 * Create links an existing doctor-role account to a specialty; edit changes the
 * specialty, the default appointment length and the weekly schedule. The linked
 * account itself never changes — that is a users-page concern.
 */
export function DoctorFormModal({ open, onOpenChange, doctor }: DoctorFormModalProps): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const createDoctor = useCreateDoctor();
  const updateDoctor = useUpdateDoctor();
  const specialties = useSpecialties();
  // Only admins reach this screen, so listing users here is allowed.
  const doctorUsers = useUsers({ role: USER_ROLE.DOCTOR, limit: 100 });

  const isEdit = doctor !== null;
  const [userId, setUserId] = useState('');
  const [specialtyId, setSpecialtyId] = useState('');
  const [duration, setDuration] = useState(String(DEFAULT_DURATION));
  const [schedule, setSchedule] = useState<WeeklySchedule>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setUserId(doctor?.userId ?? '');
    setSpecialtyId(doctor?.specialtyId ?? '');
    setDuration(String(doctor?.defaultAppointmentDurationMinutes ?? DEFAULT_DURATION));
    setSchedule(doctor?.weeklySchedule ?? []);
  }, [open, doctor]);

  const userOptions = (doctorUsers.data?.items ?? []).map((user) => ({
    value: user.id,
    label: `${user.name} — ${user.phone}`,
  }));

  const specialtyOptions = (specialties.data?.items ?? []).map((specialty) => ({
    value: specialty.id,
    label: specialty.name,
  }));

  const submit = async (): Promise<void> => {
    setIsSaving(true);

    try {
      const durationMinutes = Number(duration);

      if (doctor) {
        await updateDoctor.mutateAsync({
          id: doctor.id,
          body: {
            specialtyId,
            defaultAppointmentDurationMinutes: durationMinutes,
            weeklySchedule: schedule,
          },
        });
        toast.success('doctors.updated');
      } else {
        await createDoctor.mutateAsync({
          userId,
          specialtyId,
          defaultAppointmentDurationMinutes: durationMinutes,
          weeklySchedule: schedule,
        });
        toast.success('doctors.created');
      }

      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessageKey(error));
    } finally {
      setIsSaving(false);
    }
  };

  const canSubmit = specialtyId !== '' && (isEdit || userId !== '');

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={isEdit ? 'doctors.edit' : 'doctors.create'}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!canSubmit} isLoading={isSaving} onClick={() => void submit()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!isEdit && (
          <FormField label="doctors.user" htmlFor="doctor-user">
            <Select
              id="doctor-user"
              options={userOptions}
              placeholder={t('doctors.selectUser')}
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
            />
          </FormField>
        )}

        <FormField label="doctors.specialty" htmlFor="doctor-specialty">
          <Select
            id="doctor-specialty"
            options={specialtyOptions}
            placeholder={t('doctors.selectSpecialty')}
            value={specialtyId}
            onChange={(event) => setSpecialtyId(event.target.value)}
          />
        </FormField>

        <FormField label="doctors.duration" htmlFor="doctor-duration" hint="doctors.durationUnit">
          <Input
            id="doctor-duration"
            type="number"
            min={5}
            max={480}
            step={5}
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          />
        </FormField>

        <div>
          <p className="mb-2 text-sm font-medium text-gray-800">{t('doctors.schedule')}</p>
          <ScheduleEditor value={schedule} onChange={setSchedule} />
        </div>
      </div>
    </Modal>
  );
}
