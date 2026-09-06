import { USER_ROLE, type UserRole } from '@clinic/shared';

/**
 * The ROLES.md appointments row.
 *
 * | Resource     | admin | doctor    | technician | receptionist |
 * | Calendar     | R     | R (own)   | R          | R            |
 * | Appointments | CRUD  | CRU (own) | —          | CRUD         |
 * | Waiting list | CRUD  | R         | —          | CRUD         |
 *
 * Hiding a control is cosmetic — the API refuses the request either way — but
 * keeping the rules beside the spec they come from is what makes them
 * reviewable, and it is what stops a screen from offering a button that only
 * ever produces a 403.
 */

/** Everyone reads the calendar; a technician gets no write anywhere. */
export const canReadCalendar = (): boolean => true;

export const canBookAppointment = (role: UserRole): boolean => role !== USER_ROLE.TECHNICIAN;

/** Only an admin soft-deletes, like everywhere else (global rule 5). */
export const canDeleteAppointment = (role: UserRole): boolean => role === USER_ROLE.ADMIN;

/**
 * A visit is a clinical record, so a receptionist cannot open one even though
 * they are the one who marks the patient as arrived.
 */
export const canOpenVisit = (role: UserRole): boolean =>
  role === USER_ROLE.ADMIN || role === USER_ROLE.DOCTOR;

export const canManageWaitingList = (role: UserRole): boolean =>
  role === USER_ROLE.ADMIN || role === USER_ROLE.RECEPTIONIST;

/**
 * Whether the calendar shows every doctor or one.
 *
 * A doctor's calendar is their own — the API would serve them the clinic's,
 * since reading it is `R` for every role, but a doctor opening the calendar
 * wants their day, not eight columns of other people's.
 */
export const seesWholeClinic = (role: UserRole): boolean => role !== USER_ROLE.DOCTOR;
