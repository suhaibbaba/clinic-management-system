import type { TimeRange } from '@clinic/shared';

// Pure arithmetic on minutes from local midnight — no database, no clock — so reception and the
// anonymous booking page get the same answer. Instants are the caller's problem.

export interface BusyInterval {
  readonly startMinute: number;
  readonly endMinute: number;
}

export interface ComputedSlot {
  readonly startMinute: number;
  readonly endMinute: number;
  readonly available: boolean;
}

// A closed clinic, a doctor away, a full diary and a day that has ended are four different
// sentences on the phone; an empty array says the same nothing for all four.
export type ClosedReason =
  | 'clinic_closed'
  | 'clinic_closure'
  | 'doctor_off'
  | 'doctor_time_off'
  | 'fully_booked'
  | 'day_over';

export interface SlotComputation {
  /** Null when at least one slot is bookable. */
  readonly closedReason: ClosedReason | null;
  /** Every slot in the day, taken ones included, so the grid can grey them. */
  readonly slots: readonly ComputedSlot[];
}

export interface SlotComputationInput {
  /** The clinic's opening hours for this weekday. Empty means closed. */
  readonly clinicRanges: readonly TimeRange[];
  /** The doctor's working hours for this weekday. Empty means not working. */
  readonly doctorRanges: readonly TimeRange[];
  /** A dated clinic closure covers this day — shut whatever the weekday says. */
  readonly isClosed: boolean;
  // Separate from `busy`: a slot lost to another patient may free up, one lost to an absence will
  // not, and the answer reports which emptied the day.
  readonly timeOff: readonly BusyInterval[];
  readonly busy: readonly BusyInterval[];
  readonly durationMinutes: number;
  readonly stepMinutes: number;
  /** The caller passes "now" for today — deciding what now is is not this module's business. */
  readonly notBeforeMinute?: number | undefined;
}

const MINUTES_PER_DAY = 24 * 60;

/** `09:30` → 570. Assumes the `HH:MM` shape `timeOfDaySchema` already enforces. */
export function toMinutes(time: string): number {
  const [hours = '0', minutes = '0'] = time.split(':');
  return Number(hours) * 60 + Number(minutes);
}

/** 570 → `09:30`. Clamped to the day so a rounding error cannot produce `24:30`. */
export function toTimeOfDay(minute: number): string {
  const clamped = Math.max(0, Math.min(MINUTES_PER_DAY, Math.round(minute)));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

interface Interval {
  readonly start: number;
  readonly end: number;
}

const toInterval = (range: TimeRange): Interval => ({
  start: toMinutes(range.start),
  end: toMinutes(range.end),
});

// A doctor is seen only when they are working and the clinic is open: one starting at 08:00 in a
// clinic opening at 09:00 starts at 09:00.
export function intersectRanges(
  left: readonly TimeRange[],
  right: readonly TimeRange[],
): Interval[] {
  const overlaps: Interval[] = [];

  for (const a of left.map(toInterval)) {
    for (const b of right.map(toInterval)) {
      const start = Math.max(a.start, b.start);
      const end = Math.min(a.end, b.end);

      if (start < end) {
        overlaps.push({ start, end });
      }
    }
  }

  return overlaps.sort((a, b) => a.start - b.start);
}

/** Half-open overlap, matching the database's `[)` ranges exactly. */
const overlaps = (a: Interval, b: BusyInterval): boolean =>
  a.start < b.endMinute && b.startMinute < a.end;

// A slot must fit entirely inside a window: 16:45 for thirty minutes in a clinic closing at 17:00
// books fifteen minutes of nobody being there.
export function computeDaySlots(input: SlotComputationInput): SlotComputation {
  // A dated closure outranks the weekly pattern: the clinic is shut on a
  // Tuesday it normally opens, and saying so is more use than "clinic closed".
  if (input.isClosed) {
    return { closedReason: 'clinic_closure', slots: [] };
  }

  if (input.clinicRanges.length === 0) {
    return { closedReason: 'clinic_closed', slots: [] };
  }

  if (input.doctorRanges.length === 0) {
    return { closedReason: 'doctor_off', slots: [] };
  }

  const windows = intersectRanges(input.clinicRanges, input.doctorRanges);
  const step = Math.max(1, Math.round(input.stepMinutes));
  const duration = Math.max(1, Math.round(input.durationMinutes));
  const notBefore = input.notBeforeMinute ?? Number.NEGATIVE_INFINITY;

  const slots: ComputedSlot[] = [];

  for (const window of windows) {
    for (let start = window.start; start + duration <= window.end; start += step) {
      const slot: Interval = { start, end: start + duration };

      slots.push({
        startMinute: slot.start,
        endMinute: slot.end,
        available:
          start >= notBefore &&
          !input.timeOff.some((off) => overlaps(slot, off)) &&
          !input.busy.some((busy) => overlaps(slot, busy)),
      });
    }
  }

  // Windows can overlap, so the same start is produced twice; de-duplicated on the way out rather
  // than by pre-merging.
  const unique = new Map<number, ComputedSlot>();
  for (const slot of slots) {
    unique.set(slot.startMinute, slot);
  }

  const ordered = [...unique.values()].sort((a, b) => a.startMinute - b.startMinute);
  const bookable = ordered.some((slot) => slot.available);

  return {
    closedReason: bookable ? null : closedBecause(ordered, notBefore, input.timeOff),
    slots: ordered,
  };
}

function closedBecause(
  slots: readonly ComputedSlot[],
  notBefore: number,
  timeOff: readonly BusyInterval[],
): ClosedReason {
  if (slots.length > 0 && slots.every((slot) => slot.startMinute < notBefore)) {
    return 'day_over';
  }

  const allAway =
    slots.length > 0 &&
    slots.every((slot) =>
      timeOff.some((off) => overlaps({ start: slot.startMinute, end: slot.endMinute }, off)),
    );

  return allAway ? 'doctor_time_off' : 'fully_booked';
}
