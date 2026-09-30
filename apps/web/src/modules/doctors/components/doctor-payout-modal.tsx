import { zodResolver } from "@hookform/resolvers/zod";
import {
  LOOKUP_LIST,
  createStaffPaymentSchema,
  type CreateStaffPaymentInput,
} from "@clinic/shared";
import { useEffect, type JSX } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button, FormField, Modal, MoneyInput, Select, Textarea, useToast } from "@clinic/ui";
import { Money } from "@web/shared/components/money";
import { useLookupOptions } from "@web/shared/queries/lookups";
import { useCurrency } from "@web/shared/queries/clinic";
import { useRecordPayout } from "@web/modules/doctors/queries";
import { errorToast } from "@web/shared/lib/api-error";
import { revealFirstError } from "@web/shared/lib/form-errors";

const EMPTY: CreateStaffPaymentInput = { amount: "", method: "cash", note: "" };

export function DoctorPayoutModal({
  open,
  onOpenChange,
  doctorId,
  balance,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly doctorId: string;
  readonly balance: string;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const currency = useCurrency();
  const methods = useLookupOptions(LOOKUP_LIST.PAYMENT_METHOD);
  const record = useRecordPayout(doctorId);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid },
  } = useForm<CreateStaffPaymentInput>({
    mode: "onTouched",
    resolver: zodResolver(createStaffPaymentSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (open) {
      reset(EMPTY);
    }
  }, [open, reset]);

  const submit = handleSubmit(
    async (values) => {
      try {
        await record.mutateAsync(values);
        toast.success("doctors.settlement.payoutRecorded");
        onOpenChange(false);
      } catch (error) {
        toast.error(...errorToast(error));
      }
    },
    () => revealFirstError(),
  );

  return (
    <Modal
      data-testid="doctor-payout-modal"
      open={open}
      onOpenChange={onOpenChange}
      title="doctors.settlement.recordPayout"
      footer={
        <>
          <Button
            variant="secondary"
            data-testid="doctor-payout-cancel"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            isLoading={isSubmitting}
            aria-disabled={!isValid || isSubmitting || undefined}
            data-testid="doctor-payout-save"
            onClick={() => void submit()}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)} noValidate>
        <div className="flex items-baseline justify-between rounded-panel bg-inset px-3 py-2">
          <span className="text-label text-ink-muted">{t("doctors.settlement.balance")}</span>
          <Money amount={balance} currency={currency} className="font-medium" />
        </div>

        <FormField
          label="doctors.settlement.amount"
          htmlFor="doctor-payout-amount"
          error={errors.amount}
          required
        >
          <MoneyInput
            id="doctor-payout-amount"
            data-testid="doctor-payout-field-amount"
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
            <FormField label="labs.payment.method" htmlFor="doctor-payout-method">
              <Select
                id="doctor-payout-method"
                data-testid="doctor-payout-field-method"
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
                options={methods}
              />
            </FormField>
          )}
        />

        <FormField label="labs.payment.note" htmlFor="doctor-payout-note" optional>
          <Textarea
            id="doctor-payout-note"
            data-testid="doctor-payout-field-note"
            rows={2}
            {...register("note")}
          />
        </FormField>
      </form>
    </Modal>
  );
}
