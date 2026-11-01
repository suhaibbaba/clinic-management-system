import type { Payroll } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Card, Money, Summary } from "@clinic/ui";
import { BreakdownRows } from "@web/modules/payroll/components/breakdown-rows";
import { profitRows } from "@web/modules/payroll/lib/profit-rows";
import { useOwnerDraws } from "@web/modules/payroll/queries";
import { formatDate, formatMonth } from "@web/shared/lib/format";
import { useCurrency } from "@web/shared/queries/clinic";

export function ProfitStatement({ payroll }: { readonly payroll: Payroll }): JSX.Element {
  const { t } = useTranslation();
  const currency = useCurrency();
  const draws = useOwnerDraws(true);
  const { profit, draw } = payroll;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,var(--form-max))_minmax(0,1fr)]">
      <Card data-testid="profit-statement" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-value font-semibold text-ink">{t("finance.statement")}</h2>
          {draw ? (
            <Badge tone="success" data-testid="profit-drawn">
              {t("finance.drawnOn", { date: formatDate(draw.createdAt) })}
            </Badge>
          ) : (
            <Badge tone="warning" data-testid="profit-open">
              {t("finance.drawOnClose")}
            </Badge>
          )}
        </div>
        <p className="text-meta text-ink-muted">{t("finance.about")}</p>
        <BreakdownRows data-testid="profit-rows" rows={profitRows(profit)} conclude />
      </Card>

      <Card data-testid="owner-draws" className="flex flex-col gap-3">
        <h2 className="text-value font-semibold text-ink">{t("finance.draws")}</h2>
        {(draws.data ?? []).length === 0 ? (
          <p className="text-meta text-ink-muted">{t("finance.noDraws")}</p>
        ) : (
          <Summary
            data-testid="owner-draw"
            divided
            rows={(draws.data ?? []).map((entry) => ({
              key: entry.id,
              label: formatMonth(entry.month),
              value: <Money amount={entry.amount} currency={currency} />,
            }))}
          />
        )}
      </Card>
    </div>
  );
}
