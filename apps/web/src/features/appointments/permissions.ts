import { USER_ROLE, type UserRole } from '@clinic/shared';

// The ROLES.md appointments row, kept beside the spec: hiding a control is cosmetic, but it stops a
// screen offering a button that only ever 403s.

export const canBookAppointment = (role: UserRole): boolean => role !== USER_ROLE.TECHNICIAN;

// A visit is a clinical record, so a receptionist cannot open one even though they mark the patient
// as arrived.
export const canOpenVisit = (role: UserRole): boolean =>
  role === USER_ROLE.ADMIN || role === USER_ROLE.DOCTOR;

export const canManageWaitingList = (role: UserRole): boolean =>
  role === USER_ROLE.ADMIN || role === USER_ROLE.RECEPTIONIST;

// The API would serve a doctor the whole clinic — reading is `R` for every role — but a doctor
// opening the calendar wants their day, not eight columns.
export const seesWholeClinic = (role: UserRole): boolean => role !== USER_ROLE.DOCTOR;
