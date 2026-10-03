import { CLINIC_MODULE, type ClinicModule, type UserRole } from "@clinic/shared";

export interface Capability {
  readonly key: string;
  readonly resource: string;
  readonly method: string;
  readonly path: string;
  readonly defaultRoles: UserRole[];
  readonly module?: ClinicModule | undefined;
}

export const MODULE_OF_RESOURCE: Readonly<Record<string, ClinicModule>> = {
  ai: CLINIC_MODULE.ASSISTANT,
};

export const scopeOf = (controller: { name: string }): string =>
  controller.name
    .replace(/Controller$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
