import { z } from "zod";

import { settingsSchema, weeklyScheduleSchema, optionalPhoneSchema } from "@shared/schemas/common";
import { personNameInputSchema, personNameSchema } from "@shared/schemas/person-name";
import { DEFAULT_TIME_ZONE } from "@shared/time/zone";

// A closed list: a typo would quietly relabel every figure. Adding one needs its i18n label and its
// `CURRENCY_SYMBOLS` symbol too.
export const CURRENCIES = ["JOD", "ILS", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const clinicScheduleSettingsSchema = z.object({
  /** IANA zone the clinic's opening hours are expressed in. */
  timezone: z.string().min(1).default(DEFAULT_TIME_ZONE),
});
export type ClinicScheduleSettings = z.infer<typeof clinicScheduleSettingsSchema>;

/** Never throws: unreadable settings must not stop the calendar from loading. */
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

/** Small on purpose: fetched on every page load and drawn into every PDF the clinic prints. */
export const MAX_CLINIC_LOGO_BYTES = 2 * 1024 * 1024;

/** No SVG — it can carry script and is rendered inside the app's own origin. */
export const ALLOWED_CLINIC_LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export const clinicLogoMimeSchema = z.enum(ALLOWED_CLINIC_LOGO_MIME_TYPES);
export type ClinicLogoMime = z.infer<typeof clinicLogoMimeSchema>;

/** Packed into the one `favicon.ico`: a tab, a bookmark and a shortcut each pick the size it wants. */
export const CLINIC_FAVICON_SIZES = [16, 32, 48] as const;

/** Square renderings of the icon source, stored beside it under `${source_key}/icons/`. */
export const CLINIC_ICONS = [
  { name: "favicon.ico", mime: "image/x-icon", size: 48, purpose: "any" },
  { name: "apple-touch-icon.png", mime: "image/png", size: 180, purpose: "any" },
  { name: "icon-192.png", mime: "image/png", size: 192, purpose: "any" },
  { name: "icon-512.png", mime: "image/png", size: 512, purpose: "any" },
  // Android crops to a circle or a squircle, so this one is padded into the central safe zone.
  { name: "icon-maskable-512.png", mime: "image/png", size: 512, purpose: "maskable" },
] as const;

export type ClinicIcon = (typeof CLINIC_ICONS)[number];

export function clinicIcon(name: string): ClinicIcon | undefined {
  return CLINIC_ICONS.find((icon) => icon.name === name);
}

/** A 512px square of flat artwork; anything larger is not an icon this app generated. */
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

/** One slot per `CLINIC_ICONS` entry, signed together so the set uploads in one round. */
export const clinicIconSlotSchema = z.object({
  name: z.string(),
  uploadUrl: z.url(),
  mime: z.string(),
});
export type ClinicIconSlot = z.infer<typeof clinicIconSlotSchema>;

/**
 * Signed against whatever the icons are currently rendered from — the app icon if there is one,
 * otherwise the logo — so re-rendering is one call whichever of the two just changed.
 */
export const presignClinicIconsResponseSchema = z.object({
  sourceUrl: z.url(),
  icons: z.array(clinicIconSlotSchema),
  maxIconSizeBytes: z.number().int().positive(),
});
export type PresignClinicIconsResponse = z.infer<typeof presignClinicIconsResponseSchema>;

/** Called once the client has PUT the object; the API reads the bytes back. */
export const confirmClinicLogoSchema = z.object({
  key: z.string().trim().min(1).max(512),
});
export type ConfirmClinicLogoInput = z.infer<typeof confirmClinicLogoSchema>;

/** A square the clinic supplies when its logo is a wordmark, which has no legible 16px form. */
export const presignClinicAppIconSchema = presignClinicLogoSchema;
export type PresignClinicAppIconInput = z.infer<typeof presignClinicAppIconSchema>;

export const confirmClinicAppIconSchema = confirmClinicLogoSchema;
export type ConfirmClinicAppIconInput = z.infer<typeof confirmClinicAppIconSchema>;

/**
 * The subset of the web app manifest this serves. Colours are deliberately absent: the entry
 * document's `theme-color` already carries them, and naming them twice is a drift waiting to happen.
 */
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

/** iOS truncates a home-screen label at about a dozen characters anyway. */
export const MAX_APP_SHORT_NAME_LENGTH = 12;

/** Pre-auth: no phone, no address, and no indication of how many clinics this deployment serves. */
export const clinicBrandingSchema = z.object({
  name: personNameSchema.nullable(),
  logoUrl: z.url().nullable(),
  /**
   * When the icon set was rendered, or null when there is none. A timestamp rather than a flag
   * because it versions the icon URLs, and a browser re-reads a favicon only when its address moves.
   */
  iconsAt: z.iso.datetime().nullable(),
  /** The home-screen label, already resolved: iOS reads this one, the manifest carries the same. */
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

/** What the settings screen sends when somebody pastes a shortened map link. */
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
  /** R2 object key — never a public URL (CLAUDE.md files & images). */
  logoKey: z.string().nullable(),
  /** Short-lived signed URL for `logoKey`, minted per response. */
  logoUrl: z.url().nullable(),
  /** The square the icons are rendered from when the logo is a wordmark. */
  appIconKey: z.string().nullable(),
  appIconUrl: z.url().nullable(),
  /** When the derived icon set was uploaded and verified; null means the tab falls back. */
  logoIconsAt: z.iso.datetime().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  latitude: z.string().nullable(),
  longitude: z.string().nullable(),
  // Read as a plain string, not the enum: a row stored before the list existed must still parse, or
  // the settings screen cannot load to fix it.
  currency: z.string(),
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
    /** Writes are held to the list, even though reads are not. */
    currency: z.enum(CURRENCIES),
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
