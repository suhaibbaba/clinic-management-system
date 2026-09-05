import type { JSX } from 'react';

import { formatMoney } from '@web/lib/format';
import { cn } from '@web/lib/cn';

interface MoneyProps {
  readonly amount: string;
  readonly currency?: string | undefined;
  readonly className?: string | undefined;
  /** Colours a debt red and a credit green. Off for neutral ledger lines. */
  readonly signed?: boolean | undefined;
}

/**
 * An amount, always in an LTR box.
 *
 * A number in an RTL paragraph keeps its own direction, but a leading minus
 * sign does not: the bidi algorithm floats it to the other end, so `-30.00`
 * reads as `30.00-`. The island is the fix, and it is the same one the PDF
 * documents use.
 */
export function Money({ amount, currency, className, signed = false }: MoneyProps): JSX.Element {
  const negative = amount.startsWith('-');
  const zero = Number(amount) === 0;

  return (
    <span
      dir="ltr"
      className={cn(
        'inline-block tabular-nums',
        signed && !zero && (negative ? 'text-emerald-700' : 'text-red-700'),
        className,
      )}
    >
      {formatMoney(amount, currency)}
    </span>
  );
}
