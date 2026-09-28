import { USER_ROLE } from "@clinic/shared";

export const HAS_OWN_CALENDAR: readonly string[] = [USER_ROLE.DOCTOR, USER_ROLE.VISITING_DOCTOR];

export const DEFAULT_STEP_MINUTES = 15;

export const MINUTES_PER_DAY = 24 * 60;
