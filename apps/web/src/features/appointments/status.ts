import { APPOINTMENT_STATUS, type AppointmentStatus, type AppointmentType } from '@clinic/shared';

import type { BadgeTone } from '@web/components/ui/badge';

/**
 * What a status looks like, in one table.
 *
 * The calendar draws a block, the drawer draws a badge and the ribbon draws a
 * dot; all three read this, so a status can never be amber in one place and
 * green in another. Every value is a token from `theme.css` — no hex anywhere.
 *
 * The tints are soft on purpose: a day view is *entirely* status colour, and
 * saturated blocks turn a calendar into a warning light. The border carries
 * the tone at a glance and the fill only supports it.
 */
export interface StatusStyle {
  /** The block in the day grid and the card in the agenda. */
  readonly block: string;
  /** The badge in the drawer and the list. */
  readonly tone: BadgeTone;
}

export const APPOINTMENT_STATUS_STYLES: Record<AppointmentStatus, StatusStyle> = {
  // Booked by a patient and not yet confirmed by anyone: the one status that
  // is waiting on the clinic rather than on the patient.
  [APPOINTMENT_STATUS.REQUESTED]: {
    block: 'border-warning-300 bg-warning-50 text-warning-800',
    tone: 'warning',
  },
  [APPOINTMENT_STATUS.CONFIRMED]: {
    block: 'border-primary-200 bg-primary-50 text-primary-800',
    tone: 'info',
  },
  [APPOINTMENT_STATUS.ARRIVED]: {
    block: 'border-success-300 bg-success-50 text-success-800',
    tone: 'success',
  },
  [APPOINTMENT_STATUS.IN_PROGRESS]: {
    block: 'border-success-400 bg-success-100 text-success-800',
    tone: 'success',
  },
  // Done is history: it recedes rather than celebrating.
  [APPOINTMENT_STATUS.COMPLETED]: {
    block: 'border-line-strong bg-inset text-ink-muted',
    tone: 'neutral',
  },
  [APPOINTMENT_STATUS.NO_SHOW]: {
    block: 'border-danger-200 bg-danger-50 text-danger-700',
    tone: 'danger',
  },
  [APPOINTMENT_STATUS.CANCELLED]: {
    block: 'border-line bg-surface text-ink-subtle line-through',
    tone: 'neutral',
  },
};

/** i18n keys, so no component ever holds an Arabic string. */
export const statusLabelKey = (status: AppointmentStatus): string =>
  `appointments.statuses.${status}`;

export const typeLabelKey = (type: AppointmentType): string => `appointments.types.${type}`;

/**
 * The buttons the drawer offers for a status.
 *
 * Derived from the same transition table the API validates against, so the UI
 * cannot offer a move the server will refuse — the table lives in
 * `@clinic/shared` and both sides read it.
 */
export const CANCELLABLE_STATUSES: readonly AppointmentStatus[] = [
  APPOINTMENT_STATUS.REQUESTED,
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.ARRIVED,
  APPOINTMENT_STATUS.IN_PROGRESS,
];
