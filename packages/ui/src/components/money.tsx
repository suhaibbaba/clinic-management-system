import { currencySymbol, formatWholeMoney } from '@clinic/shared';
import type { JSX } from 'react';

import { Ltr } from '@ui/components/ltr';

import { cn } from '@ui/lib/cn';

export interface MoneyProps {
  /** A `numeric(10,2)` string exactly as the API sent it — never a float. */
  readonly amount: string;
  /** ISO-4217 from the clinic setting. Rendered as its symbol, never its code. */
  readonly currency?: string | undefined;
  readonly className?: string | undefined;
  /** Colours a debt red and a credit green. Off for neutral ledger lines. */
  readonly signed?: boolean | undefined;
}

export function Money({ amount, currency, className, signed = false }: MoneyProps): JSX.Element {
  const negative = amount.startsWith('-');
  const zero = Number(amount) === 0;
  const symbol = currencySymbol(currency);

  return (
    <span
      data-part="money"
      className={cn(
        'tabular-nums',
        signed && !zero && (negative ? 'text-success-700' : 'text-danger-700'),
        className,
      )}
    >
      <Ltr data-part="money-figure">
        {formatWholeMoney(amount)}
        {symbol !== '' && (
          <>
            {/* A non-breaking space, and a real character rather than a margin: a narrow column
                must not split "150" from "$", and copying must yield both. */}
            {'\u00A0'}
            {symbol}
          </>
        )}
      </Ltr>
    </span>
  );
}
