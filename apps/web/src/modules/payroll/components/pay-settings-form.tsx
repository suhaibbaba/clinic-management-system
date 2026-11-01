import {
  PAYMENT_COLLECTORS,
  STAFF_SHARE_BASES,
  STAFF_SHARE_BASIS,
  collectionTermsInputSchema,
  payPlanInputSchema,
  salaryTermsInputSchema,
  settlementTermsSchema,
  shareTermsInputSchema,
  type PayPlanKind,
  type PaymentCollector,
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
  RadioGroup,
  Select,
  Summary,
  useToast,
} from "@clinic/ui";
import { includesSalary, includesShare } from "@web/modules/payroll/lib/plans";
import {
  useCollectionTerms,
  usePlanHistory,
  useSalaryHistory,
  useSetClinicRate,
  useSetCollector,
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
  clinicRate,
}: {
  readonly line: PayrollLine;
  readonly thisMonth: string;
  readonly clinicRate: { readonly own: number | null; readonly general: number } | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const currency = useCurrency();
  const employee = line.employee ? line.userId : null;
  const salaries = useSalaryHistory(employee);
  const plans = usePlanHistory(employee);
  const shares = useShareTermHistory(employee);
  const collections = useCollectionTerms(line.doctorId);
  const setPlan = useSetPlan();
  const setSalary = useSetSalary();
  const setShareTerms = useSetShareTerms();
  const setClinicRate = useSetClinicRate();
  const setCollector = useSetCollector();

  const savedSalary = salaries.data?.[0]?.monthlyAmount;
  const savedFollows = clinicRate?.own === null;
  const savedClinic = clinicRate === undefined ? "" : String(clinicRate.own ?? clinicRate.general);
  const [kind, setKind] = useState<PayPlanKind>(line.plan);
  const [basis, setBasis] = useState<StaffShareBasis>(line.shareBasis);
  const [amount, setAmount] = useState("");
  const [clinic, setClinic] = useState("");
  const [follows, setFollows] = useState(savedFollows);
  const [staff, setStaff] = useState(String(line.shareRate));
  const [collector, setCollectorChoice] = useState<PaymentCollector>(line.collector);
  const [effectiveMonth, setEffectiveMonth] = useState(thisMonth);

  useEffect(() => setKind(line.plan), [line.plan]);
  useEffect(() => setBasis(line.shareBasis), [line.shareBasis]);
  useEffect(() => setStaff(String(line.shareRate)), [line.shareRate]);
  useEffect(() => setCollectorChoice(line.collector), [line.collector]);
  useEffect(() => setAmount(savedSalary ? whole(savedSalary) : ""), [savedSalary]);
  useEffect(() => setClinic(savedClinic), [savedClinic]);
  useEffect(() => setFollows(savedFollows), [savedFollows]);

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
  const clinicChanged =
    onTreatments &&
    line.doctorId !== null &&
    clinicRate !== undefined &&
    (follows !== savedFollows || (!follows && clinic !== savedClinic));
  const collectorChanged = onTreatments && line.doctorId !== null && collector !== line.collector;
  const changed = planChanged || salaryChanged || termsChanged || clinicChanged || collectorChanged;

  const salaryBody = { monthlyAmount: amount, effectiveMonth };
  const termsBody = { basis, percent: onPercent ? asNumber(staff) : 0, effectiveMonth };
  const clinicBody = {
    clinicSharePercent: follows ? null : asNumber(clinic),
    effectiveMonth,
  };
  const form = useFormErrors({
    ...(planChanged ? schemaErrors(payPlanInputSchema, { kind, effectiveMonth }) : {}),
    ...(salaryChanged ? schemaErrors(salaryTermsInputSchema, salaryBody) : {}),
    ...(termsChanged ? schemaErrors(shareTermsInputSchema, termsBody) : {}),
    ...(clinicChanged ? schemaErrors(settlementTermsSchema, clinicBody) : {}),
    ...(collectorChanged
      ? schemaErrors(collectionTermsInputSchema, { collector, effectiveMonth })
      : {}),
  });
  const saving =
    setPlan.isPending ||
    setSalary.isPending ||
    setShareTerms.isPending ||
    setClinicRate.isPending ||
    setCollector.isPending;

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
        await setClinicRate.mutateAsync({ doctorId: line.doctorId, body: clinicBody });
      }
      if (collectorChanged && line.doctorId) {
        await setCollector.mutateAsync({
          doctorId: line.doctorId,
          body: { collector, effectiveMonth },
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
    ...(collections.data ?? []).map((term) => ({
      id: term.id,
      month: term.effectiveMonth,
      at: term.createdAt,
      value: <span>{t(`payroll.settings.collectors.${term.collector}`)}</span>,
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
              <RadioGroup
                id="pay-settings-kind"
                data-testid="pay-settings-kind"
                label={t("payroll.payType")}
                value={kind}
                onChange={setKind}
                options={line.planKinds.map((value) => ({
                  value,
                  label: t(`payroll.plan.kinds.${value}`),
                  description: t(`payroll.plan.explain.${value}`),
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

          {onTreatments && line.doctorId && clinicRate && (
            <FormField
              label="payroll.settings.clinicPercent"
              htmlFor="pay-settings-clinic-source"
              hint="payroll.settings.clinicPercentHint"
            >
              <RadioGroup
                id="pay-settings-clinic-source"
                data-testid="pay-settings-clinic-source"
                label={t("payroll.settings.clinicPercent")}
                value={follows ? "general" : "own"}
                onChange={(value) => setFollows(value === "general")}
                options={[
                  {
                    value: "general",
                    label: t("payroll.settings.followClinic", { percent: clinicRate.general }),
                    description: t("payroll.settings.followClinicHint"),
                  },
                  {
                    value: "own",
                    label: t("payroll.settings.ownRate"),
                    description: t("payroll.settings.ownRateHint"),
                  },
                ]}
              />
            </FormField>
          )}

          {onTreatments && line.doctorId && clinicRate && !follows && (
            <div onBlur={form.leave("clinicSharePercent")}>
              <FormField
                label="payroll.settings.ownClinicPercent"
                htmlFor="pay-settings-clinic"
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

          {onTreatments && line.doctorId && (
            <FormField label="payroll.settings.collector" htmlFor="pay-settings-collector">
              <RadioGroup
                id="pay-settings-collector"
                data-testid="pay-settings-collector"
                label={t("payroll.settings.collector")}
                value={collector}
                onChange={setCollectorChoice}
                options={PAYMENT_COLLECTORS.map((value) => ({
                  value,
                  label: t(`payroll.settings.collectors.${value}`),
                  description: t(`payroll.settings.collectorHints.${value}`),
                }))}
              />
            </FormField>
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
          <Summary
            data-testid="pay-settings-history-rows"
            divided
            rows={history.map((entry) => ({
              key: entry.id,
              label: formatMonth(entry.month),
              value: entry.value,
            }))}
          />
        </Card>
      )}
    </div>
  );
}
