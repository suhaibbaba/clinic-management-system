import { USER_ROLE, type UserRole } from "@clinic/shared";
import type { Can } from "@web/features/auth/session";
import type { AppointmentStep } from "@web/features/appointments/queries";

export const canBookAppointment = (can: Can): boolean => can("appointments.create");

/** Each move an appointment can make is its own permission, so each button asks for its own. */
export const canMoveAppointment = (can: Can, step: AppointmentStep): boolean =>
  can(`appointments.${step}`);

export const canCancelAppointment = (can: Can): boolean => can("appointments.cancel");

/** Turning an appointment into a visit — the clinical record it becomes. */
export const canOpenVisit = (can: Can): boolean => can("appointments.convertToVisit");

export const canManageWaitingList = (can: Can): boolean => can("waiting-list.create");

// Not a permission: the API would serve a doctor the whole clinic — reading is `R` for every role —
// but a doctor opening the calendar wants their day, not eight columns.
export const seesWholeClinic = (role: UserRole): boolean =>
  role !== USER_ROLE.DOCTOR && role !== USER_ROLE.VISITING_DOCTOR;
