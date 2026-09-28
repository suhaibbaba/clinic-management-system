export function ageInYears(dateOfBirth: string, now: Date = new Date()): number {
  const born = new Date(`${dateOfBirth}T00:00:00`);
  let age = now.getFullYear() - born.getFullYear();

  const monthDelta = now.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < born.getDate())) {
    age -= 1;
  }

  return age;
}
