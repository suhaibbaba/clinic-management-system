import {
  PAYMENT_METHODS,
  createLabPaymentSchema,
  type CreateLabPaymentInput,
  type LabBalance,
} from '@clinic/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, type JSX } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button, FormField, Input, Modal, Select, Textarea, useToast } from '@web/components/ui';
import { Money } from '@web/features/billing/money';
import { usePayLab } from '@web/features/labs/queries';
import { errorMessageKey } from '@web/lib/api-error';

/**
 * Paying a lab.
 *
 * The balance is shown above the amount and not defaulted into it: paying a
 * lab in full is one of several normal things to do, and a prefilled figure is
 * a figure somebody stops reading. The ledger is append-only, so a mistake here
 * is corrected by an admin's reversing entry rather than by an edit.
 */
export function LabPaymentModal({
  open,
  onOpenChange,
  labId,
  labName,
  balance,
  currency,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly labId: string;
  readonly labName: string;
  readonly balance: LabBalance | undefined;
  readonly currency: string | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const pay = usePayLab();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateLabPaymentInput>({
    resolver: zodResolver(createLabPaymentSchema),
    defaultValues: { labId, amount: '', method: 'cash', note: '' },
  });

  useEffect(() => {
    if (open) {
      reset({ labId, amount: '', method: 'cash', note: '' });
    }
  }, [open, labId, reset]);

  const submit = handleSubmit(async (values) => {
    try {
      await pay.mutateAsync(values);
      toast.success('labs.payment.recorded');
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('labs.payment.title', { lab: labName })}
      description={t('labs.payment.description')}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button isLoading={isSubmitting} onClick={() => void submit()}>
            {t('labs.payment.submit')}
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
        <div className="flex items-baseline justify-between rounded-panel bg-inset px-3 py-2">
          <span className="text-label text-ink-muted">{t('labs.payment.currentBalance')}</span>
          <Money
            amount={balance?.balance ?? '0.00'}
            currency={currency}
            className="font-semibold"
          />
        </div>

        <FormField label="labs.payment.amount" htmlFor="lab-payment-amount" error={errors.amount}>
          <Input
            id="lab-payment-amount"
            dir="ltr"
            inputMode="decimal"
            placeholder="0.00"
            {...register('amount')}
          />
        </FormField>

        <Controller
          control={control}
          name="method"
          render={({ field }) => (
            <FormField label="labs.payment.method" htmlFor="lab-payment-method">
              <Select
                id="lab-payment-method"
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
                options={PAYMENT_METHODS.map((method) => ({
                  value: method,
                  label: t(`billing.methods.${method}`),
                }))}
              />
            </FormField>
          )}
        />

        <FormField label="labs.payment.note" htmlFor="lab-payment-note" optional>
          <Textarea id="lab-payment-note" rows={2} {...register('note')} />
        </FormField>
      </form>
    </Modal>
  );
}
