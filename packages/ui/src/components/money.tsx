import { currencySymbol, formatWholeMoney } from "@clinic/shared";
import type { JSX } from "react";

import { Ltr } from "@ui/components/ltr";

import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface MoneyProps extends TestIdProps {
  /** A `numeric(10,2)` string exactly as the API sent it — never a float. */
  readonly amount: string;
  /** ISO-4217 from the clinic setting. Rendered as its symbol, never its code. */
  readonly currency?: string | undefined;
  readonly className?: string | undefined;
  /** Colours a debt red and a credit green. Off for neutral ledger lines. */
  readonly signed?: boolean | undefined;
}

export function Money({
  amount,
  currency,
  className,
  signed = false,
  "data-testid": testId,
}: MoneyProps): JSX.Element {
  const part = parts("money", testId);
  const negative = amount.startsWith("-");
  const zero = Number(amount) === 0;
  const symbol = currencySymbol(currency);

  return (
    <span
      {...part()}
      className={cn(
        "tabular-nums",
        signed && !zero && (negative ? "text-success-700" : "text-danger-700"),
        className,
      )}
    >
      <Ltr {...part("figure")}>
        {formatWholeMoney(amount)}
        {symbol !== "" && (
          <>
            {/* A non-breaking space, and a real character rather than a margin: a narrow column
                must not split "150" from "$", and copying must yield both. */}
            {"\u00A0"}
            {symbol}
          </>
        )}
      </Ltr>
    </span>
  );
}
