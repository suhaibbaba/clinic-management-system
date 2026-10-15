import {
  STAFF_SHARE_BASES,
  STAFF_SHARE_BASIS,
  payPlanInputSchema,
  salaryTermsInputSchema,
  settlementTermsSchema,
  shareTermsInputSchema,
  type PayPlanKind,
  type PayrollLine,
  type StaffShareBasis,
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
  useSetClinicRate,
  useSetPlan,
  useSetSalary,
  useSetShareTerms,
  useShareTermHistory,
} from "@web/modules/payroll/queries";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import { errorToast } from "@web/shared/lib/api-error";
import { schemaErrors } from "@web/shared/lib/form-errors";
import { formatMonth } from "@web/shared/lib/format";
import { monthsFrom } from "@web/shared/lib/months";
import { useCurrency } from "@web/shared/queries/clinic";

const whole = (amount: string): string => String(Math.round(Number(amount)));

const asNumber = (value: string): number => (value === "" ? Number.NaN : Number(value));

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
  const employee = line.employee ? line.userId : null;
  const salaries = useSalaryHistory(employee);
  const plans = usePlanHistory(employee);
  const shares = useShareTermHistory(employee);
  const setPlan = useSetPlan();
  const setSalary = useSetSalary();
  const setShareTerms = useSetShareTerms();
  const setClinicRate = useSetClinicRate();

  const savedSalary = salaries.data?.[0]?.monthlyAmount;
  const savedClinic = clinicPercent === undefined ? "" : String(clinicPercent);
  const [kind, setKind] = useState<PayPlanKind>(line.plan);
  const [basis, setBasis] = useState<StaffShareBasis>(line.shareBasis);
  const [amount, setAmount] = useState("");
  const [clinic, setClinic] = useState("");
  const [staff, setStaff] = useState(String(line.shareRate));
  const [effectiveMonth, setEffectiveMonth] = useState(thisMonth);

  useEffect(() => setKind(line.plan), [line.plan]);
  useEffect(() => setBasis(line.shareBasis), [line.shareBasis]);
  useEffect(() => setStaff(String(line.shareRate)), [line.shareRate]);
  useEffect(() => setAmount(savedSalary ? whole(savedSalary) : ""), [savedSalary]);
  useEffect(() => setClinic(savedClinic), [savedClinic]);

  const bases = STAFF_SHARE_BASES.filter(
    (value) => value !== STAFF_SHARE_BASIS.TREATMENTS || line.doctorId !== null,
  );
  const withSalary = line.employee && includesSalary(kind);
  const withShare = includesShare(kind);
  const onTreatments = withShare && basis === STAFF_SHARE_BASIS.TREATMENTS;
  const onPercent = withShare && basis !== STAFF_SHARE_BASIS.TREATMENTS;

  const planChanged = kind !== line.plan;
  const salaryChanged = withSalary && amount !== (savedSalary ? whole(savedSalary) : "");
  const termsChanged =
    line.employee &&
    withShare &&
    (basis !== line.shareBasis || (onPercent && staff !== String(line.shareRate)));
  const clinicChanged = onTreatments && line.doctorId !== null && clinic !== savedClinic;
  const changed = planChanged || salaryChanged || termsChanged || clinicChanged;

  const salaryBody = { monthlyAmount: amount, effectiveMonth };
  const termsBody = { basis, percent: onPercent ? asNumber(staff) : 0, effectiveMonth };
  const clinicBody = { clinicSharePercent: asNumber(clinic), effectiveMonth };
  const form = useFormErrors({
    ...(planChanged ? schemaErrors(payPlanInputSchema, { kind, effectiveMonth }) : {}),
    ...(salaryChanged ? schemaErrors(salaryTermsInputSchema, salaryBody) : {}),
    ...(termsChanged ? schemaErrors(shareTermsInputSchema, termsBody) : {}),
    ...(clinicChanged ? schemaErrors(settlementTermsSchema, clinicBody) : {}),
  });
  const saving =
    setPlan.isPending || setSalary.isPending || setShareTerms.isPending || setClinicRate.isPending;

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
      if (termsChanged) {
        await setShareTerms.mutateAsync({ userId: line.userId, body: termsBody });
      }
      if (clinicChanged && line.doctorId) {
        await setClinicRate.mutateAsync({
          doctorId: line.doctorId,
          body: { clinicSharePercent: Number(clinic), effectiveMonth },
        });
      }
      toast.success("payroll.settings.saved");
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  const history = [
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
    ...(shares.data ?? []).map((term) => ({
      id: term.id,
      month: term.effectiveMonth,
      at: term.createdAt,
      value: (
        <span>
          {term.basis === STAFF_SHARE_BASIS.TREATMENTS
            ? t("payroll.settings.bases.treatments")
            : t("payroll.settings.shareOf", {
                percent: term.percent,
                basis: t(`payroll.settings.bases.${term.basis}`),
              })}
        </span>
      ),
    })),
  ].sort((a, b) => b.month.localeCompare(a.month) || b.at.localeCompare(a.at));

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

          {withShare && line.employee && (
            <FormField
              label="payroll.settings.basis"
              htmlFor="pay-settings-basis"
              hint={`payroll.settings.basisHints.${basis}`}
            >
              <Select
                id="pay-settings-basis"
                data-testid="pay-settings-basis"
                value={basis}
                onChange={(event) => setBasis(event.target.value as StaffShareBasis)}
                options={bases.map((value) => ({
                  value,
                  label: t(`payroll.settings.bases.${value}`),
                }))}
              />
            </FormField>
          )}

          {onTreatments && line.doctorId && (
            <div onBlur={form.leave("clinicSharePercent")}>
              <FormField
                label="payroll.settings.clinicPercent"
                htmlFor="pay-settings-clinic"
                hint="payroll.settings.clinicPercentHint"
                error={form.errors["clinicSharePercent"]}
                required
              >
                <QuantityInput
                  id="pay-settings-clinic"
                  data-testid="pay-settings-clinic"
                  value={clinic}
                  onChange={(event) => setClinic(event.target.value)}
                />
              </FormField>
            </div>
          )}

          {onPercent && (
            <div onBlur={form.leave("percent")}>
              <FormField
                label="payroll.settings.staffPercent"
                htmlFor="pay-settings-staff"
                error={form.errors["percent"]}
                required
              >
                <QuantityInput
                  id="pay-settings-staff"
                  data-testid="pay-settings-staff"
                  value={staff}
                  onChange={(event) => setStaff(event.target.value)}
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

      {history.length > 0 && (
        <Card data-testid="pay-settings-history" className="flex flex-col gap-3">
          <h2 className="text-value font-semibold text-ink">{t("payroll.settings.history")}</h2>
          <ul className="flex flex-col gap-1">
            {history.map((entry) => (
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
