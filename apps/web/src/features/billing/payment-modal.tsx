import { zodResolver } from "@hookform/resolvers/zod";
import {
  createPaymentSchema,
  formatMinorUnits,
  LOOKUP_LIST,
  toMinorUnits,
  type CreatePaymentInput,
} from "@clinic/shared";
import { useEffect, type JSX } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  Button,
  FormField,
  Icon,
  Modal,
  MoneyInput,
  Select,
  Textarea,
  useConfirm,
  useToast,
} from "@clinic/ui";
import { openReceipt } from "@web/features/billing/documents";
import { useLookupLabels, useLookupOptions } from "@web/features/lookups/queries";
import { useCreatePayment } from "@web/features/billing/queries";
import { errorMessageKey } from "@web/lib/api-error";
import { moneyText } from "@web/lib/format";
import { ellipsis } from "@web/i18n/ellipsis";

interface PaymentModalProps {
  "data-testid"?: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  /** What the patient owes: offered as the amount, and the most a payment may be. */
  balance?: string | undefined;
  currency?: string | undefined;
}

// The amount is typed, never computed from a suggested total: a patient often pays part, and the
// receipt has to say what changed hands.
export function PaymentModal({
  open,
  onOpenChange,
  patientId,
  balance = "0.00",
  currency,
  "data-testid": testId = "payment-modal",
}: PaymentModalProps): JSX.Element {
  const { t } = useTranslation();
  const methods = useLookupOptions(LOOKUP_LIST.PAYMENT_METHOD);
  const methodLabel = useLookupLabels(LOOKUP_LIST.PAYMENT_METHOD);
  const { confirm, dialog } = useConfirm(`${testId}-confirm`);
  const toast = useToast();
  const createPayment = useCreatePayment();

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<CreatePaymentInput>({ resolver: zodResolver(createPaymentSchema) });

  const amount = watch("amount") ?? "";
  const typed = /^\d+(\.\d{1,2})?$/.test(amount);
  const exceeds = typed && toMinorUnits(amount) > toMinorUnits(balance);
  const after = formatMinorUnits(toMinorUnits(balance) - (typed ? toMinorUnits(amount) : 0));

  useEffect(() => {
    if (open) {
      reset({
        patientId,
        amount: "",
        method: "cash",
        note: "",
      });
    }
  }, [open, patientId, balance, reset]);

  const record = async (values: CreatePaymentInput): Promise<void> => {
    try {
      const payment = await createPayment.mutateAsync({ ...values, patientId });
      toast.success("billing.paymentRecorded");
      onOpenChange(false);

      await openReceipt(payment.id);
    } catch (error) {
      toast.error(errorMessageKey(error));
      throw error;
    }
  };

  const onSubmit = handleSubmit((values) => {
    if (exceeds) {
      return;
    }

    confirm({
      title: "billing.confirmPayment.title",
      titleValues: { amount: moneyText(values.amount, currency) },
      tone: "primary",
      confirmLabel: "billing.recordAndPrint",
      consequences: [
        t("billing.confirmPayment.method", { method: methodLabel(values.method) }),
        t("billing.confirmPayment.remaining", {
          amount: moneyText(
            formatMinorUnits(toMinorUnits(balance) - toMinorUnits(values.amount)),
            currency,
          ),
        }),
        t("billing.confirmPayment.permanent"),
      ],
      onConfirm: () => record(values),
    });
  });

  return (
    <>
      {dialog}
      <Modal
        data-testid={testId}
        open={open}
        onOpenChange={onOpenChange}
        title="billing.recordPayment"
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
              icon={<Icon name="chevron-end" />}
              type="submit"
              form="payment-form"
              data-testid={`${testId}-save`}
              disabled={exceeds}
            >
              {t("common.continue")}
            </Button>
          </>
        }
      >
        <form
          id="payment-form"
          data-testid={`${testId}-form`}
          className="flex flex-col gap-4"
          onSubmit={onSubmit}
          noValidate
        >
          <FormField
            label="billing.amount"
            htmlFor="payment-amount"
            error={errors.amount}
            hint="billing.balanceAfter"
            hintValues={{ amount: moneyText(after, currency) }}
            {...(exceeds && {
              error: { type: "too_big" },
              errorKey: "errors.payment.exceedsBalance",
            })}
          >
            <MoneyInput
              placeholder={t("common.placeholders.amount")}
              id="payment-amount"
              data-testid="payment-field-amount"
              currency={currency}
              hasError={Boolean(errors.amount) || exceeds}
              {...register("amount")}
            />
          </FormField>

          <FormField label="billing.method" htmlFor="payment-method" error={errors.method}>
            <Controller
              name="method"
              control={control}
              render={({ field }) => (
                <Select
                  placeholder={t("common.placeholders.selectMethod")}
                  id="payment-method"
                  data-testid="payment-field-method"
                  options={methods}
                  value={field.value ?? ""}
                  onBlur={field.onBlur}
                  onChange={(event) => field.onChange(event.target.value)}
                />
              )}
            />
          </FormField>

          <FormField label="billing.note" htmlFor="payment-note" error={errors.note} optional>
            <Textarea
              placeholder={ellipsis(t("common.placeholders.note"))}
              id="payment-note"
              data-testid="payment-field-note"
              rows={3}
              {...register("note", { setValueAs: (value) => (value === "" ? null : value) })}
            />
          </FormField>
        </form>
      </Modal>
    </>
  );
}
