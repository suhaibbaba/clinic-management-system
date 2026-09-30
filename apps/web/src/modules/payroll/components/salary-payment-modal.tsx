import { LOOKUP_LIST, createSalaryPaymentSchema, type PayrollLine } from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  FormField,
  Modal,
  Money,
  MoneyInput,
  Select,
  Textarea,
  useToast,
} from "@clinic/ui";
import { usePaySalary } from "@web/modules/payroll/queries";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import { errorToast } from "@web/shared/lib/api-error";
import { schemaErrors } from "@web/shared/lib/form-errors";
import { useLookupOptions } from "@web/shared/queries/lookups";
import { useCurrency } from "@web/shared/queries/clinic";

const whole = (amount: string): string => String(Math.max(0, Math.round(Number(amount))));

export function SalaryPaymentModal({
  line,
  month,
  onClose,
}: {
  readonly line: PayrollLine | null;
  readonly month: string;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const currency = useCurrency();
  const methods = useLookupOptions(LOOKUP_LIST.PAYMENT_METHOD);
  const pay = usePaySalary(month);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");

  const body = {
    userId: line?.userId ?? "",
    amount,
    method,
    note: note.trim() === "" ? null : note.trim(),
  };
  const form = useFormErrors(schemaErrors(createSalaryPaymentSchema, body));
  const { reset } = form;

  useEffect(() => {
    if (line) {
      setAmount(Number(line.remaining) > 0 ? whole(line.remaining) : "");
      setMethod("cash");
      setNote("");
      reset();
    }
  }, [line, reset]);

  const submit = async (): Promise<void> => {
    if (!line || !form.check()) {
      return;
    }

    try {
      await pay.mutateAsync(body);
      toast.success("payroll.paid");
      onClose();
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <Modal
      data-testid="payroll-payment-modal"
      open={line !== null}
      onOpenChange={(open) => !open && onClose()}
      title="payroll.pay"
      footer={
        <>
          <Button variant="secondary" data-testid="payroll-payment-cancel" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            isLoading={pay.isPending}
            aria-disabled={!form.isValid || pay.isPending || undefined}
            data-testid="payroll-payment-save"
            onClick={() => void submit()}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div ref={form.formRef} className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between rounded-panel bg-inset px-3 py-2">
          <span className="text-label text-ink-muted">{t("payroll.remaining")}</span>
          <Money amount={line?.remaining ?? "0.00"} currency={currency} className="font-medium" />
        </div>

        <div onBlur={form.leave("amount")}>
          <FormField
            label="payroll.amount"
            htmlFor="payroll-payment-amount"
            error={form.errors["amount"]}
            required
          >
            <MoneyInput
              id="payroll-payment-amount"
              data-testid="payroll-field-payment-amount"
              currency={currency}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </FormField>
        </div>

        <FormField label="labs.payment.method" htmlFor="payroll-payment-method">
          <Select
            id="payroll-payment-method"
            data-testid="payroll-field-payment-method"
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            options={methods}
          />
        </FormField>

        <FormField label="labs.payment.note" htmlFor="payroll-payment-note" optional>
          <Textarea
            id="payroll-payment-note"
            data-testid="payroll-field-payment-note"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </FormField>
      </div>
    </Modal>
  );
}
