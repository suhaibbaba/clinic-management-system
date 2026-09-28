import { z } from "zod";
import { settingsSchema, weeklyScheduleSchema, optionalPhoneSchema } from "@shared/schemas/common";
import { personNameInputSchema, personNameSchema } from "@shared/schemas/person-name";
import { DEFAULT_TIME_ZONE } from "@shared/time/zone";
import { PHONE_COUNTRY_CODES } from "@shared/constants/phone";

export const CURRENCIES = ["JOD", "ILS", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const clinicScheduleSettingsSchema = z.object({
  timezone: z.string().min(1).default(DEFAULT_TIME_ZONE),
});
export type ClinicScheduleSettings = z.infer<typeof clinicScheduleSettingsSchema>;

export function clinicScheduleSettings(settings: unknown): ClinicScheduleSettings {
  const parsed = clinicScheduleSettingsSchema.safeParse(settings ?? {});

  return parsed.success ? parsed.data : { timezone: DEFAULT_TIME_ZONE };
}

export const documentSettingsSchema = z.object({
  language: z.enum(["ar", "en"]).default("ar"),
});
export type DocumentSettings = z.infer<typeof documentSettingsSchema>;

export function documentSettings(settings: unknown): DocumentSettings {
  const raw =
    typeof settings === "object" && settings !== null
      ? (settings as Record<string, unknown>)["documents"]
      : undefined;

  const parsed = documentSettingsSchema.safeParse(raw ?? {});

  return parsed.success ? parsed.data : { language: "ar" };
}

export const MAX_CLINIC_LOGO_BYTES = 2 * 1024 * 1024;

export const ALLOWED_CLINIC_LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export const clinicLogoMimeSchema = z.enum(ALLOWED_CLINIC_LOGO_MIME_TYPES);
export type ClinicLogoMime = z.infer<typeof clinicLogoMimeSchema>;

export const CLINIC_FAVICON_SIZES = [16, 32, 48] as const;

export const CLINIC_ICONS = [
  { name: "favicon.ico", mime: "image/x-icon", size: 48, purpose: "any" },
  { name: "apple-touch-icon.png", mime: "image/png", size: 180, purpose: "any" },
  { name: "icon-192.png", mime: "image/png", size: 192, purpose: "any" },
  { name: "icon-512.png", mime: "image/png", size: 512, purpose: "any" },
  { name: "icon-maskable-512.png", mime: "image/png", size: 512, purpose: "maskable" },
] as const;

export type ClinicIcon = (typeof CLINIC_ICONS)[number];

export function clinicIcon(name: string): ClinicIcon | undefined {
  return CLINIC_ICONS.find((icon) => icon.name === name);
}

export const MAX_CLINIC_ICON_BYTES = 512 * 1024;

export const presignClinicLogoSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mime: clinicLogoMimeSchema,
  sizeBytes: z.number().int().positive().max(MAX_CLINIC_LOGO_BYTES),
});
export type PresignClinicLogoInput = z.infer<typeof presignClinicLogoSchema>;

export const presignClinicLogoResponseSchema = z.object({
  key: z.string(),
  uploadUrl: z.url(),
  expiresAt: z.iso.datetime(),
  maxSizeBytes: z.number().int().positive(),
});
export type PresignClinicLogoResponse = z.infer<typeof presignClinicLogoResponseSchema>;

export const clinicIconSlotSchema = z.object({
  name: z.string(),
  uploadUrl: z.url(),
  mime: z.string(),
});
export type ClinicIconSlot = z.infer<typeof clinicIconSlotSchema>;

export const presignClinicIconsResponseSchema = z.object({
  sourceUrl: z.url(),
  icons: z.array(clinicIconSlotSchema),
  maxIconSizeBytes: z.number().int().positive(),
});
export type PresignClinicIconsResponse = z.infer<typeof presignClinicIconsResponseSchema>;

export const confirmClinicLogoSchema = z.object({
  key: z.string().trim().min(1).max(512),
});
export type ConfirmClinicLogoInput = z.infer<typeof confirmClinicLogoSchema>;

export const presignClinicAppIconSchema = presignClinicLogoSchema;
export type PresignClinicAppIconInput = z.infer<typeof presignClinicAppIconSchema>;

export const confirmClinicAppIconSchema = confirmClinicLogoSchema;
export type ConfirmClinicAppIconInput = z.infer<typeof confirmClinicAppIconSchema>;

export const clinicManifestSchema = z.object({
  name: z.string(),
  short_name: z.string(),
  lang: z.string(),
  dir: z.enum(["rtl", "ltr"]),
  start_url: z.string(),
  scope: z.string(),
  display: z.literal("standalone"),
  icons: z.array(
    z.object({
      src: z.string(),
      sizes: z.string(),
      type: z.string(),
      purpose: z.enum(["any", "maskable"]),
    }),
  ),
});
export type ClinicManifest = z.infer<typeof clinicManifestSchema>;

export const MAX_APP_SHORT_NAME_LENGTH = 12;

export const clinicBrandingSchema = z.object({
  name: personNameSchema.nullable(),
  logoUrl: z.url().nullable(),
  iconsAt: z.iso.datetime().nullable(),
  appName: z.string(),
});
export type ClinicBranding = z.infer<typeof clinicBrandingSchema>;

const coordinateSchema = (limit: number) =>
  z
    .string()
    .regex(/^-?\d{1,3}(\.\d{1,6})?$/, "Expected a decimal coordinate")
    .refine((value) => Math.abs(Number(value)) <= limit, `Expected between -${limit} and ${limit}`);

export const latitudeSchema = coordinateSchema(90);
export const longitudeSchema = coordinateSchema(180);

export const resolveLocationSchema = z.object({ url: z.url().max(2048) });
export type ResolveLocationInput = z.infer<typeof resolveLocationSchema>;

export const resolvedLocationSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
});
export type ResolvedLocation = z.infer<typeof resolvedLocationSchema>;

export const clinicSchema = z.object({
  id: z.uuid(),
  name: personNameSchema,
  logoKey: z.string().nullable(),
  logoUrl: z.url().nullable(),
  appIconKey: z.string().nullable(),
  appIconUrl: z.url().nullable(),
  logoIconsAt: z.iso.datetime().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  latitude: z.string().nullable(),
  longitude: z.string().nullable(),
  currency: z.string(),
  country: z.string(),
  workingHours: weeklyScheduleSchema,
  settings: settingsSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Clinic = z.infer<typeof clinicSchema>;

export const updateClinicSchema = z
  .object({
    name: personNameInputSchema,
    phone: optionalPhoneSchema,
    email: z.email().max(255).nullish(),
    address: z.string().trim().max(500).nullish(),
    latitude: latitudeSchema.nullish(),
    longitude: longitudeSchema.nullish(),
    currency: z.enum(CURRENCIES),
    country: z.enum(PHONE_COUNTRY_CODES),
    workingHours: weeklyScheduleSchema,
    settings: settingsSchema,
  })
  .partial()
  .refine((input) => Object.keys(input).length > 0, "At least one field must be provided")
  .refine(
    (input) =>
      (input.latitude ?? null) === null
        ? (input.longitude ?? null) === null
        : input.longitude != null,
    { message: "Latitude and longitude must be given together", path: ["longitude"] },
  );
export type UpdateClinicInput = z.infer<typeof updateClinicSchema>;
