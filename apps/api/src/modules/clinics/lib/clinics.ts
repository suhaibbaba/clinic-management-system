import { clinics } from "@api/database/schema";
import { type DocumentSettings, documentSettings, type Clinic } from "@clinic/shared";

export type ClinicRow = typeof clinics.$inferSelect;

export const iconKey = (sourceKey: string, name: string): string => `${sourceKey}/icons/${name}`;

export function appName(
  row: { nameAr: string; nameEn: string; settings: unknown } | undefined,
): string {
  if (!row) {
    return "";
  }

  const language: DocumentSettings["language"] = documentSettings(row.settings).language;

  return language === "ar" ? row.nameAr : row.nameEn;
}

export const iconSource = (row: {
  logoKey: string | null;
  appIconKey: string | null;
}): string | null => row.appIconKey ?? row.logoKey;

export function toClinic(row: ClinicRow): Omit<Clinic, "logoUrl" | "appIconUrl"> {
  return {
    id: row.id,
    name: { ar: row.nameAr, en: row.nameEn },
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
