import { createVisitSchema, type CreateVisitInput, type Doctor, type Visit } from '@clinic/shared';
import { useEffect, type JSX } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  Button,
  FormField,
  Icon,
  Input,
  Modal,
  Select,
  Textarea,
  useToast,
} from '@web/components/ui';
import { useSaveVisit } from '@web/features/patients/queries';
import { errorMessageKey } from '@web/lib/api-error';

interface VisitFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  doctors: readonly Doctor[];
  /** Null records a visit; a row edits it. */
  visit: Visit | null;
}

/** `<input type="datetime-local">` wants a local `YYYY-MM-DDTHH:mm`, not an instant. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/** What the form holds: the same fields, with the date as local wall-clock time. */
type VisitFormValues = Omit<CreateVisitInput, 'visitDate'> & { visitDate: string };

/**
 * The clinical record of one encounter: what the patient came in with, what was
 * found, and what it was judged to be.
 *
 * These are exactly the fields ROLES.md keeps away from a receptionist, which is
 * why the whole tab is limited to admin and doctor.
 */
export function VisitFormModal({
  open,
  onOpenChange,
  patientId,
  doctors,
  visit,
}: VisitFormModalProps): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const saveVisit = useSaveVisit(patientId);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<VisitFormValues>();

  useEffect(() => {
    if (!open) {
      return;
    }

    reset(
      visit
        ? {
            patientId,
            doctorId: visit.doctorId,
            visitDate: toLocalInput(visit.visitDate),
            complaint: visit.complaint,
            examination: visit.examination,
            diagnosis: visit.diagnosis,
            notes: visit.notes,
          }
        : {
            patientId,
            doctorId: doctors[0]?.id ?? '',
            visitDate: toLocalInput(new Date().toISOString()),
            complaint: '',
            examination: '',
            diagnosis: '',
            notes: '',
          },
    );
  }, [open, visit, patientId, reset]);

  // Doctors may still be loading when the modal opens; fill the select the
  // moment they arrive, without touching anything already typed.
  useEffect(() => {
    if (open && !getValues('doctorId') && doctors[0]) {
      setValue('doctorId', doctors[0].id);
    }
  }, [open, doctors, getValues, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    // The payload is validated, not the form: the date field holds local
    // wall-clock time and only becomes an instant here, so checking the form
    // against the shared schema would reject a value the API never sees. This
    // way the one schema in `packages/shared` still decides, and it decides
    // about exactly what is sent.
    const payload = {
      ...values,
      patientId,
      ...(values.visitDate ? { visitDate: new Date(values.visitDate).toISOString() } : {}),
    };

    const parsed = createVisitSchema.safeParse(payload);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];

        if (typeof field === 'string') {
          setError(field as keyof VisitFormValues, { type: issue.code, message: issue.message });
        }
      }
      return;
    }

    try {
      await saveVisit.mutateAsync({
        ...(visit ? { id: visit.id } : {}),
        body: parsed.data,
      });

      toast.success(visit ? 'visits.updated' : 'visits.created');
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={visit ? 'visits.edit' : 'visits.create'}
      size="lg"
      footer={
        <>
          <Button icon={<Icon name="x" />} variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            icon={<Icon name="check" />}
            type="submit"
            form="visit-form"
            isLoading={isSubmitting}
          >
            {t(isSubmitting ? 'common.saving' : 'common.save')}
          </Button>
        </>
      }
    >
      <form id="visit-form" className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <FormField label="visits.doctor" htmlFor="visit-doctor" error={errors.doctorId}>
          <Select
            id="visit-doctor"
            options={doctors.map((doctor) => ({ value: doctor.id, label: doctor.user.name }))}
            {...register('doctorId')}
          />
        </FormField>

        <FormField label="visits.date" htmlFor="visit-date" error={errors.visitDate}>
          <Input
            adornment="calendar"
            id="visit-date"
            type="datetime-local"
            dir="ltr"
            {...register('visitDate')}
          />
        </FormField>

        <FormField label="visits.complaint" htmlFor="visit-complaint" error={errors.complaint}>
          <Textarea
            placeholder={t('common.placeholders.complaint')}
            id="visit-complaint"
            rows={2}
            {...register('complaint', { setValueAs: (v) => (v === '' ? null : v) })}
          />
        </FormField>

        <FormField label="visits.examination" htmlFor="visit-exam" error={errors.examination}>
          <Textarea
            placeholder={t('common.placeholders.examination')}
            id="visit-exam"
            rows={3}
            {...register('examination', { setValueAs: (v) => (v === '' ? null : v) })}
          />
        </FormField>

        <FormField label="visits.diagnosis" htmlFor="visit-diagnosis" error={errors.diagnosis}>
          <Textarea
            placeholder={t('common.placeholders.diagnosis')}
            id="visit-diagnosis"
            rows={2}
            {...register('diagnosis', { setValueAs: (v) => (v === '' ? null : v) })}
          />
        </FormField>

        <FormField label="visits.notes" htmlFor="visit-notes" error={errors.notes} optional>
          <Textarea
            placeholder={t('common.placeholders.visitNotes')}
            id="visit-notes"
            rows={2}
            {...register('notes', { setValueAs: (v) => (v === '' ? null : v) })}
          />
        </FormField>
      </form>
    </Modal>
  );
}
