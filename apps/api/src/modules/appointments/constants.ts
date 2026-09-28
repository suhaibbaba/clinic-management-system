import { USER_ROLE } from "@clinic/shared";

export const HAS_OWN_CALENDAR: readonly string[] = [USER_ROLE.DOCTOR, USER_ROLE.VISITING_DOCTOR];

export const APPOINTMENTS_ENTITY = "appointments";

export const EXCLUSION_VIOLATION = "23P01";

export const DEADLOCK = "40P01";

export const DEFAULT_STEP_MINUTES = 15;

export const MINUTES_PER_DAY = 24 * 60;

export const WAITING_LIST_ENTITY = "waiting_list";
