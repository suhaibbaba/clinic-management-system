import { APPOINTMENT_STATUS, type AppointmentStatus } from "@clinic/shared";
import type { BadgeTone } from "@clinic/ui/components/badge";
import { TONE_SURFACE } from "@clinic/ui/components/tone";

// The block, the badge and the dot all read this, so a status cannot be amber in one place and
// green in another. The colour itself comes from `TONE_SURFACE` — this table names tones.
export interface StatusStyle {
  readonly block: string;
  readonly tone: BadgeTone;
}

const block = (tone: BadgeTone, override = ""): StatusStyle => ({
  tone,
  block: override === "" ? TONE_SURFACE[tone] : `${TONE_SURFACE[tone]} ${override}`,
});

export const APPOINTMENT_STATUS_STYLES: Record<AppointmentStatus, StatusStyle> = {
  [APPOINTMENT_STATUS.REQUESTED]: block("warning"),
  [APPOINTMENT_STATUS.CONFIRMED]: block("info"),
  [APPOINTMENT_STATUS.ARRIVED]: block("success"),
  [APPOINTMENT_STATUS.IN_PROGRESS]: block("success", "border-success-500 bg-success-200"),
  [APPOINTMENT_STATUS.COMPLETED]: block("neutral"),
  [APPOINTMENT_STATUS.NO_SHOW]: block("danger"),
  [APPOINTMENT_STATUS.CANCELLED]: block("neutral", "bg-surface line-through"),
};

/** i18n keys, so no component ever holds an Arabic string. */
export const statusLabelKey = (status: AppointmentStatus): string =>
  `appointments.statuses.${status}`;

export const CANCELLABLE_STATUSES: readonly AppointmentStatus[] = [
  APPOINTMENT_STATUS.REQUESTED,
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.ARRIVED,
  APPOINTMENT_STATUS.IN_PROGRESS,
];
