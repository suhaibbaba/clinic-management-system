import { zodResolver } from '@hookform/resolvers/zod';
import { createPaymentSchema, LOOKUP_LIST, type CreatePaymentInput } from '@clinic/shared';
import { useEffect, type JSX } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  Button,
  FormField,
  Icon,
  Input,
  Modal,
  MoneyInput,
  Select,
  useToast,
} from '@web/components/ui';
import { openReceipt } from '@web/features/billing/documents';
import { useLookupOptions } from '@web/features/lookups/queries';
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
  const methods = useLookupOptions(LOOKUP_LIST.PAYMENT_METHOD);
  const toast = useToast();
  const createPayment = useCreatePayment();

  const {
    register,
    handleSubmit,
    reset,
    control,
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
          <Button icon={<Icon name="x" />} variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            icon={<Icon name="check" />}
            type="submit"
            form="payment-form"
            isLoading={isSubmitting}
          >
            {t(isSubmitting ? 'common.saving' : 'billing.recordAndPrint')}
          </Button>
        </>
      }
    >
      <form id="payment-form" className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <FormField label="billing.amount" htmlFor="payment-amount" error={errors.amount}>
          <MoneyInput
            placeholder={t('common.placeholders.amount')}
            id="payment-amount"
            currency={currency}
            hasError={Boolean(errors.amount)}
            {...register('amount')}
          />
        </FormField>

        <FormField label="billing.method" htmlFor="payment-method" error={errors.method}>
          <Controller
            name="method"
            control={control}
            render={({ field }) => (
              <Select
                placeholder={t('common.placeholders.selectMethod')}
                id="payment-method"
                options={methods}
                value={field.value ?? ''}
                onBlur={field.onBlur}
                onChange={(event) => field.onChange(event.target.value)}
              />
            )}
          />
        </FormField>

        <FormField label="billing.note" htmlFor="payment-note" error={errors.note} optional>
          <Input
            placeholder={t('common.placeholders.note')}
            id="payment-note"
            {...register('note', { setValueAs: (value) => (value === '' ? null : value) })}
          />
        </FormField>
      </form>
    </Modal>
  );
}
