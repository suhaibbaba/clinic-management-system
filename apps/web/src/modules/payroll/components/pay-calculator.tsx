import type { PayrollLine, SettlementTotals } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@clinic/ui";
import { BreakdownRows } from "@web/modules/payroll/components/breakdown-rows";
import { payBreakdown } from "@web/modules/payroll/lib/pay-breakdown";

export function PayCalculator({
  line,
  totals,
  rates,
}: {
  readonly line: PayrollLine;
  readonly totals: SettlementTotals | undefined;
  readonly rates:
    { readonly tax: number; readonly overhead: number; readonly clinic: number } | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const groups = payBreakdown(line, totals);
  const percents = { tax: rates?.tax, overhead: rates?.overhead, clinicShare: rates?.clinic };

  return (
    <Card data-testid="pay-calculator" className="flex flex-col gap-4">
      <h2 className="text-value font-semibold text-ink">{t("payroll.calc.title")}</h2>

      {groups.map((group) => (
        <section key={group.key} className="flex flex-col gap-1">
          {group.key !== "total" && (
            <h3 className="text-label font-medium text-ink-muted">
              {t(`payroll.calc.groups.${group.key}`)}
            </h3>
          )}
          <BreakdownRows
            data-testid={`pay-calculator-${group.key}`}
            rows={group.rows}
            percents={percents}
            conclude={group.key === "total"}
          />
        </section>
      ))}
    </Card>
  );
}
