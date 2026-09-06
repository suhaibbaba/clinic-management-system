/**
 * Whole years since a `YYYY-MM-DD` date of birth.
 *
 * Its own module rather than an export of the patient page: the chart tab
 * needs it to decide whether a deciduous arch is worth offering, and importing
 * it from the page that renders the chart tab is an import cycle.
 *
 * `now` is a parameter so the boundary case — a birthday today — is testable
 * without moving the system clock.
 */
export function ageInYears(dateOfBirth: string, now: Date = new Date()): number {
  const born = new Date(`${dateOfBirth}T00:00:00`);
  let age = now.getFullYear() - born.getFullYear();

  const monthDelta = now.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < born.getDate())) {
    age -= 1;
  }

  return age;
}
