import type { TimeRange } from '@clinic/shared';

/**
 * Slot availability, as arithmetic on minutes.
 *
 * Pure on purpose (CLAUDE.md architecture decision 6, and the task's own
 * constraint): no database, no Nest, no clock. Public booking will ask the same
 * question from an anonymous, rate-limited endpoint, and the answer has to be
 * the same one reception sees — so the rule lives here once and both callers
 * load their own data and hand it in.
 *
 * Everything is **minutes from local midnight**. Absolute instants are the
 * caller's problem (`time-zone.ts`), which is what keeps this file free of the
 * one thing that makes calendar code hard to test.
 *
 * Free slots are computed on every request and never stored.
 */

/** A window that is already taken, in minutes from local midnight. */
export interface BusyInterval {
  readonly startMinute: number;
  readonly endMinute: number;
}

export interface ComputedSlot {
  readonly startMinute: number;
  readonly endMinute: number;
  readonly available: boolean;
}

/**
 * Why a day offers nothing.
 *
 * A closed clinic, a doctor's day off, a full diary and a day that has simply
 * ended are four different answers to "can you fit me in?", and an empty array
 * says the same nothing for all four. `day_over` earns its place because it is
 * the one anybody looking at today after closing time will see — reporting
 * that evening as "fully booked" is a different and wrong claim.
 *
 * Two more say *why* the door is shut, and they are worth separating from the
 * weekly pattern for the same reason: "we are closed on Fridays" and "we are
 * closed for Eid" are different sentences to the person on the phone, and only
 * one of them is worth asking about next week. `clinic_closure` is a dated
 * closure, `doctor_time_off` is one doctor being away — the clinic is open and
 * another doctor may well have room.
 */
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
  /**
   * The doctor's absences on this day, clipped to it, in local minutes.
   *
   * Separate from `busy` rather than folded into it, because the two mean
   * different things to whoever reads the answer: a slot lost to another
   * patient may free up, and a slot lost to an absence will not. Keeping them
   * apart is also what lets a day with no room left report *which* of the two
   * emptied it.
   */
  readonly timeOff: readonly BusyInterval[];
  readonly busy: readonly BusyInterval[];
  readonly durationMinutes: number;
  /** How far apart slot starts are offered. */
  readonly stepMinutes: number;
  /**
   * Minutes from midnight before which a slot is in the past. Omitted for a
   * future date; the caller passes "now" for today, because deciding what
   * "now" is is not this module's business.
   */
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

/**
 * Where two sets of windows overlap.
 *
 * A doctor can only be seen when they are working **and** the clinic is open —
 * a doctor who starts at 08:00 in a clinic that opens at 09:00 starts at 09:00,
 * and the front door is what settles it.
 *
 * Both sides are small (at most six ranges a day), so the pairwise sweep is
 * the clearest thing that could work.
 */
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

/**
 * The bookable starts in one day.
 *
 * A slot has to fit **entirely** inside a working window: offering 16:45 for a
 * thirty-minute appointment in a clinic that closes at 17:00 books fifteen
 * minutes of nobody being there.
 */
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

  // Windows can overlap each other — two clinic ranges against one doctor
  // range — so the same start can be produced twice. De-duplicated on the way
  // out rather than by pre-merging the windows, which is more code for the
  // same answer.
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

/**
 * Which "nothing available" this is.
 *
 * The windows exist, so the clinic is open and the doctor is rostered. If every
 * slot fell before the cutoff the day is simply over; if every one of them is
 * inside an absence the doctor is away, which is a different sentence from
 * "fully booked" and the one reception has to repeat down the phone. Otherwise
 * the diary is what is full — including the case where the requested duration
 * fits no window at all, which produces no slots and reads correctly as a day
 * with no room in it.
 */
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
