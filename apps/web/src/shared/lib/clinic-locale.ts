import {
  clinicLocale,
  numberSeparators,
  type ClinicLocale,
  type ClinicLocaleSource,
  type NumberSeparators,
} from "@clinic/shared";

function browserZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

let current: ClinicLocale = { ...clinicLocale(null), timeZone: browserZone() };

export const activeClinicLocale = (): ClinicLocale => current;

export const clinicTimeZone = (): string => current.timeZone;

export const clinicSeparators = (): NumberSeparators => numberSeparators(current.numberLocale);

export function setClinicLocale(locale: ClinicLocale | undefined): void {
  if (locale) {
    current = locale;
  }
}

export function setClinicTimeZone(clinic: ClinicLocaleSource | undefined): void {
  if (clinic) {
    current = clinicLocale(clinic);
  }
}
