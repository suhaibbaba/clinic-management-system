import type { Can } from "@web/providers/session";

export const canAddVisitingDoctor = (can: Can): boolean => can("doctors.createVisiting");
