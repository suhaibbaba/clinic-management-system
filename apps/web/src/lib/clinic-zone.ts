import { clinicScheduleSettings, type Clinic } from '@clinic/shared';

// The API books in the clinic's zone, so a grid drawn in the browser's would show 06:00 where 09:00
// was booked. Module-level rather than a prop through nine components.
let zone = resolveBrowserZone();

function resolveBrowserZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    /* istanbul ignore next -- every supported browser resolves a zone. */
    return 'UTC';
  }
}

export const clinicTimeZone = (): string => zone;

// Module state outlives a test, so a suite that renders a Ramallah clinic would leave the next one
// drawing Ramallah times.
export const resetClinicTimeZone = (): void => {
  zone = resolveBrowserZone();
};

export function setClinicTimeZone(clinic: Clinic | undefined): void {
  if (clinic) {
    zone = clinicScheduleSettings(clinic.settings).timezone;
  }
}
