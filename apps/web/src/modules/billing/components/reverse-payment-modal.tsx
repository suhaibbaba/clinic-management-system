import { zodResolver } from "@hookform/resolvers/zod";
import {
  reversePaymentSchema,
  type ReversePaymentInput,
  type StatementEntry,
} from "@clinic/shared";
import { useEffect, type JSX } from "react";
import { useForm } from "react-hook-form";
import { revealFirstError } from "@web/shared/lib/form-errors";
import { useTranslation } from "react-i18next";
import { Button, FormField, Icon, Input, Modal, useToast } from "@clinic/ui";
import { Money } from "@web/shared/components/money";
import { useReversePayment } from "@web/modules/billing/queries";
import { errorToast } from "@web/shared/lib/api-error";
import { ellipsis } from "@web/i18n/ellipsis";

interface ReversePaymentModalProps {
  "data-testid"?: string | undefined;
  payment: StatementEntry | null;
  onOpenChange: (open: boolean) => void;
  currency?: string | undefined;
}

export function ReversePaymentModal({
  payment,
  onOpenChange,
  currency,
  "data-testid": testId = "reverse-payment-modal",
}: ReversePaymentModalProps): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const reverse = useReversePayment();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid },
  } = useForm<ReversePaymentInput>({
    mode: "onTouched",
    resolver: zodResolver(reversePaymentSchema),
  });

  useEffect(() => {
    if (payment) {
      reset({ reason: "" });
    }
  }, [payment, reset]);

  const onSubmit = handleSubmit(
    async (values) => {
      if (!payment) {
        return;
      }

      try {
        await reverse.mutateAsync({ id: payment.id, body: values });
        toast.success("billing.paymentReversed");
        onOpenChange(false);
      } catch (error) {
        toast.error(...errorToast(error));
      }
    },
    () => revealFirstError(),
  );

  return (
    <Modal
      data-testid={testId}
      open={payment !== null}
      onOpenChange={onOpenChange}
      title="billing.reversePayment"
      footer={
        <>
          <Button
            icon={<Icon name="x" />}
            variant="secondary"
            data-testid={`${testId}-cancel`}
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            icon={<Icon name="check" />}
            type="submit"
            aria-disabled={!isValid || isSubmitting || undefined}
            form="reverse-payment-form"
            data-testid={`${testId}-confirm`}
            isLoading={isSubmitting}
          >
            {isSubmitting ? ellipsis(t("common.saving")) : t("billing.confirmReversal")}
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
        <p data-testid={`${testId}-explainer`} className="text-value text-ink-muted">
          {t("billing.reverseExplainer")}
          {payment && (
            <>
              {" "}
              <Money amount={payment.amount.replace("-", "")} currency={currency} />
            </>
          )}
        </p>

        <FormField label="billing.reason" htmlFor="reverse-reason" error={errors.reason}>
          <Input
            placeholder={t("common.placeholders.reason")}
            id="reverse-reason"
            data-testid="reverse-field-reason"
            hasError={Boolean(errors.reason)}
            {...register("reason")}
          />
        </FormField>
      </form>
    </Modal>
  );
}
