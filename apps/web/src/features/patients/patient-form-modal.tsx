import { zodResolver } from '@hookform/resolvers/zod';
import { createPatientSchema, GENDERS, type CreatePatientInput } from '@clinic/shared';
import { useEffect, type JSX } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button, FormField, Input, Modal, Select, useToast } from '@web/components/ui';
import { useCreatePatient } from '@web/features/patients/queries';
import { errorMessageKey } from '@web/lib/api-error';

interface PatientFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new patient's id, so the caller can open the file. */
  onCreated: (patientId: string) => void;
}

/**
 * Registers a patient.
 *
 * Only the basic-info fields ROLES.md lets a receptionist write — the clinical
 * record is filled in from the patient file afterwards. The file number is
 * deliberately absent: the API allocates it per clinic, and accepting one from
 * here would let two receptionists pick the same one.
 */
export function PatientFormModal({
  open,
  onOpenChange,
  onCreated,
}: PatientFormModalProps): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const createPatient = useCreatePatient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreatePatientInput>({ resolver: zodResolver(createPatientSchema) });

  useEffect(() => {
    if (open) {
      reset({ fullName: '', phone: '' });
    }
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const patient = await createPatient.mutateAsync(values);
      toast.success('patients.created');
      onOpenChange(false);
      onCreated(patient.id);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="patients.create"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="patient-form" disabled={isSubmitting}>
            {t(isSubmitting ? 'common.saving' : 'common.save')}
          </Button>
        </>
      }
    >
      <form id="patient-form" className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <FormField label="patients.fullName" htmlFor="patient-name" error={errors.fullName}>
          <Input id="patient-name" hasError={Boolean(errors.fullName)} {...register('fullName')} />
        </FormField>

        <FormField label="patients.phone" htmlFor="patient-phone" error={errors.phone}>
          <Input
            id="patient-phone"
            dir="ltr"
            hasError={Boolean(errors.phone)}
            {...register('phone')}
          />
        </FormField>

        <FormField
          label="patients.dateOfBirth"
          htmlFor="patient-dob"
          error={errors.dateOfBirth}
          optional
        >
          {/* Gregorian, as CLAUDE.md requires; the native picker mirrors correctly. */}
          <Input
            id="patient-dob"
            type="date"
            dir="ltr"
            {...register('dateOfBirth', { setValueAs: (value) => (value === '' ? null : value) })}
          />
        </FormField>

        <FormField label="patients.gender" htmlFor="patient-gender" error={errors.gender} optional>
          <Select
            id="patient-gender"
            placeholder={t('common.none')}
            options={GENDERS.map((gender) => ({ value: gender, label: t(`patients.${gender}`) }))}
            {...register('gender', { setValueAs: (value) => (value === '' ? null : value) })}
          />
        </FormField>

        <FormField
          label="patients.address"
          htmlFor="patient-address"
          error={errors.address}
          optional
        >
          <Input
            id="patient-address"
            {...register('address', { setValueAs: (value) => (value === '' ? null : value) })}
          />
        </FormField>

        <FormField
          label="patients.emergencyContactName"
          htmlFor="patient-emergency-name"
          error={errors.emergencyContactName}
          optional
        >
          <Input
            id="patient-emergency-name"
            {...register('emergencyContactName', {
              setValueAs: (value) => (value === '' ? null : value),
            })}
          />
        </FormField>

        <FormField
          label="patients.emergencyContactPhone"
          htmlFor="patient-emergency-phone"
          error={errors.emergencyContactPhone}
          optional
        >
          <Input
            id="patient-emergency-phone"
            dir="ltr"
            {...register('emergencyContactPhone', {
              setValueAs: (value) => (value === '' ? null : value),
            })}
          />
        </FormField>
      </form>
    </Modal>
  );
}
