import { currencySymbol, formatWholeMoney } from "@clinic/shared";
import type { JSX } from "react";
import { Ltr } from "@ui/components/ltr";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface MoneyProps extends TestIdProps {
  readonly amount: string;
  readonly currency?: string | undefined;
  readonly className?: string | undefined;
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
            {"\u00A0"}
            {symbol}
          </>
        )}
      </Ltr>
    </span>
  );
}
