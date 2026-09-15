import type { Doctor, WeeklySchedule } from '@clinic/shared';
import { useEffect, useState, type JSX } from 'react';
import { foldDigits } from '@clinic/ui/lib/digits';
import { useTranslation } from 'react-i18next';

import {
  Button,
  FormField,
  Icon,
  Input,
  Modal,
  PasswordInput,
  PhoneInput,
  SegmentedControl,
  Select,
  useToast,
} from '@clinic/ui';
import { WorkingHours } from '@web/components/schedule/working-hours';
import { useClinic } from '@web/features/clinic/queries';
import { useCreateDoctor, useSpecialties, useUpdateDoctor } from '@web/features/doctors/queries';
import { useUsers } from '@web/features/users/queries';
import { errorMessageKey } from '@web/lib/api-error';

interface DoctorFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctor: Doctor | null;
}

const DEFAULT_DURATION = 30;

/** New by default: linking an account that already exists is the rare case, not the usual one. */
const MODES = ['new', 'link'] as const;
type Mode = (typeof MODES)[number];

interface NewUserFields {
  nameAr: string;
  nameEn: string;
  phone: string;
  email: string;
  password: string;
}

const EMPTY_USER: NewUserFields = { nameAr: '', nameEn: '', phone: '', email: '', password: '' };

export function DoctorFormModal({ open, onOpenChange, doctor }: DoctorFormModalProps): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const createDoctor = useCreateDoctor();
  const updateDoctor = useUpdateDoctor();
  const specialties = useSpecialties();
  const clinic = useClinic();
  const doctorUsers = useUsers({ limit: 100 });

  const isEdit = doctor !== null;
  const [mode, setMode] = useState<Mode>('new');
  const [newUser, setNewUser] = useState<NewUserFields>(EMPTY_USER);
  const [userId, setUserId] = useState('');
  const [specialtyId, setSpecialtyId] = useState('');
  const [duration, setDuration] = useState(String(DEFAULT_DURATION));
  const [schedule, setSchedule] = useState<WeeklySchedule>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setMode('new');
    setNewUser(EMPTY_USER);
    setUserId(doctor?.userId ?? '');
    setSpecialtyId(doctor?.specialtyId ?? '');
    setDuration(String(doctor?.defaultAppointmentDurationMinutes ?? DEFAULT_DURATION));
    setSchedule(doctor?.weeklySchedule ?? clinic.data?.workingHours ?? []);
  }, [open, doctor, clinic.data]);

  // `\u2068`/`\u2069` isolate the name in the string itself — an `<option>` is text with no span to
  // carry `dir`, and bidi rendered the line as "963931000002+ — Dr. Layla Haddad".
  const userOptions = (doctorUsers.data?.items ?? []).map((user) => ({
    value: user.id,
    label: `\u2068${user.name}\u2069 — \u2068${user.phone}\u2069`,
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
          ...(mode === 'new'
            ? {
                newUser: {
                  name: { ar: newUser.nameAr.trim(), en: newUser.nameEn.trim() },
                  phone: newUser.phone.trim(),
                  password: newUser.password,
                  ...(newUser.email.trim() !== '' && { email: newUser.email.trim() }),
                },
              }
            : { userId }),
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

  const accountReady =
    mode === 'link'
      ? userId !== ''
      : newUser.nameAr.trim() !== '' &&
        newUser.nameEn.trim() !== '' &&
        newUser.phone.trim() !== '' &&
        newUser.password.length >= 8;

  const canSubmit = specialtyId !== '' && (isEdit || accountReady);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={isEdit ? 'doctors.edit' : 'doctors.create'}
      footer={
        <>
          <Button icon={<Icon name="x" />} variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            icon={<Icon name="check" />}
            disabled={!canSubmit}
            isLoading={isSaving}
            onClick={() => void submit()}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!isEdit && (
          <>
            <SegmentedControl<Mode>
              label={t('doctors.account')}
              value={mode}
              onChange={setMode}
              options={MODES.map((value) => ({ value, label: t(`doctors.modes.${value}`) }))}
            />

            {mode === 'new' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="users.nameAr" htmlFor="doctor-name-ar" required>
                  <Input
                    id="doctor-name-ar"
                    adornment="user"
                    placeholder={t('common.placeholders.fullNameAr')}
                    value={newUser.nameAr}
                    onChange={(event) => setNewUser({ ...newUser, nameAr: event.target.value })}
                  />
                </FormField>

                <FormField label="users.nameEn" htmlFor="doctor-name-en" required>
                  <Input
                    id="doctor-name-en"
                    adornment="user"
                    dir="ltr"
                    placeholder={t('common.placeholders.fullNameEn')}
                    value={newUser.nameEn}
                    onChange={(event) => setNewUser({ ...newUser, nameEn: event.target.value })}
                  />
                </FormField>

                <FormField label="users.phone" htmlFor="doctor-phone" required>
                  <PhoneInput
                    id="doctor-phone"
                    placeholder={t('common.placeholders.phone')}
                    value={newUser.phone}
                    onChange={(event) => setNewUser({ ...newUser, phone: event.target.value })}
                  />
                </FormField>

                <FormField label="users.email" htmlFor="doctor-email" optional>
                  <Input
                    id="doctor-email"
                    type="email"
                    dir="ltr"
                    placeholder={t('common.placeholders.email')}
                    value={newUser.email}
                    onChange={(event) => setNewUser({ ...newUser, email: event.target.value })}
                  />
                </FormField>

                <FormField
                  label="users.password"
                  htmlFor="doctor-password"
                  hint="doctors.roleLocked"
                  required
                >
                  <PasswordInput
                    id="doctor-password"
                    autoComplete="new-password"
                    placeholder={t('common.placeholders.password')}
                    value={newUser.password}
                    onChange={(event) => setNewUser({ ...newUser, password: event.target.value })}
                  />
                </FormField>
              </div>
            ) : (
              <FormField label="doctors.user" htmlFor="doctor-user" hint="doctors.linkPromotes">
                <Select
                  id="doctor-user"
                  options={userOptions}
                  placeholder={t('doctors.selectUser')}
                  value={userId}
                  onChange={(event) => setUserId(event.target.value)}
                />
              </FormField>
            )}
          </>
        )}

        <FormField label="doctors.specialty" htmlFor="doctor-specialty" required>
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
            placeholder={t('common.placeholders.minutes')}
            id="doctor-duration"
            // Not `type="number"`: it accepts `e`, `+`, `-` and `.`, and reads back an empty
            // string for any of them, so the field looks filled and submits nothing.
            inputMode="numeric"
            dir="ltr"
            value={duration}
            onChange={(event) => setDuration(foldDigits(event.target.value).replace(/\D/g, ''))}
          />
        </FormField>

        <div>
          <p className="mb-1 text-value font-medium text-ink">{t('doctors.schedule')}</p>
          {!isEdit && (
            <p className="mb-2 text-label text-ink-muted">{t('doctors.scheduleDefault')}</p>
          )}
          <WorkingHours value={schedule} onChange={setSchedule} idPrefix="doctor-form-hours" />
        </div>
      </div>
    </Modal>
  );
}
