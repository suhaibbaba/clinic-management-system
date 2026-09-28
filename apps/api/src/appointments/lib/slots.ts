import type { TimeRange } from "@clinic/shared";

export interface BusyInterval {
  readonly startMinute: number;
  readonly endMinute: number;
}

export interface ComputedSlot {
  readonly startMinute: number;
  readonly endMinute: number;
  readonly available: boolean;
}

export type ClosedReason =
  | "clinic_closed"
  | "clinic_closure"
  | "doctor_off"
  | "doctor_time_off"
  | "fully_booked"
  | "day_over";

export interface SlotComputation {
  readonly closedReason: ClosedReason | null;
  readonly slots: readonly ComputedSlot[];
}

export interface SlotComputationInput {
  readonly clinicRanges: readonly TimeRange[];
  readonly doctorRanges: readonly TimeRange[];
  readonly isClosed: boolean;
  readonly timeOff: readonly BusyInterval[];
  readonly busy: readonly BusyInterval[];
  readonly durationMinutes: number;
  readonly stepMinutes: number;
  readonly notBeforeMinute?: number | undefined;
}

const MINUTES_PER_DAY = 24 * 60;

export function toMinutes(time: string): number {
  const [hours = "0", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

export function toTimeOfDay(minute: number): string {
  const clamped = Math.max(0, Math.min(MINUTES_PER_DAY, Math.round(minute)));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

interface Interval {
  readonly start: number;
  readonly end: number;
}

const toInterval = (range: TimeRange): Interval => ({
  start: toMinutes(range.start),
  end: toMinutes(range.end),
});

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

const overlaps = (a: Interval, b: BusyInterval): boolean =>
  a.start < b.endMinute && b.startMinute < a.end;

export function computeDaySlots(input: SlotComputationInput): SlotComputation {
  if (input.isClosed) {
    return { closedReason: "clinic_closure", slots: [] };
  }

  if (input.clinicRanges.length === 0) {
    return { closedReason: "clinic_closed", slots: [] };
  }

  if (input.doctorRanges.length === 0) {
    return { closedReason: "doctor_off", slots: [] };
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
    return "day_over";
  }

  const allAway =
    slots.length > 0 &&
    slots.every((slot) =>
      timeOff.some((off) => overlaps({ start: slot.startMinute, end: slot.endMinute }, off)),
    );

  return allAway ? "doctor_time_off" : "fully_booked";
}
