/** ISO 3166-1 alpha-2, the code a clinic's country and a phone's flag are stored by. */
export const PHONE_COUNTRIES = [
  { country: "PS", dial: "+970" },
  { country: "IL", dial: "+972" },
  { country: "JO", dial: "+962" },
  { country: "EG", dial: "+20" },
  { country: "SA", dial: "+966" },
  { country: "AE", dial: "+971" },
  { country: "QA", dial: "+974" },
  { country: "KW", dial: "+965" },
  { country: "BH", dial: "+973" },
  { country: "OM", dial: "+968" },
  { country: "LB", dial: "+961" },
  { country: "SY", dial: "+963" },
  { country: "IQ", dial: "+964" },
  { country: "TR", dial: "+90" },
  { country: "GB", dial: "+44" },
  { country: "DE", dial: "+49" },
  { country: "US", dial: "+1" },
] as const;

export type PhoneCountry = (typeof PHONE_COUNTRIES)[number]["country"];

export const PHONE_COUNTRY_CODES = PHONE_COUNTRIES.map((entry) => entry.country) as [
  PhoneCountry,
  ...PhoneCountry[],
];

export const DEFAULT_PHONE_COUNTRY: PhoneCountry = "PS";

export const isPhoneCountry = (value: string | null | undefined): value is PhoneCountry =>
  PHONE_COUNTRIES.some((entry) => entry.country === value);

export const dialCodeOf = (country: PhoneCountry): string =>
  PHONE_COUNTRIES.find((entry) => entry.country === country)?.dial ?? "+970";

// Longest first, so +972 is never read as +97 and a code is matched whole.
const BY_DIAL_LENGTH = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

const digitsOf = (value: string): string => value.replace(/\D/g, "");

/** The national number as dialled inside the country: no spacing, no trunk `0`. */
const nationalNumber = (local: string): string => digitsOf(local).replace(/^0/, "");

/** `+962` and `079…` → `+96279…`; a box that already holds a full number keeps it; empty → null. */
export function joinPhone(country: PhoneCountry, local: string): string | null {
  const trimmed = local.trim();

  if (trimmed.startsWith("+") || trimmed.startsWith("00")) {
    return normalizePhone(trimmed);
  }

  const national = nationalNumber(trimmed);

  return national === "" ? null : `${dialCodeOf(country)}${national}`;
}

/**
 * A stored or typed number in one international shape: `00` becomes `+`, spacing goes, and a trunk
 * `0` after a known code is dropped (`+962 079…` → `+96279…`). A local number takes `country`'s code.
 */
export function normalizePhone(
  value: string,
  country: PhoneCountry = DEFAULT_PHONE_COUNTRY,
): string {
  const trimmed = value.trim();

  if (!trimmed.startsWith("+") && !trimmed.startsWith("00")) {
    return `${dialCodeOf(country)}${nationalNumber(trimmed)}`;
  }

  const international = `+${digitsOf(trimmed).replace(/^00/, "")}`;
  const known = BY_DIAL_LENGTH.find((entry) => international.startsWith(entry.dial));

  return known
    ? `${known.dial}${international.slice(known.dial.length).replace(/^0/, "")}`
    : international;
}

/** The picker's view of a stored number: its country, and the rest to show in the box. */
export function splitPhone(
  value: string | null | undefined,
  fallback: PhoneCountry = DEFAULT_PHONE_COUNTRY,
): { readonly country: PhoneCountry; readonly local: string } {
  if (!value) {
    return { country: fallback, local: "" };
  }

  const known = BY_DIAL_LENGTH.find((entry) => value.startsWith(entry.dial));

  return known
    ? { country: known.country, local: value.slice(known.dial.length) }
    : { country: fallback, local: value };
}

/** E.164: a `+` and 7 to 15 digits. */
export const INTERNATIONAL_PHONE_PATTERN = /^\+\d{7,15}$/;
