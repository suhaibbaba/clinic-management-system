import { salaryTermsInputSchema, type PayrollLine } from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, FormField, Modal, Money, MoneyInput, Select, useToast } from "@clinic/ui";
import { useSalaryHistory, useSetSalary } from "@web/modules/payroll/queries";
import { shiftMonth } from "@web/modules/payroll/lib/months";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import { errorToast } from "@web/shared/lib/api-error";
import { schemaErrors } from "@web/shared/lib/form-errors";
import { formatMonth } from "@web/shared/lib/format";
import { useCurrency } from "@web/shared/queries/clinic";

const whole = (amount: string): string => String(Math.round(Number(amount)));

export function SalaryModal({
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
  const save = useSetSalary();
  const history = useSalaryHistory(line?.userId ?? null);

  const [amount, setAmount] = useState("");
  const [effectiveMonth, setEffectiveMonth] = useState(month);

  const body = { monthlyAmount: amount, effectiveMonth };
  const form = useFormErrors(schemaErrors(salaryTermsInputSchema, body));
  const { reset } = form;

  useEffect(() => {
    if (line) {
      setAmount(line.base === "0.00" ? "" : whole(line.base));
      setEffectiveMonth(month);
      reset();
    }
  }, [line, month, reset]);

  const submit = async (): Promise<void> => {
    if (!line || !form.check()) {
      return;
    }

    try {
      await save.mutateAsync({ userId: line.userId, body });
      toast.success("payroll.salarySaved");
      onClose();
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <Modal
      data-testid="payroll-salary-modal"
      open={line !== null}
      onOpenChange={(open) => !open && onClose()}
      title="payroll.setSalary"
      description="payroll.setSalaryHint"
      footer={
        <>
          <Button variant="secondary" data-testid="payroll-salary-cancel" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            isLoading={save.isPending}
            aria-disabled={!form.isValid || save.isPending || undefined}
            data-testid="payroll-salary-save"
            onClick={() => void submit()}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div ref={form.formRef} className="flex flex-col gap-4">
        <div onBlur={form.leave("monthlyAmount")}>
          <FormField
            label="payroll.monthlySalary"
            htmlFor="payroll-salary-amount"
            error={form.errors["monthlyAmount"]}
            required
          >
            <MoneyInput
              id="payroll-salary-amount"
              data-testid="payroll-field-salary"
              currency={currency}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </FormField>
        </div>

        <div onBlur={form.leave("effectiveMonth")}>
          <FormField
            label="payroll.effectiveFrom"
            htmlFor="payroll-salary-month"
            error={form.errors["effectiveMonth"]}
          >
            <Select
              id="payroll-salary-month"
              data-testid="payroll-field-effective-month"
              value={effectiveMonth}
              onChange={(event) => setEffectiveMonth(event.target.value)}
              options={[0, 1, 2, 3, 4, 5, 6].map((offset) => {
                const value = shiftMonth(month, offset);

                return { value, label: formatMonth(value) };
              })}
            />
          </FormField>
        </div>

        {(history.data ?? []).length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-label font-medium text-ink">{t("payroll.salaryHistory")}</p>
            <ul className="flex flex-col gap-1">
              {history.data?.map((term) => (
                <li
                  key={term.id}
                  className="flex items-center justify-between rounded-panel bg-inset px-3 py-1.5 text-meta"
                >
                  <span>{formatMonth(term.effectiveMonth)}</span>
                  <Money amount={term.monthlyAmount} currency={currency} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
