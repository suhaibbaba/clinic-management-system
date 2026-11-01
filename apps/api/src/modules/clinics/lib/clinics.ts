import { clinics } from "@api/database/schema";
import {
  appointmentSettingsSchema,
  clinicLocaleSettingsSchema,
  documentLanguage,
  documentSettingsSchema,
  localized,
  type Clinic,
  type LocalizedText,
} from "@clinic/shared";
import type { ZodType } from "zod";

export type ClinicRow = typeof clinics.$inferSelect;

export const iconKey = (sourceKey: string, name: string): string => `${sourceKey}/icons/${name}`;

export function appName(
  row: { name: LocalizedText; country: string; settings: unknown } | undefined,
): string {
  if (!row) {
    return "";
  }

  return localized(row.name, documentLanguage(row));
}

export const iconSource = (row: {
  logoKey: string | null;
  appIconKey: string | null;
}): string | null => row.appIconKey ?? row.logoKey;

export function toClinic(row: ClinicRow): Omit<Clinic, "logoUrl" | "appIconUrl"> {
  return {
    id: row.id,
    name: row.name,
    logoKey: row.logoKey,
    appIconKey: row.appIconKey,
    logoIconsAt: row.logoIconsAt?.toISOString() ?? null,
    phone: row.phone,
    email: row.email,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    currency: row.currency,
    country: row.country,
    workingHours: row.workingHours,
    settings: row.settings,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const SETTINGS_SECTIONS: readonly (readonly [string, ZodType])[] = [
  ["appointments", appointmentSettingsSchema.strict()],
  ["locale", clinicLocaleSettingsSchema.strict()],
  ["documents", documentSettingsSchema.strict()],
];

export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value === "") {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en", { timeZone: value });

    return true;
  } catch {
    return false;
  }
}
