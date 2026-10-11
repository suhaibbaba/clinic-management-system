import {
  LAB_COST_BEARERS,
  PAY_BASES,
  payRulesInputSchema,
  type LabCostBearer,
  type PayBasis,
} from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, FormField, Modal, QuantityInput, Select, useToast } from "@clinic/ui";
import { usePayRules, useSetPayRules } from "@web/modules/payroll/queries";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import { errorToast } from "@web/shared/lib/api-error";
import { schemaErrors } from "@web/shared/lib/form-errors";
import { formatMonth } from "@web/shared/lib/format";
import { monthsFrom } from "@web/shared/lib/months";

export function PayRulesModal({
  open,
  thisMonth,
  onClose,
}: {
  readonly open: boolean;
  readonly thisMonth: string;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const rules = usePayRules(open);
  const save = useSetPayRules();

  const [tax, setTax] = useState("0");
  const [overhead, setOverhead] = useState("0");
  const [basis, setBasis] = useState<PayBasis>("done");
  const [bearer, setBearer] = useState<LabCostBearer>("shared");
  const [effectiveMonth, setEffectiveMonth] = useState(thisMonth);

  const body = {
    taxPercent: tax === "" ? Number.NaN : Number(tax),
    overheadPercent: overhead === "" ? Number.NaN : Number(overhead),
    basis,
    labCostBearer: bearer,
    effectiveMonth,
  };
  const form = useFormErrors(schemaErrors(payRulesInputSchema, body));
  const { reset } = form;
  const current = rules.data?.current;

  useEffect(() => {
    if (open && current) {
      setTax(String(current.taxPercent));
      setOverhead(String(current.overheadPercent));
      setBasis(current.basis);
      setBearer(current.labCostBearer);
      setEffectiveMonth(thisMonth);
      reset();
    }
  }, [open, current, thisMonth, reset]);

  const submit = async (): Promise<void> => {
    if (!form.check()) {
      return;
    }

    try {
      await save.mutateAsync(body);
      toast.success("payroll.rules.saved");
      onClose();
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <Modal
      data-testid="payroll-rules-modal"
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="payroll.rules.title"
      description="payroll.rules.about"
      footer={
        <>
          <Button variant="secondary" data-testid="payroll-rules-cancel" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            isLoading={save.isPending}
            aria-disabled={!form.isValid || save.isPending || undefined}
            data-testid="payroll-rules-save"
            onClick={() => void submit()}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div ref={form.formRef} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div onBlur={form.leave("taxPercent")}>
            <FormField
              label="payroll.rules.tax"
              htmlFor="payroll-rules-tax"
              hint="payroll.rules.taxHint"
              error={form.errors["taxPercent"]}
              required
            >
              <QuantityInput
                id="payroll-rules-tax"
                data-testid="payroll-rules-tax"
                value={tax}
                onChange={(event) => setTax(event.target.value)}
              />
            </FormField>
          </div>

          <div onBlur={form.leave("overheadPercent")}>
            <FormField
              label="payroll.rules.overhead"
              htmlFor="payroll-rules-overhead"
              hint="payroll.rules.overheadHint"
              error={form.errors["overheadPercent"]}
              required
            >
              <QuantityInput
                id="payroll-rules-overhead"
                data-testid="payroll-rules-overhead"
                value={overhead}
                onChange={(event) => setOverhead(event.target.value)}
              />
            </FormField>
          </div>
        </div>

        <FormField label="payroll.rules.basis" htmlFor="payroll-rules-basis">
          <Select
            id="payroll-rules-basis"
            data-testid="payroll-rules-basis"
            value={basis}
            onChange={(event) => setBasis(event.target.value as PayBasis)}
            options={PAY_BASES.map((value) => ({
              value,
              label: t(`doctors.settlement.basis.${value}`),
            }))}
          />
        </FormField>

        <FormField label="payroll.rules.bearer" htmlFor="payroll-rules-bearer">
          <Select
            id="payroll-rules-bearer"
            data-testid="payroll-rules-bearer"
            value={bearer}
            onChange={(event) => setBearer(event.target.value as LabCostBearer)}
            options={LAB_COST_BEARERS.map((value) => ({
              value,
              label: t(`doctors.settlement.bearer.${value}`),
            }))}
          />
        </FormField>

        <FormField label="payroll.effectiveFrom" htmlFor="payroll-rules-month">
          <Select
            id="payroll-rules-month"
            data-testid="payroll-rules-month"
            value={effectiveMonth}
            onChange={(event) => setEffectiveMonth(event.target.value)}
            options={monthsFrom(thisMonth, 7).map((value) => ({
              value,
              label: formatMonth(value),
            }))}
          />
        </FormField>

        {(rules.data?.history ?? []).length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-label font-medium text-ink">{t("payroll.rules.history")}</p>
            <ul className="flex flex-col gap-1">
              {rules.data?.history.map((rule) => (
                <li
                  key={rule.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-panel bg-inset px-3 py-1.5 text-meta"
                >
                  <span>{formatMonth(rule.effectiveMonth)}</span>
                  <span className="text-ink-muted">
                    {t("payroll.rules.summary", {
                      tax: rule.taxPercent,
                      overhead: rule.overheadPercent,
                      basis: t(`doctors.settlement.basis.${rule.basis}`),
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
