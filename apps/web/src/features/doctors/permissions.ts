import type { Can } from "@web/features/auth/session";

/** Adding an external doctor from a treatment plan: admin and doctor by default. */
export const canAddVisitingDoctor = (can: Can): boolean => can("doctors.createVisiting");
