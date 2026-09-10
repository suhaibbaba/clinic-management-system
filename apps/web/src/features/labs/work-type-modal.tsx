import {
  createLabWorkTypeSchema,
  type CreateLabWorkTypeInput,
  type LabWorkType,
} from '@clinic/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, type JSX } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button, FormField, Input, Modal, MoneyInput, Switch, useToast } from '@web/components/ui';
import { useCreateWorkType, useUpdateWorkType } from '@web/features/labs/queries';
import { errorMessageKey } from '@web/lib/api-error';
import { useCurrency } from '@web/features/clinic/queries';

export function WorkTypeModal({
  open,
  onOpenChange,
  labId,
  workType,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly labId: string;
  readonly workType?: LabWorkType | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const currency = useCurrency();
  const toast = useToast();
  const create = useCreateWorkType();
  const update = useUpdateWorkType();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateLabWorkTypeInput>({
    resolver: zodResolver(createLabWorkTypeSchema),
    defaultValues: { nameAr: '', defaultPrice: '', isActive: true },
  });

  useEffect(() => {
    if (open) {
      reset({
        nameAr: workType?.nameAr ?? '',
        defaultPrice: workType?.defaultPrice ?? '',
        isActive: workType?.isActive ?? true,
      });
    }
  }, [open, workType, reset]);

  const submit = handleSubmit(async (values) => {
    try {
      if (workType) {
        await update.mutateAsync({ id: workType.id, body: values });
      } else {
        await create.mutateAsync({ labId, body: values });
      }

      toast.success('labs.prices.saved');
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t(workType ? 'labs.prices.editTitle' : 'labs.prices.addTitle')}
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
        <FormField label="labs.prices.name" htmlFor="work-type-name" error={errors.nameAr}>
          <Input id="work-type-name" {...register('nameAr')} />
        </FormField>

        <FormField
          label="labs.prices.price"
          htmlFor="work-type-price"
          error={errors.defaultPrice}
          hint={t('labs.prices.snapshotNote')}
        >
          <MoneyInput
            id="work-type-price"
            currency={currency}
            placeholder="0"
            hasError={Boolean(errors.defaultPrice)}
            {...register('defaultPrice')}
          />
        </FormField>

        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <Switch
              checked={field.value ?? true}
              onCheckedChange={field.onChange}
              label={t('labs.prices.active')}
            />
          )}
        />
      </form>
    </Modal>
  );
}
