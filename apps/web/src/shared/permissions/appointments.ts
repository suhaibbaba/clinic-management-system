import { RULE } from "@clinic/shared";
import type { Can } from "@web/shared/providers/session";
import type { AppointmentStep } from "@web/shared/queries/appointments";

export const canBookAppointment = (can: Can): boolean => can("appointments.create");

export const canMoveAppointment = (can: Can, step: AppointmentStep): boolean =>
  can(`appointments.${step}`);

export const canCancelAppointment = (can: Can): boolean => can("appointments.cancel");

export const canOpenVisit = (can: Can): boolean => can("appointments.convertToVisit");

export const canManageWaitingList = (can: Can): boolean => can("waiting-list.create");

export const seesWholeClinic = (can: Can): boolean => can(RULE.ALL_CALENDARS);
