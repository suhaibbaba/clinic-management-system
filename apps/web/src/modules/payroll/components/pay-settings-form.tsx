import {
  payPlanInputSchema,
  salaryTermsInputSchema,
  settlementTermsSchema,
  type PayPlanKind,
  type PayrollLine,
} from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Card,
  FormField,
  Money,
  MoneyInput,
  QuantityInput,
  SegmentedControl,
  Select,
  useToast,
} from "@clinic/ui";
import { includesSalary, includesShare } from "@web/modules/payroll/lib/plans";
import {
  usePlanHistory,
  useSalaryHistory,
  useSetPlan,
  useSetSalary,
  useSetShareTerms,
} from "@web/modules/payroll/queries";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import { errorToast } from "@web/shared/lib/api-error";
import { schemaErrors } from "@web/shared/lib/form-errors";
import { formatMonth } from "@web/shared/lib/format";
import { monthsFrom } from "@web/shared/lib/months";
import { useCurrency } from "@web/shared/queries/clinic";

const whole = (amount: string): string => String(Math.round(Number(amount)));

export function PaySettingsForm({
  line,
  thisMonth,
  clinicPercent,
}: {
  readonly line: PayrollLine;
  readonly thisMonth: string;
  readonly clinicPercent: number | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const currency = useCurrency();
  const salaries = useSalaryHistory(line.employee ? line.userId : null);
  const plans = usePlanHistory(line.employee ? line.userId : null);
  const setPlan = useSetPlan();
  const setSalary = useSetSalary();
  const setShare = useSetShareTerms();

  const savedSalary = salaries.data?.[0]?.monthlyAmount;
  const [kind, setKind] = useState<PayPlanKind>(line.plan);
  const [amount, setAmount] = useState("");
  const [percent, setPercent] = useState("");
  const [effectiveMonth, setEffectiveMonth] = useState(thisMonth);

  useEffect(() => setKind(line.plan), [line.plan]);
  useEffect(() => setAmount(savedSalary ? whole(savedSalary) : ""), [savedSalary]);
  useEffect(
    () => setPercent(clinicPercent === undefined ? "" : String(clinicPercent)),
    [clinicPercent],
  );

  const withSalary = line.employee && includesSalary(kind);
  const withShare = includesShare(kind) && line.doctorId !== null;
  const planChanged = kind !== line.plan;
  const salaryChanged = withSalary && amount !== (savedSalary ? whole(savedSalary) : "");
  const shareChanged = withShare && percent !== String(clinicPercent ?? "");
  const changed = planChanged || salaryChanged || shareChanged;

  const salaryBody = { monthlyAmount: amount, effectiveMonth };
  const shareBody = {
    clinicSharePercent: percent === "" ? undefined : Number(percent),
    effectiveMonth,
  };
  const form = useFormErrors({
    ...(planChanged ? schemaErrors(payPlanInputSchema, { kind, effectiveMonth }) : {}),
    ...(salaryChanged ? schemaErrors(salaryTermsInputSchema, salaryBody) : {}),
    ...(shareChanged ? schemaErrors(settlementTermsSchema, shareBody) : {}),
  });
  const saving = setPlan.isPending || setSalary.isPending || setShare.isPending;

  const submit = async (): Promise<void> => {
    if (!changed || !form.check()) {
      return;
    }

    try {
      if (planChanged) {
        await setPlan.mutateAsync({ userId: line.userId, body: { kind, effectiveMonth } });
      }
      if (salaryChanged) {
        await setSalary.mutateAsync({ userId: line.userId, body: salaryBody });
      }
      if (shareChanged && line.doctorId) {
        await setShare.mutateAsync({
          doctorId: line.doctorId,
          body: { clinicSharePercent: Number(percent), effectiveMonth },
        });
      }
      toast.success("payroll.settings.saved");
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,var(--form-max))_minmax(0,1fr)]">
      <Card data-testid="pay-settings" className="flex flex-col gap-4">
        <div ref={form.formRef} className="flex flex-col gap-4">
          <FormField label="payroll.payType" htmlFor="pay-settings-kind">
            {line.planKinds.length > 1 ? (
              <SegmentedControl
                data-testid="pay-settings-kind"
                label={t("payroll.payType")}
                value={kind}
                onChange={setKind}
                options={line.planKinds.map((value) => ({
                  value,
                  label: t(`payroll.plan.kinds.${value}`),
                }))}
              />
            ) : (
              <p
                id="pay-settings-kind"
                data-testid="pay-settings-kind"
                className="text-value text-ink"
              >
                {t(`payroll.plan.kinds.${kind}`)}
              </p>
            )}
          </FormField>

          {withSalary && (
            <div onBlur={form.leave("monthlyAmount")}>
              <FormField
                label="payroll.monthlySalary"
                htmlFor="pay-settings-salary"
                error={form.errors["monthlyAmount"]}
                required
              >
                <MoneyInput
                  id="pay-settings-salary"
                  data-testid="pay-settings-salary"
                  currency={currency}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </FormField>
            </div>
          )}

          {withShare && (
            <div onBlur={form.leave("clinicSharePercent")}>
              <FormField
                label="payroll.settings.clinicPercent"
                htmlFor="pay-settings-percent"
                hint="payroll.settings.clinicPercentHint"
                error={form.errors["clinicSharePercent"]}
                required
              >
                <QuantityInput
                  id="pay-settings-percent"
                  data-testid="pay-settings-percent"
                  value={percent}
                  onChange={(event) => setPercent(event.target.value)}
                />
              </FormField>
            </div>
          )}

          {changed && (
            <FormField
              label="payroll.effectiveFrom"
              htmlFor="pay-settings-month"
              hint="payroll.settings.fromHint"
            >
              <Select
                id="pay-settings-month"
                data-testid="pay-settings-month"
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
            data-testid="pay-settings-save"
            isLoading={saving}
            aria-disabled={!changed || !form.isValid || saving || undefined}
            onClick={() => void submit()}
          >
            {t("common.save")}
          </Button>
        </div>
      </Card>

      {((salaries.data ?? []).length > 0 || (plans.data ?? []).length > 0) && (
        <Card data-testid="pay-settings-history" className="flex flex-col gap-3">
          <h2 className="text-value font-semibold text-ink">{t("payroll.settings.history")}</h2>
          <ul className="flex flex-col gap-1">
            {[
              ...(plans.data ?? []).map((plan) => ({
                id: plan.id,
                month: plan.effectiveMonth,
                at: plan.createdAt,
                value: <span>{t(`payroll.plan.kinds.${plan.kind}`)}</span>,
              })),
              ...(salaries.data ?? []).map((term) => ({
                id: term.id,
                month: term.effectiveMonth,
                at: term.createdAt,
                value: <Money amount={term.monthlyAmount} currency={currency} />,
              })),
            ]
              .sort((a, b) => b.month.localeCompare(a.month) || b.at.localeCompare(a.at))
              .map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between rounded-panel bg-inset px-3 py-1.5 text-meta"
                >
                  <span>{formatMonth(entry.month)}</span>
                  {entry.value}
                </li>
              ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
