import {
  LAB_COST_BEARERS,
  PAY_BASES,
  payRulesInputSchema,
  type LabCostBearer,
  type PayBasis,
} from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Card,
  FormField,
  PageHeader,
  QuantityInput,
  SegmentedControl,
  Select,
  useToast,
} from "@clinic/ui";
import { usePayRules, useSetPayRules } from "@web/modules/payroll/queries";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import { errorToast } from "@web/shared/lib/api-error";
import { todayIso } from "@web/shared/lib/dates";
import { schemaErrors } from "@web/shared/lib/form-errors";
import { formatMonth } from "@web/shared/lib/format";
import { currentMonth, monthsFrom } from "@web/shared/lib/months";

export function PayRulesPage(): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const rules = usePayRules(true);
  const save = useSetPayRules();
  const thisMonth = currentMonth(todayIso());

  const [clinic, setClinic] = useState("0");
  const [tax, setTax] = useState("0");
  const [overhead, setOverhead] = useState("0");
  const [basis, setBasis] = useState<PayBasis>("done");
  const [bearer, setBearer] = useState<LabCostBearer>("shared");
  const [effectiveMonth, setEffectiveMonth] = useState(thisMonth);

  const current = rules.data?.current;
  const body = {
    clinicSharePercent: clinic === "" ? Number.NaN : Number(clinic),
    taxPercent: tax === "" ? Number.NaN : Number(tax),
    overheadPercent: overhead === "" ? Number.NaN : Number(overhead),
    basis,
    labCostBearer: bearer,
    effectiveMonth,
  };
  const form = useFormErrors(schemaErrors(payRulesInputSchema, body));
  const { reset } = form;
  const changed =
    current !== undefined &&
    (body.clinicSharePercent !== current.clinicSharePercent ||
      body.taxPercent !== current.taxPercent ||
      body.overheadPercent !== current.overheadPercent ||
      basis !== current.basis ||
      bearer !== current.labCostBearer);

  useEffect(() => {
    if (current) {
      setClinic(String(current.clinicSharePercent));
      setTax(String(current.taxPercent));
      setOverhead(String(current.overheadPercent));
      setBasis(current.basis);
      setBearer(current.labCostBearer);
      reset();
    }
  }, [current, reset]);

  const submit = async (): Promise<void> => {
    if (!changed || !form.check()) {
      return;
    }

    try {
      await save.mutateAsync(body);
      toast.success("payroll.rules.saved");
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <div data-testid="pay-rules-page" className="flex flex-col gap-5">
      <PageHeader
        data-testid="pay-rules-header"
        title="payroll.rules.title"
        subtitle="payroll.rules.about"
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,var(--form-max))_minmax(0,1fr)]">
        <Card data-testid="pay-rules-form" className="flex flex-col gap-4">
          <div ref={form.formRef} className="flex flex-col gap-4">
            <div onBlur={form.leave("clinicSharePercent")}>
              <FormField
                label="payroll.rules.clinicShare"
                htmlFor="pay-rules-clinic"
                hint="payroll.rules.clinicShareHint"
                error={form.errors["clinicSharePercent"]}
                required
              >
                <QuantityInput
                  id="pay-rules-clinic"
                  data-testid="pay-rules-clinic"
                  value={clinic}
                  onChange={(event) => setClinic(event.target.value)}
                />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div onBlur={form.leave("taxPercent")}>
                <FormField
                  label="payroll.rules.tax"
                  htmlFor="pay-rules-tax"
                  hint="payroll.rules.taxHint"
                  error={form.errors["taxPercent"]}
                  required
                >
                  <QuantityInput
                    id="pay-rules-tax"
                    data-testid="pay-rules-tax"
                    value={tax}
                    onChange={(event) => setTax(event.target.value)}
                  />
                </FormField>
              </div>

              <div onBlur={form.leave("overheadPercent")}>
                <FormField
                  label="payroll.rules.overhead"
                  htmlFor="pay-rules-overhead"
                  hint="payroll.rules.overheadHint"
                  error={form.errors["overheadPercent"]}
                  required
                >
                  <QuantityInput
                    id="pay-rules-overhead"
                    data-testid="pay-rules-overhead"
                    value={overhead}
                    onChange={(event) => setOverhead(event.target.value)}
                  />
                </FormField>
              </div>
            </div>

            <FormField label="payroll.rules.basis" htmlFor="pay-rules-basis">
              <SegmentedControl
                data-testid="pay-rules-basis"
                label={t("payroll.rules.basis")}
                value={basis}
                onChange={setBasis}
                options={PAY_BASES.map((value) => ({
                  value,
                  label: t(`doctors.settlement.basis.${value}`),
                }))}
              />
            </FormField>

            <FormField label="payroll.rules.bearer" htmlFor="pay-rules-bearer">
              <SegmentedControl
                data-testid="pay-rules-bearer"
                label={t("payroll.rules.bearer")}
                value={bearer}
                onChange={setBearer}
                options={LAB_COST_BEARERS.map((value) => ({
                  value,
                  label: t(`payroll.rules.bearers.${value}`),
                }))}
              />
            </FormField>

            {changed && (
              <FormField label="payroll.effectiveFrom" htmlFor="pay-rules-month">
                <Select
                  id="pay-rules-month"
                  data-testid="pay-rules-month"
                  value={effectiveMonth}
                  onChange={(event) => setEffectiveMonth(event.target.value)}
                  options={monthsFrom(thisMonth, 7).map((value) => ({
                    value,
                    label: formatMonth(value),
                  }))}
                />
              </FormField>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              data-testid="pay-rules-save"
              isLoading={save.isPending}
              aria-disabled={!changed || !form.isValid || save.isPending || undefined}
              onClick={() => void submit()}
            >
              {t("common.save")}
            </Button>
          </div>
        </Card>

        {(rules.data?.history ?? []).length > 0 && (
          <Card data-testid="pay-rules-history" className="flex flex-col gap-3">
            <h2 className="text-value font-semibold text-ink">{t("payroll.rules.history")}</h2>
            <ul className="flex flex-col gap-1">
              {rules.data?.history.map((rule) => (
                <li
                  key={rule.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-panel bg-inset px-3 py-1.5 text-meta"
                >
                  <span>{formatMonth(rule.effectiveMonth)}</span>
                  <span className="text-ink-muted">
                    {t("payroll.rules.summary", {
                      clinic: rule.clinicSharePercent,
                      tax: rule.taxPercent,
                      overhead: rule.overheadPercent,
                      basis: t(`doctors.settlement.basis.${rule.basis}`),
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
