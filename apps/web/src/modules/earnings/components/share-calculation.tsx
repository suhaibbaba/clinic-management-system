import { type Money as MoneyAmount } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Money } from "@clinic/ui";
import { type ShareStep } from "@web/modules/earnings/lib/share-steps";

interface Props {
  readonly "data-testid": string;
  readonly revenue: MoneyAmount;
  readonly beforeNet: readonly ShareStep[];
  readonly net: MoneyAmount;
  readonly sharePercent?: number | undefined;
  readonly workPercent?: number | undefined;
  readonly afterShare?: readonly ShareStep[] | undefined;
  readonly share: MoneyAmount;
  readonly currency: string | undefined;
}

export function ShareCalculation({
  "data-testid": testId,
  revenue,
  beforeNet,
  net,
  sharePercent,
  workPercent,
  afterShare = [],
  share,
  currency,
}: Props): JSX.Element {
  const { t } = useTranslation();

  return (
    <span data-testid={testId} className="flex flex-wrap gap-x-2 text-meta text-ink-muted">
      <Term label={t("doctors.settlement.amount")}>
        <Money amount={revenue} currency={currency} />
      </Term>
      {beforeNet.map((step) => (
        <Term key={step.key} sign="−" label={t(`payroll.calc.${step.key}`)}>
          <Money amount={step.amount} currency={currency} />
        </Term>
      ))}
      {beforeNet.length > 0 && (
        <Term sign="=" label={t("payroll.calc.net")}>
          <Money amount={net} currency={currency} />
        </Term>
      )}
      {workPercent !== undefined && workPercent < 100 && (
        <Term sign="×" label={t("earnings.myWorkShare", { percent: workPercent })} />
      )}
      {sharePercent !== undefined && (
        <Term sign="×" label={t("earnings.myPercent", { percent: sharePercent })} />
      )}
      {afterShare.map((step) => (
        <Term key={step.key} sign="−" label={t(`payroll.calc.${step.key}`)}>
          <Money amount={step.amount} currency={currency} />
        </Term>
      ))}
      <Term sign="=" label={t("earnings.myShare")}>
        <Money amount={share} currency={currency} className="font-medium text-ink" />
      </Term>
    </span>
  );
}

function Term({
  sign,
  label,
  children,
}: {
  readonly sign?: string | undefined;
  readonly label: string;
  readonly children?: JSX.Element | undefined;
}): JSX.Element {
  return (
    <span className="whitespace-nowrap">
      {sign && <span aria-hidden="true">{sign} </span>}
      {label}
      {children && <> {children}</>}
    </span>
  );
}
