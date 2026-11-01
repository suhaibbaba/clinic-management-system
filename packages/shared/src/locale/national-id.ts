const digitsOf = (value: string): number[] => [...value].map(Number);

function isTurkishId(value: string): boolean {
  if (!/^[1-9]\d{10}$/.test(value)) {
    return false;
  }

  const d = digitsOf(value);
  const odd = (d[0] ?? 0) + (d[2] ?? 0) + (d[4] ?? 0) + (d[6] ?? 0) + (d[8] ?? 0);
  const even = (d[1] ?? 0) + (d[3] ?? 0) + (d[5] ?? 0) + (d[7] ?? 0);
  const tenth = (((odd * 7 - even) % 10) + 10) % 10;
  const eleventh = d.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10;

  return d[9] === tenth && d[10] === eleventh;
}

const NATIONAL_ID_CHECKS: Readonly<Record<string, (value: string) => boolean>> = {
  TR: isTurkishId,
};

export const hasNationalIdCheck = (country: string): boolean =>
  NATIONAL_ID_CHECKS[country.toUpperCase()] !== undefined;

export function isValidNationalId(value: string, country: string): boolean {
  const check = NATIONAL_ID_CHECKS[country.toUpperCase()];

  return check ? check(value.trim()) : true;
}
