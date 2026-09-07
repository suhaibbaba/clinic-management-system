import { createLabSchema, type Lab, type CreateLabInput } from '@clinic/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, type JSX } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button, FormField, Input, Modal, Textarea, useToast } from '@web/components/ui';
import { useCreateLab, useUpdateLab } from '@web/features/labs/queries';
import { errorMessageKey } from '@web/lib/api-error';

/**
 * Adding a lab, or editing the one detail that changes most — who to ask for.
 *
 * The same modal for both: a lab has five fields, and a separate "edit" dialog
 * would be the same five with a different title.
 */
export function LabFormModal({
  open,
  onOpenChange,
  lab,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Present when editing. */
  readonly lab?: Lab | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const create = useCreateLab();
  const update = useUpdateLab();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateLabInput>({
    resolver: zodResolver(createLabSchema),
    defaultValues: { name: '', phone: '', address: '', contactPerson: '', notes: '' },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: lab?.name ?? '',
        phone: lab?.phone ?? '',
        address: lab?.address ?? '',
        contactPerson: lab?.contactPerson ?? '',
        notes: lab?.notes ?? '',
      });
    }
  }, [open, lab, reset]);

  const submit = handleSubmit(async (values) => {
    try {
      if (lab) {
        await update.mutateAsync({ id: lab.id, body: values });
      } else {
        await create.mutateAsync(values);
      }

      toast.success(lab ? 'labs.updated' : 'labs.created');
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t(lab ? 'labs.editTitle' : 'labs.addTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button isLoading={isSubmitting} onClick={() => void submit()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
        <FormField label="labs.fields.name" htmlFor="lab-name" error={errors.name}>
          <Input id="lab-name" {...register('name')} />
        </FormField>

        <FormField label="labs.fields.contactPerson" htmlFor="lab-contact" optional>
          <Input id="lab-contact" {...register('contactPerson')} />
        </FormField>

        <FormField label="labs.fields.phone" htmlFor="lab-phone" optional>
          <Input id="lab-phone" dir="ltr" inputMode="tel" {...register('phone')} />
        </FormField>

        <FormField label="labs.fields.address" htmlFor="lab-address" optional>
          <Input id="lab-address" {...register('address')} />
        </FormField>

        <FormField label="labs.fields.notes" htmlFor="lab-notes" optional>
          <Textarea id="lab-notes" rows={2} {...register('notes')} />
        </FormField>
      </form>
    </Modal>
  );
}
