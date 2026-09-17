import {
  LOOKUP_LIST,
  createLabPaymentSchema,
  type CreateLabPaymentInput,
  type LabBalance,
} from "@clinic/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, type JSX } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Button, FormField, Modal, MoneyInput, Select, Textarea, useToast } from "@clinic/ui";
import { Money } from "@web/features/billing/money";
import { useLookupOptions } from "@web/features/lookups/queries";
import { usePayLab } from "@web/features/labs/queries";
import { errorMessageKey } from "@web/lib/api-error";

export function LabPaymentModal({
  open,
  onOpenChange,
  labId,
  labName,
  balance,
  currency,
  "data-testid": testId = "lab-payment-modal",
}: {
  readonly "data-testid"?: string | undefined;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly labId: string;
  readonly labName: string;
  readonly balance: LabBalance | undefined;
  readonly currency: string | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const methods = useLookupOptions(LOOKUP_LIST.PAYMENT_METHOD);
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
    defaultValues: { labId, amount: "", method: "cash", note: "" },
  });

  useEffect(() => {
    if (open) {
      reset({ labId, amount: "", method: "cash", note: "" });
    }
  }, [open, labId, reset]);

  const submit = handleSubmit(async (values) => {
    try {
      await pay.mutateAsync(values);
      toast.success("labs.payment.recorded");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  });

  return (
    <Modal
      data-testid={testId}
      open={open}
      onOpenChange={onOpenChange}
      title={t("labs.payment.title", { lab: labName })}
      description={t("labs.payment.description")}
      footer={
        <>
          <Button
            variant="secondary"
            data-testid={`${testId}-cancel`}
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            isLoading={isSubmitting}
            data-testid={`${testId}-save`}
            onClick={() => void submit()}
          >
            {t("labs.payment.submit")}
          </Button>
        </>
      }
    >
      <form
        data-testid={`${testId}-form`}
        className="flex flex-col gap-4"
        onSubmit={(event) => void submit(event)}
      >
        <div
          data-testid={`${testId}-current-balance`}
          className="flex items-baseline justify-between rounded-panel bg-inset px-3 py-2"
        >
          <span className="text-label text-ink-muted">{t("labs.payment.currentBalance")}</span>
          <Money amount={balance?.balance ?? "0.00"} currency={currency} className="font-medium" />
        </div>

        <FormField label="labs.payment.amount" htmlFor="lab-payment-amount" error={errors.amount}>
          <MoneyInput
            id="lab-payment-amount"
            data-testid="lab-payment-field-amount"
            currency={currency}
            placeholder="0"
            hasError={Boolean(errors.amount)}
            {...register("amount")}
          />
        </FormField>

        <Controller
          control={control}
          name="method"
          render={({ field }) => (
            <FormField label="labs.payment.method" htmlFor="lab-payment-method">
              <Select
                id="lab-payment-method"
                data-testid="lab-payment-field-method"
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
                options={methods}
              />
            </FormField>
          )}
        />

        <FormField label="labs.payment.note" htmlFor="lab-payment-note" optional>
          <Textarea
            id="lab-payment-note"
            data-testid="lab-payment-field-note"
            rows={2}
            {...register("note")}
          />
        </FormField>
      </form>
    </Modal>
  );
}
