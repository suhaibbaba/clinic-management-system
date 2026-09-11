import { currencySymbol, formatWholeMoney, wholeMoneySchema } from '@clinic/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { Money } from '@web/components/ui/money';
import { MoneyInput } from '@web/components/ui/money-input';
import { PersonName } from '@web/components/ui/person-name';
import { changeLanguage } from '@web/i18n/language';
import '@web/i18n';

const money = (): string => screen.getByTestId('money').textContent?.replace(/\s/g, ' ') ?? '';

describe('money display', () => {
  it('shows the currency as its symbol, never its code', () => {
    // "150 USD" is how a system talks to itself; a receipt says "150 $".
    render(
      <span data-testid="money">
        <Money amount="150.00" currency="USD" />
      </span>,
    );

    expect(money()).toBe('150 $');
  });

  it("uses the clinic's own symbol for each currency", () => {
    expect(currencySymbol('JOD')).toBe('د.ا');
    expect(currencySymbol('ILS')).toBe('₪');
    expect(currencySymbol('EUR')).toBe('€');
    expect(currencySymbol('SAR')).toBe('ر.س');
    // A code with no symbol falls back to itself: blank would look like a
    // missing setting, and a clinic row can hold anything.
    expect(currencySymbol('XTS')).toBe('XTS');
    expect(currencySymbol(undefined)).toBe('');
  });

  it('formats with no decimals at all', () => {
    render(
      <span data-testid="money">
        <Money amount="60.00" currency="JOD" />
      </span>,
    );

    expect(money()).toBe('60 د.ا');
  });

  it('truncates a historic fraction rather than rounding it up', () => {
    // 60.99 shown as 61 would print a figure the ledger does not hold.
    expect(formatWholeMoney('60.99')).toBe('60');
    expect(formatWholeMoney('-30.50')).toBe('-30');
  });

  it('keeps the digits in their own direction inside an Arabic page', () => {
    render(
      <span data-testid="money">
        <Money amount="-30.00" currency="ILS" />
      </span>,
    );

    // The island holds the figure and its symbol together, so the minus stays on the left of the
    // number and the symbol on its right — while the pair as a whole follows the page's flow.
    const island = screen.getByTestId('money').querySelector('[dir="ltr"]');
    expect(island?.textContent?.replace(/\s/g, ' ')).toBe('-30 ₪');
  });

  it('does not pin the amount to one edge of its box', () => {
    render(
      <span data-testid="money">
        <Money amount="150.00" currency="JOD" />
      </span>,
    );

    // The outer element is a plain inline `span`: no `w-fit`, no `dir`, nothing
    // that would drag a statement's figures a column away from their rows.
    const box = screen.getByTestId('money').firstElementChild;
    expect(box?.getAttribute('dir')).toBeNull();
    expect(box?.className).not.toContain('w-fit');
  });
});

describe('money entry', () => {
  function Host(): React.JSX.Element {
    const [value, setValue] = useState('');

    return (
      <>
        <MoneyInput
          id="price"
          aria-label="price"
          currency="JOD"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <output data-testid="value">{value}</output>
      </>
    );
  }

  it('refuses a decimal separator as it is typed', async () => {
    render(<Host />);

    await userEvent.type(screen.getByLabelText('price'), '60.50');

    // Not "60.50" rejected on submit — the separator never lands, because a
    // stray one turns 6000 into 60.00 silently.
    expect(screen.getByTestId('value')).toHaveTextContent('6050');
  });

  it('accepts a whole amount and normalises it to the stored scale', () => {
    expect(wholeMoneySchema.safeParse('60').data).toBe('60.00');
    // A value round-tripping from a read must be resubmittable.
    expect(wholeMoneySchema.safeParse('60.00').data).toBe('60.00');
    expect(wholeMoneySchema.safeParse('60.50').success).toBe(false);
  });
});

describe('a staff name', () => {
  const name = { ar: 'ليلى حداد', en: 'Layla Haddad' };

  it("renders in the reader's language", async () => {
    await changeLanguage('ar');
    const { rerender } = render(<PersonName name={name} />);
    expect(screen.getByText('ليلى حداد')).toBeInTheDocument();

    await changeLanguage('en');
    rerender(<PersonName name={name} />);
    expect(screen.getByText('Layla Haddad')).toBeInTheDocument();

    await changeLanguage('ar');
  });

  it('falls back to the other language when one is blank', async () => {
    // The migration copied every existing name into both columns; a clinic
    // part-way through filling in its Arabic must not get a blank calendar.
    await changeLanguage('ar');
    render(<PersonName name={{ ar: '', en: 'Layla Haddad' }} />);

    expect(screen.getByText('Layla Haddad')).toBeInTheDocument();
  });

  it('shows the fallback text when there is no name at all', () => {
    render(<PersonName name={null} fallback="أي طبيب" />);

    expect(screen.getByText('أي طبيب')).toBeInTheDocument();
  });
});
