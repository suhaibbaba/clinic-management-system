import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Money, Summary, type SummaryEmphasis } from "@clinic/ui";
import type { BreakdownRow } from "@web/modules/payroll/lib/pay-breakdown";
import { useCurrency } from "@web/shared/queries/clinic";

export function BreakdownRows({
  rows,
  percents = {},
  conclude = false,
  "data-testid": testId,
}: {
  readonly rows: readonly BreakdownRow[];
  readonly percents?: Readonly<Record<string, number | undefined>>;
  readonly conclude?: boolean;
  readonly "data-testid": string;
}): JSX.Element {
  const { t } = useTranslation();
  const currency = useCurrency();
  const last = rows.at(-1)?.key;

  const emphasisOf = (row: BreakdownRow): SummaryEmphasis => {
    if (conclude && row.key === last) {
      return "total";
    }

    return row.sign === "result" ? "subtotal" : "item";
  };

  return (
    <Summary
      data-testid={testId}
      rows={rows.map((row) => {
        const percent = row.percent ?? percents[row.key];

        return {
          key: row.key,
          label: t(row.label),
          value: <Money amount={row.amount} currency={currency} />,
          emphasis: emphasisOf(row),
          deduct: row.sign === "minus",
          aside:
            percent !== undefined && percent > 0 ? (
              <span className="text-meta font-normal text-ink-muted" dir="ltr">
                {percent}%
              </span>
            ) : undefined,
        };
      })}
    />
  );
}
