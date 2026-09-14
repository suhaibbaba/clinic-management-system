import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Calendar } from '@web/components/ui/calendar';
import { DatePicker } from '@web/components/ui/date-picker';
import '@web/i18n';
import ar from '@web/i18n/locales/ar.json';

/** `text-ink` without matching `text-ink-inverse`, which contains it. */
const hasClass = (element: Element | null | undefined, name: string): boolean =>
  new RegExp(String.raw`(^|\s)${name}(\s|$)`).test(element?.className ?? '');

describe('Calendar', () => {
  // Each state used to set a background and leave the other's text colour to win: today's number
  // went dark on the selected fill, and a range's middle days light on their own tint.
  it('pairs every fill a range draws with the ink that has to stay readable on it', () => {
    const { container } = render(
      <Calendar
        mode="range"
        selected={{ from: new Date(2026, 8, 4), to: new Date(2026, 8, 14) }}
        defaultMonth={new Date(2026, 8, 4)}
      />,
    );

    const cell = (iso: string): Element | null => container.querySelector(`[data-day="${iso}"]`);

    const end = cell('2026-09-14');
    expect(hasClass(end?.querySelector('button'), 'bg-primary-600')).toBe(true);
    expect(hasClass(end?.querySelector('button'), 'text-ink-inverse')).toBe(true);

    const middle = cell('2026-09-08');
    expect(hasClass(middle, 'bg-selected')).toBe(true);
    expect(hasClass(middle?.querySelector('button'), 'text-ink')).toBe(true);
  });

  it('opens a date of birth on the years, where 1998 is a page away', async () => {
    render(
      <DatePicker
        id="dob"
        label={ar.patients.dateOfBirth}
        startView="years"
        value=""
        onChange={() => undefined}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: ar.common.openCalendar }));

    expect(
      await screen.findByRole('group', { name: ar.common.calendar.chooseYear }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });
});
