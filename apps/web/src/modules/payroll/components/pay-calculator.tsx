import type { PayrollLine, SettlementTotals } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Card, Money } from "@clinic/ui";
import { cn } from "@clinic/ui/lib/cn";
import { payBreakdown, type BreakdownSign } from "@web/modules/payroll/lib/pay-breakdown";
import { useCurrency } from "@web/shared/queries/clinic";

const SIGN_MARK: Record<BreakdownSign, string> = { plus: "+", minus: "−", result: "=" };

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
  const currency = useCurrency();
  const groups = payBreakdown(line, totals);
  const percentOf: Record<string, number | undefined> = {
    tax: rates?.tax,
    overhead: rates?.overhead,
    clinicShare: rates?.clinic,
  };

  return (
    <Card data-testid="pay-calculator" className="flex flex-col gap-4">
      <h2 className="text-value font-semibold text-ink">{t("payroll.calc.title")}</h2>

      {groups.map((group) => (
        <section
          key={group.key}
          data-testid={`pay-calculator-${group.key}`}
          className={cn(
            "flex flex-col gap-1",
            group.key === "total" && "rounded-panel bg-inset px-3 py-2",
          )}
        >
          {group.key !== "total" && (
            <h3 className="text-label font-medium text-ink-muted">
              {t(`payroll.calc.groups.${group.key}`)}
            </h3>
          )}
          <dl className="flex flex-col">
            {group.rows.map((row) => {
              const percent = percentOf[row.key];

              return (
                <div
                  key={row.key}
                  data-testid={`pay-calculator-row-${row.key}`}
                  className={cn(
                    "flex items-baseline justify-between gap-3 py-1",
                    row.sign === "result" && "border-t border-line font-semibold text-ink",
                  )}
                >
                  <dt className="flex items-baseline gap-2 text-label text-ink">
                    <span aria-hidden className="w-3 text-center text-ink-muted">
                      {SIGN_MARK[row.sign]}
                    </span>
                    {t(row.label)}
                    {percent !== undefined && percent > 0 && (
                      <span className="text-meta text-ink-muted" dir="ltr">
                        {percent}%
                      </span>
                    )}
                  </dt>
                  <dd>
                    <Money amount={row.amount} currency={currency} />
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </Card>
  );
}
