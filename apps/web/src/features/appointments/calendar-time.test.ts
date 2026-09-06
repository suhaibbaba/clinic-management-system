import { describe, expect, it } from 'vitest';

import {
  addDays,
  blockPosition,
  GRID_END_MINUTE,
  GRID_START_MINUTE,
  gridHours,
  instantAt,
  minuteFromOffset,
  minutesOf,
  startOfWeek,
  toTimeLabel,
  weekDates,
} from '@web/features/appointments/calendar-time';

const appointment = (startsAt: string, durationMinutes: number) =>
  ({ startsAt, durationMinutes }) as Parameters<typeof blockPosition>[0];

/**
 * The grid's arithmetic, which is the part of a calendar that is either exactly
 * right or wrong by fifteen minutes in a way nobody notices until someone is
 * booked at the wrong hour.
 */
describe('calendar time', () => {
  it('labels minutes as HH:MM', () => {
    expect(toTimeLabel(GRID_START_MINUTE)).toBe('07:00');
    expect(toTimeLabel(9 * 60 + 30)).toBe('09:30');
    expect(toTimeLabel(GRID_END_MINUTE)).toBe('22:00');
  });

  it('draws an hour line for every hour of the grid, inclusive of both ends', () => {
    const hours = gridHours();

    expect(hours[0]).toBe(GRID_START_MINUTE);
    expect(hours.at(-1)).toBe(GRID_END_MINUTE);
    expect(hours).toHaveLength(16);
  });

  describe('weeks', () => {
    it('snaps to Sunday, the way the API does', () => {
      // 2026-09-06 is a Sunday, 2026-09-09 a Wednesday.
      expect(startOfWeek('2026-09-06')).toBe('2026-09-06');
      expect(startOfWeek('2026-09-09')).toBe('2026-09-06');
      expect(startOfWeek('2026-09-12')).toBe('2026-09-06');
    });

    it('lists seven consecutive days', () => {
      const days = weekDates('2026-09-09');

      expect(days).toHaveLength(7);
      expect(days[0]).toBe('2026-09-06');
      expect(days.at(-1)).toBe('2026-09-12');
    });

    it('walks days across a month boundary', () => {
      expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
      expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    });
  });

  describe('block position', () => {
    it('places a block by its start and sizes it by its duration', () => {
      // 09:00 is two hours into a fifteen-hour grid.
      const { top, height } = blockPosition(appointment(instantAt('2026-09-09', 9 * 60), 60));

      expect(Number.parseFloat(top)).toBeCloseTo((120 / 900) * 100, 4);
      expect(Number.parseFloat(height)).toBeCloseTo((60 / 900) * 100, 4);
    });

    it('gives a very short appointment a floor, so it stays clickable', () => {
      const { height } = blockPosition(appointment(instantAt('2026-09-09', 10 * 60), 5));

      // Twenty minutes of height for a five-minute appointment: below that it
      // is a hairline nobody can hit.
      expect(Number.parseFloat(height)).toBeCloseTo((20 / 900) * 100, 4);
    });

    it('clamps an appointment that starts before the grid does', () => {
      const { top } = blockPosition(appointment(instantAt('2026-09-09', 6 * 60), 60));

      expect(Number.parseFloat(top)).toBe(0);
    });
  });

  describe('drag targets', () => {
    it('snaps a drop to the nearest quarter hour', () => {
      // A 900px column is one pixel per minute, so 127px is 09:07 — which a
      // clinic books as 09:00, not as 09:07.
      expect(minuteFromOffset(127, 900)).toBe(9 * 60);
      expect(minuteFromOffset(128, 900)).toBe(9 * 60 + 15);
      expect(minuteFromOffset(0, 900)).toBe(GRID_START_MINUTE);
    });

    it('clamps a drop past either edge into the day', () => {
      expect(minuteFromOffset(-50, 900)).toBe(GRID_START_MINUTE);
      expect(minuteFromOffset(5000, 900)).toBe(GRID_END_MINUTE - 15);
    });
  });

  it('round-trips a minute through an instant and back', () => {
    // The drag reads a minute, sends an instant, and the block is redrawn from
    // that instant — so a move that changes nothing must land on the same row.
    const iso = instantAt('2026-09-09', 14 * 60 + 30);

    expect(minutesOf(iso)).toBe(14 * 60 + 30);
  });
});
