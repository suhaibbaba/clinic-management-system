import type { SettlementTotals, SettlementTreatment } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Money, ProgressBar, StatCard } from "@clinic/ui";
import { groupByCollection, shareSplit } from "@web/modules/payroll/lib/share-groups";
import { useCurrency } from "@web/shared/queries/clinic";

export function ShareSummary({
  totals,
  treatments,
  clinicPercent,
}: {
  readonly totals: SettlementTotals;
  readonly treatments: readonly SettlementTreatment[];
  readonly clinicPercent: number;
}): JSX.Element {
  const { t } = useTranslation();
  const currency = useCurrency();
  const split = shareSplit(totals);
  const groups = groupByCollection(treatments);

  return (
    <section data-testid="share-summary" className="flex flex-col gap-2">
      <div className="mb-3 grid grid-cols-1 gap-3 xs:grid-cols-2 xl:grid-cols-3">
        <StatCard
          data-testid="share-summary-share"
          label={t("payroll.summary.share")}
          value={<Money amount={split.share} currency={currency} />}
          caption={t("payroll.summary.shareCaption", {
            count: treatments.length,
            percent: clinicPercent,
          })}
          icon="stethoscope"
        />
        <StatCard
          data-testid="share-summary-ready"
          label={t("payroll.summary.ready")}
          value={<Money amount={split.ready} currency={currency} />}
          caption={t("payroll.summary.readyCaption", { count: groups.collected.length })}
          icon="money"
          tone="success"
        />
        <StatCard
          data-testid="share-summary-waiting"
          label={t("payroll.summary.waiting")}
          value={<Money amount={split.waiting} currency={currency} />}
          caption={t("payroll.summary.waitingCaption", { count: groups.waiting.length })}
          icon="clock"
          tone="warning"
        />
      </div>
      <ProgressBar
        data-testid="share-summary-bar"
        label={t("payroll.summary.bar")}
        value={Number(split.ready)}
        total={Number(split.share)}
        tone="success"
        className="h-2.5 bg-warning-300"
      />
      <p className="flex justify-between text-meta text-ink-muted">
        <span>{t("payroll.summary.readyShare", { percent: split.readyPercent })}</span>
        <span>{t("payroll.summary.waitingShare", { percent: 100 - split.readyPercent })}</span>
      </p>
    </section>
  );
}
