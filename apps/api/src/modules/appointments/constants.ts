import { USER_ROLE } from "@clinic/shared";

export const HAS_OWN_CALENDAR: readonly string[] = [USER_ROLE.DOCTOR, USER_ROLE.VISITING_DOCTOR];

export const NO_DOCTOR_ID = "00000000-0000-0000-0000-000000000000";

export const DEFAULT_STEP_MINUTES = 15;

export const MINUTES_PER_DAY = 24 * 60;

export const DAY_MS = 86_400_000;
