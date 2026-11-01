import {
  LOOKUP_LIST,
  createSupplierPaymentSchema,
  type CreateSupplierPaymentInput,
} from "@clinic/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, type JSX } from "react";
import { Controller, useForm } from "react-hook-form";
import { revealFirstError } from "@web/shared/lib/form-errors";
import { useTranslation } from "react-i18next";
import {
  Button,
  FormField,
  Modal,
  MoneyInput,
  Select,
  Summary,
  Textarea,
  useToast,
} from "@clinic/ui";
import { Money } from "@web/shared/components/money";
import { useLookupOptions } from "@web/shared/queries/lookups";
import { usePaySupplier } from "@web/modules/inventory/queries";
import { errorToast } from "@web/shared/lib/api-error";

export function SupplierPaymentModal({
  supplier,
  currency,
  onClose,
  "data-testid": testId = "supplier-payment-modal",
}: {
  readonly "data-testid"?: string | undefined;
  readonly supplier: {
    readonly id: string;
    readonly name: string;
    readonly balance?: string | undefined;
  } | null;
  readonly currency: string | undefined;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const methods = useLookupOptions(LOOKUP_LIST.PAYMENT_METHOD);
  const toast = useToast();
  const pay = usePaySupplier();
  const firstMethod = methods[0]?.value ?? "";

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid },
  } = useForm<CreateSupplierPaymentInput>({
    mode: "onTouched",
    resolver: zodResolver(createSupplierPaymentSchema),
    defaultValues: { supplierId: "", amount: "", method: firstMethod, note: "" },
  });

  useEffect(() => {
    if (supplier) {
      reset({
        supplierId: supplier.id,
        amount: "",
        method: firstMethod,
        note: "",
        requestId: crypto.randomUUID(),
      });
    }
  }, [supplier, firstMethod, reset]);

  const submit = handleSubmit(
    async (values) => {
      try {
        await pay.mutateAsync(values);
        toast.success("inventory.suppliers.payment.recorded");
        onClose();
      } catch (error) {
        toast.error(...errorToast(error));
      }
    },
    () => revealFirstError(),
  );

  return (
    <Modal
      data-testid={testId}
      open={supplier !== null}
      onOpenChange={(open) => !open && onClose()}
      title={t("inventory.suppliers.payment.title", { supplier: supplier?.name ?? "" })}
      description={t("inventory.suppliers.payment.description")}
      footer={
        <>
          <Button variant="secondary" data-testid={`${testId}-cancel`} onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            isLoading={isSubmitting}
            aria-disabled={!isValid || isSubmitting || undefined}
            data-testid={`${testId}-save`}
            onClick={() => void submit()}
          >
            {t("inventory.suppliers.payment.submit")}
          </Button>
        </>
      }
    >
      <form
        data-testid={`${testId}-form`}
        className="flex flex-col gap-4"
        onSubmit={(event) => void submit(event)}
      >
        <Summary
          data-testid={`${testId}-current-balance`}
          rows={[
            {
              key: "balance",
              label: t("inventory.suppliers.balance"),
              value: <Money amount={supplier?.balance ?? "0.00"} currency={currency} />,
              emphasis: "total",
            },
          ]}
        />

        <FormField
          label="inventory.suppliers.payment.amount"
          htmlFor="supplier-payment-amount"
          error={errors.amount}
          required
        >
          <MoneyInput
            id="supplier-payment-amount"
            data-testid="supplier-payment-field-amount"
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
            <FormField label="inventory.suppliers.payment.method" htmlFor="supplier-payment-method">
              <Select
                id="supplier-payment-method"
                data-testid="supplier-payment-field-method"
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
                options={methods}
              />
            </FormField>
          )}
        />

        <FormField
          label="inventory.suppliers.payment.note"
          htmlFor="supplier-payment-note"
          optional
        >
          <Textarea
            id="supplier-payment-note"
            data-testid="supplier-payment-field-note"
            rows={2}
            {...register("note")}
          />
        </FormField>
      </form>
    </Modal>
  );
}
