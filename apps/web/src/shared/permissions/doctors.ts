import { RULE } from "@clinic/shared";
import type { Can } from "@web/shared/providers/session";

export const canManageDoctors = (can: Can): boolean => can("doctors.update");

export const canDeleteDoctor = (can: Can): boolean => can("doctors.remove");

export const canEditAnySchedule = (can: Can): boolean => can(RULE.ALL_SCHEDULES);

export const canSeeSettlement = (can: Can): boolean => can("doctor-settlements.settlement");

export const canAddVisitingDoctor = (can: Can): boolean => can("doctors.createVisiting");
