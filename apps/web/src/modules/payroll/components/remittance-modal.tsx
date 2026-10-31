import { LOOKUP_LIST, createRemittanceSchema, type PayrollLine } from "@clinic/shared";
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
import { useRemit } from "@web/modules/payroll/queries";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import { errorToast } from "@web/shared/lib/api-error";
import { schemaErrors } from "@web/shared/lib/form-errors";
import { useLookupOptions } from "@web/shared/queries/lookups";
import { useCurrency } from "@web/shared/queries/clinic";

const owedByDoctor = (line: PayrollLine): string =>
  String(Math.max(0, Math.round(-Number(line.owed))));

export function RemittanceModal({
  line,
  doctorId,
  month,
  onClose,
}: {
  readonly line: PayrollLine | null;
  readonly doctorId: string;
  readonly month: string;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const currency = useCurrency();
  const methods = useLookupOptions(LOOKUP_LIST.PAYMENT_METHOD);
  const remit = useRemit(doctorId);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");

  const body = {
    month,
    amount,
    method,
    note: note.trim() === "" ? null : note.trim(),
  };
  const form = useFormErrors(schemaErrors(createRemittanceSchema, body));
  const { reset } = form;
  const owed = line ? owedByDoctor(line) : "0";

  useEffect(() => {
    if (line) {
      const due = owedByDoctor(line);

      setAmount(due === "0" ? "" : due);
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
      await remit.mutateAsync(body);
      toast.success("payroll.remittance.recorded");
      onClose();
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <Modal
      data-testid="remittance-modal"
      open={line !== null}
      onOpenChange={(open) => !open && onClose()}
      title="payroll.remittance.title"
      footer={
        <>
          <Button variant="secondary" data-testid="remittance-cancel" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            isLoading={remit.isPending}
            aria-disabled={!form.isValid || remit.isPending || undefined}
            data-testid="remittance-save"
            onClick={() => void submit()}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div ref={form.formRef} className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between rounded-panel bg-inset px-3 py-2">
          <span className="text-label text-ink-muted">{t("payroll.remittance.owed")}</span>
          <Money amount={owed} currency={currency} className="font-medium" />
        </div>

        <div onBlur={form.leave("amount")}>
          <FormField
            label="payroll.amount"
            htmlFor="remittance-amount"
            error={form.errors["amount"]}
            required
          >
            <MoneyInput
              id="remittance-amount"
              data-testid="remittance-field-amount"
              currency={currency}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </FormField>
        </div>

        <FormField label="labs.payment.method" htmlFor="remittance-method">
          <Select
            id="remittance-method"
            data-testid="remittance-field-method"
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            options={methods}
          />
        </FormField>

        <FormField label="labs.payment.note" htmlFor="remittance-note" optional>
          <Textarea
            id="remittance-note"
            data-testid="remittance-field-note"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </FormField>
      </div>
    </Modal>
  );
}
