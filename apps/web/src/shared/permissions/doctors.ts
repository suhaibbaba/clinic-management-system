import type { Can } from "@web/shared/providers/session";

export const canAddVisitingDoctor = (can: Can): boolean => can("doctors.createVisiting");
