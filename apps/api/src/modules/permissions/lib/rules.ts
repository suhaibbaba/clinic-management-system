import { RULE, USER_ROLE } from "@clinic/shared";
import { type Capability } from "@api/modules/permissions/lib/capability-registry";

const rule = (key: string, resource: string, defaultRoles: Capability["defaultRoles"]): Capability => ({
  key,
  resource,
  method: "RULE",
  path: "",
  defaultRoles,
});

export const RULE_CAPABILITIES: readonly Capability[] = [
  rule(RULE.PATIENTS_CLINICAL, "patients", [USER_ROLE.DOCTOR, USER_ROLE.VISITING_DOCTOR]),
  rule(RULE.PATIENTS_FINANCIAL, "patients", [USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST]),
  rule(RULE.PATIENTS_ALL, "patients", [
    USER_ROLE.DOCTOR,
    USER_ROLE.RECEPTIONIST,
    USER_ROLE.TECHNICIAN,
  ]),
  rule(RULE.CATALOG_DETAILS, "procedure-catalog", [
    USER_ROLE.DOCTOR,
    USER_ROLE.VISITING_DOCTOR,
    USER_ROLE.TECHNICIAN,
  ]),
  rule(RULE.ALL_CALENDARS, "appointments", [USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN]),
  rule(RULE.LAB_PRICE, "lab-orders", [USER_ROLE.TECHNICIAN, USER_ROLE.RECEPTIONIST]),
  rule(RULE.ALL_SCHEDULES, "doctors", []),
  rule(RULE.ALL_NOTES, "notes", []),
  rule(RULE.DELETED_PAYMENTS, "payments", []),
  rule(RULE.OVERDUE_WIDGET, "billing", [USER_ROLE.RECEPTIONIST]),
];
