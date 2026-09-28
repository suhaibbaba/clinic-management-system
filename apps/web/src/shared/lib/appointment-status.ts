import { APPOINTMENT_STATUS, type AppointmentStatus } from "@clinic/shared";
import type { BadgeTone } from "@clinic/ui/components/badge";
import { TONE_SURFACE } from "@clinic/ui/components/tone";

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

const TONE_ACCENT: Record<BadgeTone, string> = {
  neutral: "border-s-neutral-400",
  success: "border-s-success-500",
  warning: "border-s-warning-500",
  danger: "border-s-danger-500",
  info: "border-s-primary-500",
};

export const statusAccent = (status: AppointmentStatus): string =>
  TONE_ACCENT[APPOINTMENT_STATUS_STYLES[status].tone];

export const statusLabelKey = (status: AppointmentStatus): string =>
  `appointments.statuses.${status}`;

export const CANCELLABLE_STATUSES: readonly AppointmentStatus[] = [
  APPOINTMENT_STATUS.REQUESTED,
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.ARRIVED,
  APPOINTMENT_STATUS.IN_PROGRESS,
];
