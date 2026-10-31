import { z } from "zod";
import { CHART_TYPES } from "@shared/enums";
import {
  dayScheduleSchema,
  paginationQuerySchema,
  phoneSchema,
  uuidSchema,
} from "@shared/schemas/common";
import { clinicLogoMimeSchema } from "@shared/schemas/clinics";
import { personNameSchema } from "@shared/schemas/person-name";

export const MAX_SITE_IMAGE_BYTES = 5 * 1024 * 1024;

export const SITE_HERO_IMAGES_MAX = 3;
export const SITE_FEATURES_MAX = 4;
export const SITE_SERVICES_MAX = 12;
export const SITE_TOPICS_MAX = 8;
export const SITE_GALLERY_MAX = 3;
export const SITE_CASES_MAX = 8;
export const SITE_TESTIMONIALS_MAX = 8;
export const SITE_RATING_MAX = 5;

export const SITE_ICONS = [
  "users",
  "sparkles",
  "shield",
  "heart",
  "gem",
  "smile",
  "star",
  "award",
  "stethoscope",
  "clock",
  "building",
  "calendar",
  "eye",
  "send",
  "monitor",
  "armchair",
  "target",
  "tooth",
  "bone",
] as const;
export type SiteIcon = (typeof SITE_ICONS)[number];

export const SITE_SECTION = {
  SERVICES: "services",
  DOCTORS: "doctors",
  ABOUT: "about",
  BOOKING: "booking",
  CONTACT: "contact",
  PORTAL: "portal",
} as const;
export const SITE_SECTIONS = Object.values(SITE_SECTION);
export type SiteSection = (typeof SITE_SECTION)[keyof typeof SITE_SECTION];

export const SITE_LANGUAGES = ["ar", "en"] as const;
export type SiteLanguage = (typeof SITE_LANGUAGES)[number];

const siteText = (max: number) =>
  z.object({ ar: z.string().trim().max(max), en: z.string().trim().max(max) });

const requiredSiteText = (max: number) =>
  z.object({ ar: z.string().trim().min(1).max(max), en: z.string().trim().max(max) });

export type SiteText = z.infer<ReturnType<typeof siteText>>;

export const siteImageKeySchema = z.string().min(1).max(512);

const siteImage = siteImageKeySchema.nullable();

export const siteFeatureSchema = z.object({
  icon: z.enum(SITE_ICONS),
  label: requiredSiteText(60),
  text: siteText(200).default({ ar: "", en: "" }),
});

export const siteStatSchema = z.object({
  icon: z.enum(SITE_ICONS),
  value: z.string().trim().min(1).max(12),
  label: requiredSiteText(40),
});
export type SiteStat = z.infer<typeof siteStatSchema>;
export type SiteFeature = z.infer<typeof siteFeatureSchema>;

export const siteServiceIdSchema = z.string().regex(/^[a-z0-9-]{1,40}$/);

export const siteServiceSchema = z.object({
  id: siteServiceIdSchema,
  title: requiredSiteText(80),
  description: siteText(240),
  image: siteImage,
  icon: z.enum(SITE_ICONS).default("tooth"),
});
export type SiteService = z.infer<typeof siteServiceSchema>;

const sitePromoSchema = z.object({ title: siteText(120), image: siteImage });

const blankText = { ar: "", en: "" };

const optionalText = (max: number) => siteText(max).default(blankText);

const siteLinkSchema = z
  .union([z.literal(""), z.url({ protocol: /^https$/ }).max(300)])
  .default("");

export const SITE_SOCIALS = ["instagram", "facebook", "whatsapp", "youtube"] as const;
export type SiteSocial = (typeof SITE_SOCIALS)[number];

export const siteCaseSchema = z.object({
  before: siteImage,
  after: siteImage,
  title: optionalText(80),
});
export type SiteCase = z.infer<typeof siteCaseSchema>;

export const siteTestimonialSchema = z.object({
  name: z.string().trim().min(1).max(60),
  text: requiredSiteText(300),
  rating: z.number().int().min(1).max(SITE_RATING_MAX),
});
export type SiteTestimonial = z.infer<typeof siteTestimonialSchema>;

const siteShowcase = <T extends z.ZodType>(item: T, max: number) =>
  z
    .object({
      title: optionalText(120),
      subtitle: optionalText(200),
      items: z.array(item).max(max),
    })
    .default({ title: blankText, subtitle: blankText, items: [] });

export const siteDoctorProfileSchema = z.object({
  doctorId: uuidSchema,
  title: siteText(80),
  bio: siteText(600),
});
export type SiteDoctorProfile = z.infer<typeof siteDoctorProfileSchema>;

const unique = <T>(values: readonly T[]): boolean => new Set(values).size === values.length;

export const siteContentSchema = z.object({
  sections: z.array(z.enum(SITE_SECTIONS)).refine(unique, "Each section may appear once"),
  brand: z
    .object({
      tagline: optionalText(60),
      social: z
        .object({
          instagram: siteLinkSchema,
          facebook: siteLinkSchema,
          whatsapp: siteLinkSchema,
          youtube: siteLinkSchema,
        })
        .default({ instagram: "", facebook: "", whatsapp: "", youtube: "" }),
    })
    .default({
      tagline: blankText,
      social: { instagram: "", facebook: "", whatsapp: "", youtube: "" },
    }),
  hero: z.object({
    title: siteText(120),
    subtitle: siteText(300),
    images: z.array(siteImageKeySchema).max(SITE_HERO_IMAGES_MAX),
    stat: z
      .object({ value: z.string().trim().max(12), label: siteText(60) })
      .default({ value: "", label: blankText }),
  }),
  highlights: z.array(siteFeatureSchema).max(SITE_FEATURES_MAX),
  story: z.object({
    eyebrow: optionalText(60),
    title: siteText(120),
    badge: optionalText(80),
    image: siteImage,
  }),
  services: z.object({
    title: siteText(80),
    subtitle: siteText(200),
    intro: optionalText(400),
    image: siteImage.default(null),
    items: z
      .array(siteServiceSchema)
      .max(SITE_SERVICES_MAX)
      .refine((items) => unique(items.map((item) => item.id)), "Each service id must be unique"),
    promo: sitePromoSchema,
  }),
  doctors: z.object({
    title: siteText(80),
    subtitle: siteText(200),
    hidden: z.array(uuidSchema).max(200),
    image: siteImage.default(null),
    features: z.array(siteFeatureSchema).max(SITE_FEATURES_MAX).default([]),
    profiles: z
      .array(siteDoctorProfileSchema)
      .max(200)
      .refine(
        (profiles) => unique(profiles.map((profile) => profile.doctorId)),
        "Each doctor may have one profile",
      )
      .default([]),
    promo: sitePromoSchema,
  }),
  about: z.object({
    eyebrow: optionalText(80),
    title: siteText(80),
    subtitle: siteText(200),
    body: siteText(2000),
    image: siteImage,
    pillars: z.array(siteFeatureSchema).max(SITE_FEATURES_MAX).default([]),
    note: optionalText(80),
    stats: z.array(siteStatSchema).max(SITE_FEATURES_MAX).default([]),
    statsImage: siteImage.default(null),
    whyTitle: optionalText(80),
    values: z.array(siteFeatureSchema).max(SITE_FEATURES_MAX),
    whyImage: siteImage.default(null),
    whyBadge: optionalText(80),
    quote: z.object({ text: siteText(300), image: siteImage }),
    cta: z
      .object({ title: siteText(120), subtitle: siteText(200), image: siteImage })
      .default({ title: blankText, subtitle: blankText, image: null }),
  }),
  gallery: z
    .object({
      eyebrow: optionalText(60),
      title: optionalText(120),
      body: optionalText(400),
      images: z.array(siteImageKeySchema).max(SITE_GALLERY_MAX),
    })
    .default({ eyebrow: blankText, title: blankText, body: blankText, images: [] }),
  cases: siteShowcase(siteCaseSchema, SITE_CASES_MAX),
  testimonials: siteShowcase(siteTestimonialSchema, SITE_TESTIMONIALS_MAX),
  booking: z.object({ title: siteText(80), subtitle: siteText(200), image: siteImage }),
  contact: z.object({
    title: siteText(80),
    subtitle: siteText(200),
    intro: optionalText(400),
    image: siteImage.default(null),
    note: optionalText(120),
    welcome: siteText(120),
    welcomeBody: optionalText(200),
    welcomeImage: siteImage.default(null),
    topics: z.array(requiredSiteText(60)).max(SITE_TOPICS_MAX).default([]),
    formEnabled: z.boolean(),
  }),
});
export type SiteContent = z.infer<typeof siteContentSchema>;

const blank = (): SiteText => ({ ar: "", en: "" });

export function defaultSiteContent(): SiteContent {
  return {
    sections: SITE_SECTIONS.filter((section) => section !== SITE_SECTION.PORTAL),
    brand: {
      tagline: blank(),
      social: { instagram: "", facebook: "", whatsapp: "", youtube: "" },
    },
    hero: {
      title: blank(),
      subtitle: blank(),
      images: [],
      stat: { value: "", label: blank() },
    },
    highlights: [],
    story: { eyebrow: blank(), title: blank(), badge: blank(), image: null },
    services: {
      title: blank(),
      subtitle: blank(),
      intro: blank(),
      image: null,
      items: [],
      promo: { title: blank(), image: null },
    },
    doctors: {
      title: blank(),
      subtitle: blank(),
      hidden: [],
      image: null,
      features: [],
      profiles: [],
      promo: { title: blank(), image: null },
    },
    about: {
      eyebrow: blank(),
      title: blank(),
      subtitle: blank(),
      body: blank(),
      image: null,
      pillars: [],
      note: blank(),
      stats: [],
      statsImage: null,
      whyTitle: blank(),
      values: [],
      whyImage: null,
      whyBadge: blank(),
      quote: { text: blank(), image: null },
      cta: { title: blank(), subtitle: blank(), image: null },
    },
    gallery: { eyebrow: blank(), title: blank(), body: blank(), images: [] },
    cases: { title: blank(), subtitle: blank(), items: [] },
    testimonials: { title: blank(), subtitle: blank(), items: [] },
    booking: { title: blank(), subtitle: blank(), image: null },
    contact: {
      title: blank(),
      subtitle: blank(),
      intro: blank(),
      image: null,
      note: blank(),
      welcome: blank(),
      welcomeBody: blank(),
      welcomeImage: null,
      topics: [],
      formEnabled: true,
    },
  };
}

export function siteImageKeys(content: SiteContent): string[] {
  const keys = [
    ...content.hero.images,
    content.story.image,
    content.services.image,
    ...content.services.items.map((item) => item.image),
    content.doctors.image,
    content.contact.image,
    content.contact.welcomeImage,
    content.services.promo.image,
    content.doctors.promo.image,
    content.about.image,
    content.about.statsImage,
    content.about.whyImage,
    content.about.cta.image,
    content.about.quote.image,
    content.booking.image,
    ...content.gallery.images,
    ...content.cases.items.flatMap((item) => [item.before, item.after]),
  ];

  return [...new Set(keys.filter((key): key is string => key !== null))];
}

export const publicSiteDoctorSchema = z.object({
  id: uuidSchema,
  name: personNameSchema,
  specialty: z.string(),
  photoUrl: z.url().nullable(),
});
export type PublicSiteDoctor = z.infer<typeof publicSiteDoctorSchema>;

export const publicSiteClinicSchema = z.object({
  name: personNameSchema,
  slug: z.string(),
  logoUrl: z.url().nullable(),
  phone: z.string().nullable(),
  country: z.string(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  workingHours: z.array(dayScheduleSchema),
  bookingEnabled: z.boolean(),
  chartTypes: z.array(z.enum(CHART_TYPES)),
});
export type PublicSiteClinic = z.infer<typeof publicSiteClinicSchema>;

export const publicSiteSchema = z.object({
  clinic: publicSiteClinicSchema,
  doctors: z.array(publicSiteDoctorSchema),
  content: siteContentSchema,
  images: z.record(z.string(), z.url()),
});
export type PublicSite = z.infer<typeof publicSiteSchema>;

export const SITE_PREVIEW_MESSAGE = {
  READY: "clinic-site-preview-ready",
  SITE: "clinic-site-preview",
} as const;

export const websiteEditorSchema = z.object({
  site: publicSiteSchema,
  publishedAt: z.iso.datetime().nullable(),
  unpublished: z.boolean(),
});
export type WebsiteEditor = z.infer<typeof websiteEditorSchema>;

export const presignSiteImageSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mime: clinicLogoMimeSchema,
  sizeBytes: z.number().int().positive().max(MAX_SITE_IMAGE_BYTES),
});
export type PresignSiteImageInput = z.infer<typeof presignSiteImageSchema>;

export const presignSiteImageResponseSchema = z.object({
  key: z.string(),
  uploadUrl: z.url(),
  url: z.url(),
  expiresAt: z.iso.datetime(),
  maxSizeBytes: z.number().int().positive(),
});
export type PresignSiteImageResponse = z.infer<typeof presignSiteImageResponseSchema>;

export const siteSlugParamSchema = z.object({
  clinicSlug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Not a clinic handle"),
});
export type SiteSlugParam = z.infer<typeof siteSlugParamSchema>;

export const createContactMessageSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  email: z.email().max(254).nullish(),
  topic: z.string().trim().max(60).nullish(),
  message: z.string().trim().min(5).max(2000),
});
export type CreateContactMessageInput = z.infer<typeof createContactMessageSchema>;

export const contactMessageReceiptSchema = z.object({ received: z.literal(true) });
export type ContactMessageReceipt = z.infer<typeof contactMessageReceiptSchema>;

export const CONTACT_MESSAGE_STATUS = { OPEN: "open", HANDLED: "handled" } as const;
export const CONTACT_MESSAGE_STATUSES = Object.values(CONTACT_MESSAGE_STATUS);
export type ContactMessageStatus =
  (typeof CONTACT_MESSAGE_STATUS)[keyof typeof CONTACT_MESSAGE_STATUS];

export const contactMessageSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  topic: z.string().nullable(),
  message: z.string(),
  status: z.enum(CONTACT_MESSAGE_STATUSES),
  createdAt: z.iso.datetime(),
  handledAt: z.iso.datetime().nullable(),
  handledBy: personNameSchema.nullable(),
});
export type ContactMessage = z.infer<typeof contactMessageSchema>;

export const listContactMessagesQuerySchema = paginationQuerySchema.extend({
  status: z.enum(CONTACT_MESSAGE_STATUSES).optional(),
});
export type ListContactMessagesQuery = z.infer<typeof listContactMessagesQuerySchema>;

export const updateContactMessageSchema = z.object({
  status: z.enum(CONTACT_MESSAGE_STATUSES),
});
export type UpdateContactMessageInput = z.infer<typeof updateContactMessageSchema>;
