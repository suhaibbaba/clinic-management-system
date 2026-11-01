import { CLINIC_MODULES, type ClinicModule } from "@clinic/shared";

export const subscriptionModules = (
  planModules: readonly ClinicModule[],
  addOnModules: readonly ClinicModule[],
): ClinicModule[] => {
  const chosen = new Set([...planModules, ...addOnModules]);

  return CLINIC_MODULES.filter((module) => chosen.has(module));
};
