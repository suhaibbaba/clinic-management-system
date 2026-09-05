import { zodResolver } from '@hookform/resolvers/zod';
import {
  reversePaymentSchema,
  type ReversePaymentInput,
  type StatementEntry,
} from '@clinic/shared';
import { useEffect, type JSX } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button, FormField, Icon, Input, Modal, useToast } from '@web/components/ui';
import { Money } from '@web/features/billing/money';
import { useReversePayment } from '@web/features/billing/queries';
import { errorMessageKey } from '@web/lib/api-error';

interface ReversePaymentModalProps {
  /** The statement line being cancelled; null closes the dialog. */
  payment: StatementEntry | null;
  onOpenChange: (open: boolean) => void;
  currency?: string | undefined;
}

/**
 * Cancels a payment — admin only, and by writing the opposite entry.
 *
 * The wording says "cancel", never "delete", because nothing is removed: the
 * original receipt and its cancellation both stay on the statement, which is
 * what makes the correction auditable.
 */
export function ReversePaymentModal({
  payment,
  onOpenChange,
  currency,
}: ReversePaymentModalProps): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const reverse = useReversePayment();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReversePaymentInput>({ resolver: zodResolver(reversePaymentSchema) });

  useEffect(() => {
    if (payment) {
      reset({ reason: '' });
    }
  }, [payment, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!payment) {
      return;
    }

    try {
      await reverse.mutateAsync({ id: payment.id, body: values });
      toast.success('billing.paymentReversed');
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  });

  return (
    <Modal
      open={payment !== null}
      onOpenChange={onOpenChange}
      title="billing.reversePayment"
      footer={
        <>
          <Button icon={<Icon name="x" />} variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            icon={<Icon name="check" />}
            type="submit"
            form="reverse-payment-form"
            isLoading={isSubmitting}
          >
            {t(isSubmitting ? 'common.saving' : 'billing.confirmReversal')}
          </Button>
        </>
      }
    >
      <form
        id="reverse-payment-form"
        className="flex flex-col gap-4"
        onSubmit={onSubmit}
        noValidate
      >
        <p className="text-value text-ink-muted">
          {t('billing.reverseExplainer')}
          {payment && (
            <>
              {' '}
              <Money amount={payment.amount.replace('-', '')} currency={currency} />
            </>
          )}
        </p>

        <FormField label="billing.reason" htmlFor="reverse-reason" error={errors.reason}>
          <Input
            placeholder={t('common.placeholders.reason')}
            id="reverse-reason"
            hasError={Boolean(errors.reason)}
            {...register('reason')}
          />
        </FormField>
      </form>
    </Modal>
  );
}
