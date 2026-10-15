import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Money } from "@clinic/ui";
import { cn } from "@clinic/ui/lib/cn";
import type { BreakdownRow, BreakdownSign } from "@web/modules/payroll/lib/pay-breakdown";
import { useCurrency } from "@web/shared/queries/clinic";

const SIGN_MARK: Record<BreakdownSign, string> = { plus: "+", minus: "−", result: "=" };

export function BreakdownRows({
  rows,
  percents = {},
  "data-testid": testId,
}: {
  readonly rows: readonly BreakdownRow[];
  readonly percents?: Readonly<Record<string, number | undefined>>;
  readonly "data-testid": string;
}): JSX.Element {
  const { t } = useTranslation();
  const currency = useCurrency();

  return (
    <dl data-testid={testId} className="flex flex-col">
      {rows.map((row) => {
        const percent = row.percent ?? percents[row.key];

        return (
          <div
            key={row.key}
            data-testid={`${testId}-row-${row.key}`}
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
  );
}
