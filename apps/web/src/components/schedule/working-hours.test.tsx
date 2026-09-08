import type { WeeklySchedule } from '@clinic/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import {
  daySummary,
  rangesOutsideBounds,
  WEEKDAYS_FROM_SATURDAY,
  weekFitsWithin,
} from '@web/components/schedule/week';
import { WorkingHours } from '@web/components/schedule/working-hours';
import '@web/i18n';
import ar from '@web/i18n/locales/ar.json';

/** Sunday, split 09:00–13:00 and 16:00–20:00. */
const SPLIT: WeeklySchedule = [
  {
    weekday: 0,
    ranges: [
      { start: '09:00', end: '13:00' },
      { start: '16:00', end: '20:00' },
    ],
  },
];

function Host({
  initial = SPLIT,
  within: bounds,
}: {
  initial?: WeeklySchedule;
  within?: WeeklySchedule;
}) {
  const [value, setValue] = useState(initial);

  return (
    <WorkingHours
      value={value}
      onChange={setValue}
      {...(bounds && { within: bounds, withinLabel: 'ساعات العيادة' })}
    />
  );
}

const day = (weekday: number): HTMLElement => screen.getByTestId(`hours-day-${weekday}`);

describe('the week, as arithmetic', () => {
  it('starts on Saturday without renumbering the days', () => {
    // The order is a rendering decision; 0 is still Sunday everywhere else.
    expect(WEEKDAYS_FROM_SATURDAY).toEqual([6, 0, 1, 2, 3, 4, 5]);
  });

  it('summarises a day as one range, two, or the word for closed', () => {
    expect(daySummary([], 'مغلق')).toBe('مغلق');
    expect(daySummary([{ start: '09:00', end: '17:00' }], 'مغلق')).toBe('09:00 - 17:00');
    expect(daySummary(SPLIT[0]!.ranges, 'مغلق')).toBe('09:00 - 13:00 · 16:00 - 20:00');
  });

  it('finds the ranges that poke outside their bounds', () => {
    const clinic = [{ start: '09:00', end: '17:00' }];

    expect(rangesOutsideBounds([{ start: '10:00', end: '16:00' }], clinic)).toEqual([]);
    // Starts an hour before the clinic opens.
    expect(rangesOutsideBounds([{ start: '08:00', end: '12:00' }], clinic)).toHaveLength(1);
    // A day the clinic is shut: everything is outside, which is the answer a
    // doctor rostered on a closed day needs.
    expect(rangesOutsideBounds([{ start: '10:00', end: '11:00' }], [])).toHaveLength(1);
  });

  it('spans a split shift with the half that contains it', () => {
    // 16:30–18:00 fits inside the *second* clinic window, not the first.
    expect(
      weekFitsWithin([{ weekday: 0, ranges: [{ start: '16:30', end: '18:00' }] }], SPLIT),
    ).toBe(true);
    // 14:00–15:00 falls in the gap between the two, so it fits neither.
    expect(
      weekFitsWithin([{ weekday: 0, ranges: [{ start: '14:00', end: '15:00' }] }], SPLIT),
    ).toBe(false);
  });
});

describe('the working-hours accordion', () => {
  it('shows a collapsed day as its summary, both halves of a split shift included', () => {
    render(<Host />);

    // The thing anybody opening this screen came to read, without expanding
    // seven panels of time pickers to find it.
    expect(within(day(0)).getByText('09:00 - 13:00 · 16:00 - 20:00')).toBeInTheDocument();
    expect(within(day(6)).getByText(ar.schedule.closed)).toBeInTheDocument();
  });

  it('keeps the time pickers out of the document until a day is opened', async () => {
    render(<Host />);

    expect(within(day(0)).queryByLabelText(ar.schedule.from)).not.toBeInTheDocument();

    await userEvent.click(within(day(0)).getByRole('button'));

    expect(within(day(0)).getAllByLabelText(ar.schedule.from)).toHaveLength(2);
  });

  it('adds a second interval, which is how a split shift is expressed', async () => {
    render(<Host initial={[{ weekday: 0, ranges: [{ start: '09:00', end: '17:00' }] }]} />);

    await userEvent.click(within(day(0)).getByRole('button'));
    await userEvent.click(within(day(0)).getByRole('button', { name: ar.schedule.addRange }));

    // A day is a list of ranges and the gaps between them are the breaks —
    // there is no separate "break" concept to get wrong.
    expect(within(day(0)).getAllByLabelText(ar.schedule.from)).toHaveLength(2);
  });

  it('copies a day onto the other working days and leaves the closed ones shut', async () => {
    render(
      <Host
        initial={[
          { weekday: 0, ranges: [{ start: '08:00', end: '12:00' }] },
          { weekday: 1, ranges: [{ start: '09:00', end: '17:00' }] },
          // Saturday is deliberately off and must stay off.
          { weekday: 6, ranges: [] },
        ]}
      />,
    );

    await userEvent.click(within(day(0)).getByRole('button'));
    await userEvent.click(within(day(0)).getByRole('button', { name: ar.schedule.copyToOthers }));

    expect(within(day(1)).getByText('08:00 - 12:00')).toBeInTheDocument();
    expect(within(day(6)).getByText(ar.schedule.closed)).toBeInTheDocument();
  });

  it('flags a day that falls outside the clinic hours without refusing it', async () => {
    const clinic: WeeklySchedule = [{ weekday: 0, ranges: [{ start: '09:00', end: '17:00' }] }];

    render(
      <Host
        initial={[{ weekday: 0, ranges: [{ start: '07:00', end: '12:00' }] }]}
        within={clinic}
      />,
    );

    // Flagged on the row, so it is visible without expanding the day — and it
    // is a warning rather than a block, because moving a shift takes two edits.
    expect(within(day(0)).getByLabelText(/ساعات العيادة/)).toBeInTheDocument();
    expect(within(day(1)).queryByLabelText(/ساعات العيادة/)).not.toBeInTheDocument();
  });
});
