import { z } from "zod";
import { localizedTextInputSchema, localizedTextSchema } from "@shared/locale/localized-text";
import { COUNTRY_PRESETS } from "@shared/locale/countries";
import { phoneSchema } from "@shared/schemas/common";
import { CLINIC_MODULES, missingModules } from "@shared/constants/permissions";
import { SPECIALTY_CODE, SUBSCRIPTION_STATUSES } from "@shared/enums";
import { paginationQuerySchema } from "@shared/schemas/common";

const modulesSchema = z
  .array(z.enum(CLINIC_MODULES))
  .max(CLINIC_MODULES.length)
  .refine((modules) => new Set(modules).size === modules.length, "A module is listed twice");

export const VENDOR_MISSING_MODULES = "vendor_missing_modules";

export const vendorLoginSchema = z.object({
  email: z.email().max(200),
  password: z.string().min(1).max(200),
});
export type VendorLoginInput = z.infer<typeof vendorLoginSchema>;

export const vendorProfileSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
});
export type VendorProfile = z.infer<typeof vendorProfileSchema>;

export const planSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  modules: z.array(z.enum(CLINIC_MODULES)),
  maxUsers: z.number().int().nullable(),
  maxDoctors: z.number().int().nullable(),
  isActive: z.boolean(),
  clinicCount: z.number().int().min(0),
  createdAt: z.iso.datetime(),
});
export type Plan = z.infer<typeof planSchema>;

export const savePlanSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{2,40}$/),
  name: z.string().trim().min(1).max(80),
  modules: modulesSchema.refine(
    (modules) => missingModules(modules).length === 0,
    VENDOR_MISSING_MODULES,
  ),
  maxUsers: z.number().int().min(1).max(10_000).nullable(),
  maxDoctors: z.number().int().min(1).max(10_000).nullable(),
  isActive: z.boolean(),
});
export type SavePlanInput = z.infer<typeof savePlanSchema>;

export const subscriptionSchema = z.object({
  planId: z.uuid(),
  planName: z.string(),
  addOnModules: z.array(z.enum(CLINIC_MODULES)),
  status: z.enum(SUBSCRIPTION_STATUSES),
  startsOn: z.iso.date(),
  endsOn: z.iso.date().nullable(),
  graceDays: z.number().int().min(0),
  notes: z.string().nullable(),
  updatedAt: z.iso.datetime(),
});
export type Subscription = z.infer<typeof subscriptionSchema>;

export const saveSubscriptionSchema = z
  .object({
    planId: z.uuid(),
    addOnModules: modulesSchema,
    status: z.enum(SUBSCRIPTION_STATUSES),
    startsOn: z.iso.date(),
    endsOn: z.iso.date().nullable(),
    graceDays: z.number().int().min(0).max(90),
    notes: z.string().trim().max(500).nullable(),
  })
  .refine((input) => input.endsOn === null || input.endsOn >= input.startsOn, {
    message: "The subscription cannot end before it starts",
    path: ["endsOn"],
  });
export type SaveSubscriptionInput = z.infer<typeof saveSubscriptionSchema>;

export const VENDOR_DOMAIN_TAKEN = "vendor_domain_taken";

export const VENDOR_SLUG_TAKEN = "vendor_slug_taken";

export const VENDOR_PHONE_TAKEN = "vendor_phone_taken";

export const VENDOR_EMAIL_TAKEN = "vendor_email_taken";

export const clinicDomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((value) => value.replace(/^https?:\/\//, "").replace(/\/+$/, "").replace(/^(?:www|admin)\./, ""))
  .pipe(
    z
      .string()
      .max(253)
      .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, "Not a domain"),
  );

export const saveClinicDomainSchema = z.object({
  domain: clinicDomainSchema.nullable(),
});
export type SaveClinicDomainInput = z.infer<typeof saveClinicDomainSchema>;

export const vendorClinicSummarySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: localizedTextSchema,
  domain: z.string().nullable(),
  removedAt: z.iso.datetime().nullable(),
  modules: z.array(z.enum(CLINIC_MODULES)),
  specialties: z.array(z.string()),
  users: z.number().int().min(0),
  createdAt: z.iso.datetime(),
  subscription: subscriptionSchema.nullable(),
});
export type VendorClinicSummary = z.infer<typeof vendorClinicSummarySchema>;

export const VENDOR_CLINIC_FILTER = { NONE: "none", REMOVED: "removed" } as const;

export const vendorClinicsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(80).optional(),
  status: z
    .enum([...SUBSCRIPTION_STATUSES, VENDOR_CLINIC_FILTER.NONE, VENDOR_CLINIC_FILTER.REMOVED])
    .optional(),
});
export type VendorClinicsQuery = z.infer<typeof vendorClinicsQuerySchema>;

export const subscriptionEventSchema = z.object({
  id: z.uuid(),
  action: z.string(),
  actor: z.string().nullable(),
  oldValue: z.unknown(),
  newValue: z.unknown(),
  createdAt: z.iso.datetime(),
});
export type SubscriptionEvent = z.infer<typeof subscriptionEventSchema>;

export const vendorClinicDetailSchema = vendorClinicSummarySchema.extend({
  doctors: z.number().int().min(0),
  events: z.array(subscriptionEventSchema),
});
export type VendorClinicDetail = z.infer<typeof vendorClinicDetailSchema>;

export const vendorOverviewSchema = z.object({
  clinics: z.number().int().min(0),
  active: z.number().int().min(0),
  trial: z.number().int().min(0),
  grace: z.number().int().min(0),
  suspended: z.number().int().min(0),
  cancelled: z.number().int().min(0),
  endingSoon: z.number().int().min(0),
  readOnly: z.number().int().min(0),
  unmanaged: z.number().int().min(0),
  removed: z.number().int().min(0),
});
export type VendorOverview = z.infer<typeof vendorOverviewSchema>;

export const grantSpecialtySchema = z.object({
  code: z.enum(Object.values(SPECIALTY_CODE)),
});
export type GrantSpecialtyInput = z.infer<typeof grantSpecialtySchema>;

export const createClinicSchema = z.object({
  name: localizedTextInputSchema(2, 120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .refine((code) => code in COUNTRY_PRESETS, "Unknown country"),
  domain: clinicDomainSchema.nullable(),
  specialties: z
    .array(z.enum(Object.values(SPECIALTY_CODE)))
    .min(1)
    .refine((codes) => new Set(codes).size === codes.length, "A specialty is listed twice"),
  planId: z.uuid(),
  trialDays: z.number().int().min(0).max(365),
  admin: z.object({
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
    phone: phoneSchema,
    email: z.email().max(200).nullable(),
  }),
});
export type CreateClinicInput = z.infer<typeof createClinicSchema>;

export const createdClinicSchema = z.object({ id: z.uuid() });
export type CreatedClinic = z.infer<typeof createdClinicSchema>;
