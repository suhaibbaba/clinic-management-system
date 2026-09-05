import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { DatePicker, parseTypedDate, toIsoDate } from '@web/components/ui/date-picker';
import '@web/i18n';
import ar from '@web/i18n/locales/ar.json';

/** A controlled host, so the test sees what a form would receive. */
function Host({ initial = '' }: { readonly initial?: string }): React.JSX.Element {
  const [value, setValue] = useState(initial);

  return (
    <>
      <DatePicker id="d" label="التاريخ" value={value} onChange={setValue} />
      <output data-testid="value">{value}</output>
    </>
  );
}

describe('DatePicker', () => {
  it('parses a typed date and hands back an ISO string', () => {
    const parsed = parseTypedDate('05/09/2026');

    expect(parsed).not.toBeNull();
    expect(toIsoDate(parsed as Date)).toBe('2026-09-05');
  });

  it('rejects a date that does not exist rather than rolling it over', () => {
    // 31 February would otherwise become 3 March.
    expect(parseTypedDate('31/02/2026')).toBeNull();
    expect(parseTypedDate('12/0')).toBeNull();
  });

  it('shows an existing value in day/month/year with Latin digits', () => {
    render(<Host initial="2026-09-05" />);

    expect(screen.getByRole('textbox')).toHaveValue('05/09/2026');
  });

  it('commits a typed date to the caller as ISO', async () => {
    render(<Host />);

    await userEvent.type(screen.getByRole('textbox'), '05/09/2026');

    expect(screen.getByTestId('value')).toHaveTextContent('2026-09-05');
  });

  it('leaves the value alone while a date is half typed', async () => {
    render(<Host initial="2026-09-05" />);

    const field = screen.getByRole('textbox');
    await userEvent.clear(field);
    await userEvent.type(field, '07/0');

    // Cleared to empty, then nothing further committed — not a partial date.
    expect(screen.getByTestId('value')).toHaveTextContent('');
  });

  it('opens an Arabic, right-to-left calendar with Latin digits', async () => {
    render(<Host initial="2026-09-05" />);

    await userEvent.click(screen.getByRole('button', { name: ar.common.openCalendar }));

    const grid = await screen.findByRole('grid');
    expect(grid.closest('[dir="rtl"]')).not.toBeNull();

    // Arabic weekday and month names…
    expect(within(grid).getByText('أحد')).toBeInTheDocument();
    expect(within(grid).getAllByLabelText(/سبتمبر/).length).toBeGreaterThan(0);

    // …and Western digits throughout: the visible day cells and the full date
    // a screen reader is given. `٠١٢` would fail both of these.
    const days = [...grid.querySelectorAll('button')].map((button) => button.textContent ?? '');
    expect(days).toContain('17');
    expect(days.join('')).not.toMatch(/[\u0660-\u0669]/);
    expect(within(grid).getByLabelText(/17 سبتمبر 2026/)).toBeInTheDocument();
  });

  it('returns the ISO date for the day that was clicked', async () => {
    render(<Host initial="2026-09-05" />);

    await userEvent.click(screen.getByRole('button', { name: ar.common.openCalendar }));
    await userEvent.click(await screen.findByLabelText(/17 سبتمبر 2026/));

    expect(screen.getByTestId('value')).toHaveTextContent('2026-09-17');
  });

  it('clears the value from the calendar', async () => {
    render(<Host initial="2026-09-05" />);

    await userEvent.click(screen.getByRole('button', { name: ar.common.openCalendar }));
    await userEvent.click(await screen.findByRole('button', { name: ar.common.clear }));

    expect(screen.getByTestId('value')).toHaveTextContent('');
  });
});
