import { zodResolver } from '@hookform/resolvers/zod';
import { createPaymentSchema, PAYMENT_METHODS, type CreatePaymentInput } from '@clinic/shared';
import { useEffect, type JSX } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button, FormField, Input, Modal, Select, useToast } from '@web/components/ui';
import { openReceipt } from '@web/features/billing/documents';
import { useCreatePayment } from '@web/features/billing/queries';
import { errorMessageKey } from '@web/lib/api-error';

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  /** Prefills the amount — the outstanding balance, when there is one. */
  suggestedAmount?: string | undefined;
  currency?: string | undefined;
}

/**
 * Records a payment and prints its receipt.
 *
 * The amount is typed, never computed from a suggested total behind the user's
 * back: a patient often pays part of what they owe, and the receipt has to say
 * what actually changed hands.
 */
export function PaymentModal({
  open,
  onOpenChange,
  patientId,
  suggestedAmount,
  currency,
}: PaymentModalProps): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const createPayment = useCreatePayment();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreatePaymentInput>({ resolver: zodResolver(createPaymentSchema) });

  useEffect(() => {
    if (open) {
      reset({
        patientId,
        amount: suggestedAmount && Number(suggestedAmount) > 0 ? suggestedAmount : '',
        method: 'cash',
        note: '',
      });
    }
  }, [open, patientId, suggestedAmount, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const payment = await createPayment.mutateAsync({ ...values, patientId });
      toast.success('billing.paymentRecorded');
      onOpenChange(false);

      // The receipt is the point of taking the payment, so it opens straight
      // away rather than waiting for someone to find a print button.
      await openReceipt(payment.id);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="billing.recordPayment"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="payment-form" disabled={isSubmitting}>
            {t(isSubmitting ? 'common.saving' : 'billing.recordAndPrint')}
          </Button>
        </>
      }
    >
      <form id="payment-form" className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <FormField label="billing.amount" htmlFor="payment-amount" error={errors.amount}>
          <div className="flex items-center gap-2">
            <Input
              id="payment-amount"
              dir="ltr"
              inputMode="decimal"
              hasError={Boolean(errors.amount)}
              {...register('amount')}
            />
            {currency && <span className="text-value text-ink-muted">{currency}</span>}
          </div>
        </FormField>

        <FormField label="billing.method" htmlFor="payment-method" error={errors.method}>
          <Select
            id="payment-method"
            options={PAYMENT_METHODS.map((method) => ({
              value: method,
              label: t(`billing.methods.${method}`),
            }))}
            {...register('method')}
          />
        </FormField>

        <FormField label="billing.note" htmlFor="payment-note" error={errors.note} optional>
          <Input
            id="payment-note"
            {...register('note', { setValueAs: (value) => (value === '' ? null : value) })}
          />
        </FormField>
      </form>
    </Modal>
  );
}
