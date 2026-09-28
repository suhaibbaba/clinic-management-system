import { USER_ROLE, type UserRole } from "@clinic/shared";

export const EDITABLE_ROLES = [
  USER_ROLE.DOCTOR,
  USER_ROLE.VISITING_DOCTOR,
  USER_ROLE.RECEPTIONIST,
  USER_ROLE.TECHNICIAN,
] as const;

export const ROLE_TABS: readonly UserRole[] = [...EDITABLE_ROLES, USER_ROLE.ADMIN];

export const PAIRED_CAPABILITIES: Record<string, string> = {
  "patient-attachments.presignUpload": "patient-attachments.confirmUpload",
  "clinics.presignLogo": "clinics.confirmLogo",
  "clinics.presignAppIcon": "clinics.confirmAppIcon",
  "clinics.presignIcons": "clinics.confirmIcons",
  "users.presignPhoto": "users.confirmPhoto",
  "lab-orders.presign": "lab-orders.confirmAttachment",
};

export const FOLDED_CAPABILITIES = new Set(Object.values(PAIRED_CAPABILITIES));
