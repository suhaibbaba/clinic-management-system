import type { AuditAction } from "@clinic/shared";
import type { BadgeTone } from "@clinic/ui";

export const AUDIT_ENTITIES = ["users", "doctors", "clinics"] as const;

export const AUDIT_ACTION_TONES: Record<AuditAction, BadgeTone> = {
  create: "success",
  update: "info",
  delete: "danger",
};
