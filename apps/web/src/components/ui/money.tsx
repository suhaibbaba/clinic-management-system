import { currencySymbol, formatWholeMoney } from '@clinic/shared';
import type { JSX } from 'react';

import { Ltr } from '@web/components/ui/ltr';
import { cn } from '@web/lib/cn';

export interface MoneyProps {
  /** A `numeric(10,2)` string exactly as the API sent it — never a float. */
  readonly amount: string;
  /** ISO-4217 from the clinic setting. Rendered as its symbol, never its code. */
  readonly currency?: string | undefined;
  readonly className?: string | undefined;
  /** Colours a debt red and a credit green. Off for neutral ledger lines. */
  readonly signed?: boolean | undefined;
}

/**
 * An amount, everywhere: tables, KPI cards, statements, receipts, forms.
 *
 * Three rules, and each of them was previously being remembered — or not — at
 * every call site.
 *
 * **The symbol, not the code.** "150 USD" is how a system talks to itself; a
 * receipt handed to a patient says "150 $", and a Jordanian clinic's says
 * "150 د.ا". The map lives in `@clinic/shared` so the PDFs can read the same
 * one.
 *
 * **Whole numbers.** Every price this system writes is whole (see
 * `wholeMoneySchema`), so the trailing `.00` on every figure in every table was
 * noise; the storage is untouched, and the few historic rows carrying fractions
 * are truncated rather than rounded, which understates a debt rather than
 * printing a figure the ledger does not hold.
 *
 * **The digits are isolated; the amount is not pushed anywhere.** Only the
 * number needs `dir="ltr"` — a leading minus would otherwise float to the wrong
 * end. The amount *as a whole* belongs to the sentence around it, so in Arabic
 * "المبلغ: 150 د.ا" reads in natural order with the figure beside its label.
 * The previous component wrapped the number **and** its currency in one LTR
 * island with `w-fit`, which pinned every amount to the left edge of whatever
 * box it was in — a statement's figures ended up a column away from the rows
 * they belonged to. Tables are the deliberate exception and end-align their
 * money columns through the table's own `numeric` column flag, which is an
 * alignment of the column rather than of each figure inside it.
 */
export function Money({ amount, currency, className, signed = false }: MoneyProps): JSX.Element {
  const negative = amount.startsWith('-');
  const zero = Number(amount) === 0;
  const symbol = currencySymbol(currency);

  return (
    <span
      className={cn(
        'tabular-nums',
        signed && !zero && (negative ? 'text-success-700' : 'text-danger-700'),
        className,
      )}
    >
      <Ltr>{formatWholeMoney(amount)}</Ltr>
      {symbol !== '' && (
        <>
          {/*
            A non-breaking space, and a real character rather than a margin: the
            figure and its symbol are one reading, so a narrow table column must
            not put "150" on one line and "$" on the next — and copying the cell
            has to yield "150 $" rather than two fragments.
          */}
          {'\u00A0'}
          <span className="bidi-auto">{symbol}</span>
        </>
      )}
    </span>
  );
}
