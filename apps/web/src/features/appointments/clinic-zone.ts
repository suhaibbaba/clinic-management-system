import { clinicScheduleSettings, type Clinic } from '@clinic/shared';

/**
 * The timezone the clinic's day is expressed in.
 *
 * A module-level value rather than a prop threaded through nine components,
 * because there is exactly one clinic per session and every one of those
 * components would pass it straight down unchanged. `useSyncClinicTimeZone`
 * sets it once the clinic query resolves; until then it is the browser's own
 * zone, which is right in the building and wrong nowhere that matters for the
 * few hundred milliseconds before the query lands.
 *
 * The point of it existing at all: the API books in the clinic's zone. If the
 * grid drew in the browser's, a laptop with a wrong timezone would show 06:00
 * where the API booked 09:00 — the calendar and the availability endpoint
 * would disagree about what a day contains, and the patient would arrive at
 * the wrong hour.
 */
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

/**
 * Back to the browser's zone.
 *
 * Module state outlives a test, so a suite that renders a Damascus clinic
 * would otherwise leave the next one drawing Damascus times. Exported for
 * that reason and used nowhere else.
 */
export const resetClinicTimeZone = (): void => {
  zone = resolveBrowserZone();
};

/** Called by the page once the clinic's settings are known. */
export function setClinicTimeZone(clinic: Clinic | undefined): void {
  if (clinic) {
    zone = clinicScheduleSettings(clinic.settings).timezone;
  }
}
