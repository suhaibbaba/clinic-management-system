import { clinicScheduleSettings, type Clinic } from "@clinic/shared";

let zone = resolveBrowserZone();

function resolveBrowserZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export const clinicTimeZone = (): string => zone;

export const resetClinicTimeZone = (): void => {
  zone = resolveBrowserZone();
};

export function setClinicTimeZone(clinic: Clinic | undefined): void {
  if (clinic) {
    zone = clinicScheduleSettings(clinic.settings).timezone;
  }
}
