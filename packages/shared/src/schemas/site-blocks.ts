import { z } from "zod";
import { CHART_TYPES } from "@shared/enums";
import { localizedTextSchema } from "@shared/locale/localized-text";
import { clinicLocaleSchema } from "@shared/locale/profile";
import { dayScheduleSchema, uuidSchema } from "@shared/schemas/common";
import { personNameSchema } from "@shared/schemas/person-name";
import {
  defaultSiteContent,
  siteContentSchema,
  siteFeatureSchema,
  siteImageKeySchema,
  SITE_SECTION,
  type SiteContent,
  type SiteSection,
} from "@shared/schemas/website";

type ContentShape = typeof siteContentSchema.shape;
type AboutShape = ContentShape["about"]["shape"];

const text = siteContentSchema.shape.hero.shape.title;
const optionalText = siteContentSchema.shape.story.shape.eyebrow;
const image = siteImageKeySchema.nullable();
const about: AboutShape = siteContentSchema.shape.about.shape;

export const SITE_PAGE_KIND = {
  HOME: "home",
  SERVICES: "services",
  DOCTORS: "doctors",
  ABOUT: "about",
  CONTACT: "contact",
  BOOKING: "booking",
} as const;
export const SITE_PAGE_KINDS = Object.values(SITE_PAGE_KIND);
export type SitePageKind = (typeof SITE_PAGE_KIND)[keyof typeof SITE_PAGE_KIND];

export const SITE_BLOCK_TYPE = {
  HERO: "hero",
  SERVICES_TEASER: "servicesTeaser",
  ABOUT_TEASER: "aboutTeaser",
  CASES: "cases",
  DOCTORS_TEASER: "doctorsTeaser",
  TESTIMONIALS: "testimonials",
  PAGE_HERO: "pageHero",
  SERVICES_GRID: "servicesGrid",
  DOCTORS_GRID: "doctorsGrid",
  ABOUT_PILLARS: "aboutPillars",
  ABOUT_VALUES: "aboutValues",
  GALLERY: "gallery",
  CONTACT_MAIN: "contactMain",
  CONTACT_WELCOME: "contactWelcome",
  BOOKING: "booking",
} as const;
export type SiteBlockType = (typeof SITE_BLOCK_TYPE)[keyof typeof SITE_BLOCK_TYPE];

export const siteBlockIdSchema = z.string().regex(/^[a-z0-9-]{1,40}$/);

const block = <TType extends SiteBlockType, TShape extends z.ZodRawShape>(
  type: TType,
  shape: TShape,
) => z.object({ id: siteBlockIdSchema, type: z.literal(type), ...shape });

export const heroBlockSchema = block(SITE_BLOCK_TYPE.HERO, {
  eyebrow: optionalText,
  title: text,
  subtitle: text,
  images: siteContentSchema.shape.hero.shape.images,
  stat: siteContentSchema.shape.hero.shape.stat,
  highlights: siteContentSchema.shape.highlights,
});

export const servicesTeaserBlockSchema = block(SITE_BLOCK_TYPE.SERVICES_TEASER, {
  title: text,
  subtitle: text,
});

export const aboutTeaserBlockSchema = block(SITE_BLOCK_TYPE.ABOUT_TEASER, {
  eyebrow: text,
  title: text,
  body: text,
  badge: optionalText,
  image,
  storyImage: image,
  stats: about.stats,
  statsImage: about.statsImage,
});

export const casesBlockSchema = block(SITE_BLOCK_TYPE.CASES, {
  title: optionalText,
  subtitle: optionalText,
  items: siteContentSchema.shape.cases.unwrap().shape.items,
});

export const doctorsTeaserBlockSchema = block(SITE_BLOCK_TYPE.DOCTORS_TEASER, {
  title: text,
  subtitle: text,
});

export const testimonialsBlockSchema = block(SITE_BLOCK_TYPE.TESTIMONIALS, {
  title: optionalText,
  subtitle: optionalText,
  items: siteContentSchema.shape.testimonials.unwrap().shape.items,
});

export const pageHeroBlockSchema = block(SITE_BLOCK_TYPE.PAGE_HERO, {
  eyebrow: optionalText,
  title: text,
  subtitle: text,
  intro: optionalText,
  image: image.default(null),
  tagline: z.boolean().default(false),
  features: z.array(siteFeatureSchema).max(4).default([]),
});

export const servicesGridBlockSchema = block(SITE_BLOCK_TYPE.SERVICES_GRID, {});

export const doctorsGridBlockSchema = block(SITE_BLOCK_TYPE.DOCTORS_GRID, {});

export const aboutPillarsBlockSchema = block(SITE_BLOCK_TYPE.ABOUT_PILLARS, {
  note: optionalText,
  pillars: about.pillars,
  quote: about.quote,
});

export const aboutValuesBlockSchema = block(SITE_BLOCK_TYPE.ABOUT_VALUES, {
  title: optionalText,
  values: about.values,
  image: image.default(null),
  badge: optionalText,
});

export const galleryBlockSchema = block(SITE_BLOCK_TYPE.GALLERY, {
  eyebrow: optionalText,
  title: optionalText,
  body: optionalText,
  images: siteContentSchema.shape.gallery.unwrap().shape.images,
});

export const contactMainBlockSchema = block(SITE_BLOCK_TYPE.CONTACT_MAIN, {
  note: optionalText,
  formEnabled: z.boolean(),
  topics: siteContentSchema.shape.contact.shape.topics,
});

export const contactWelcomeBlockSchema = block(SITE_BLOCK_TYPE.CONTACT_WELCOME, {
  title: text,
  body: optionalText,
  image: image.default(null),
});

export const bookingBlockSchema = block(SITE_BLOCK_TYPE.BOOKING, {
  title: text,
  subtitle: text,
  image,
});

export const siteBlockSchema = z.discriminatedUnion("type", [
  heroBlockSchema,
  servicesTeaserBlockSchema,
  aboutTeaserBlockSchema,
  casesBlockSchema,
  doctorsTeaserBlockSchema,
  testimonialsBlockSchema,
  pageHeroBlockSchema,
  servicesGridBlockSchema,
  doctorsGridBlockSchema,
  aboutPillarsBlockSchema,
  aboutValuesBlockSchema,
  galleryBlockSchema,
  contactMainBlockSchema,
  contactWelcomeBlockSchema,
  bookingBlockSchema,
]);
export type SiteBlock = z.infer<typeof siteBlockSchema>;
export type SiteBlockOf<TType extends SiteBlockType> = Extract<SiteBlock, { type: TType }>;

export const sitePageSchema = z.object({
  kind: z.enum(SITE_PAGE_KINDS),
  enabled: z.boolean(),
  blocks: z.array(siteBlockSchema).max(40),
});
export type SitePage = z.infer<typeof sitePageSchema>;

const unique = <T>(values: readonly T[]): boolean => new Set(values).size === values.length;

export const siteDocumentSchema = z.object({
  brand: siteContentSchema.shape.brand,
  bookingBand: about.cta,
  portal: z.boolean(),
  collections: z.object({
    services: z.object({
      items: siteContentSchema.shape.services.shape.items,
      promo: siteContentSchema.shape.services.shape.promo,
    }),
    doctors: z.object({
      hidden: siteContentSchema.shape.doctors.shape.hidden,
      profiles: siteContentSchema.shape.doctors.shape.profiles,
      promo: siteContentSchema.shape.doctors.shape.promo,
    }),
  }),
  pages: z
    .array(sitePageSchema)
    .refine((pages) => unique(pages.map((page) => page.kind)), "Each page may appear once"),
});
export type SiteDocument = z.infer<typeof siteDocumentSchema>;

const SECTION_PAGE: Readonly<Record<Exclude<SiteSection, "portal">, SitePageKind>> = {
  [SITE_SECTION.SERVICES]: SITE_PAGE_KIND.SERVICES,
  [SITE_SECTION.DOCTORS]: SITE_PAGE_KIND.DOCTORS,
  [SITE_SECTION.ABOUT]: SITE_PAGE_KIND.ABOUT,
  [SITE_SECTION.BOOKING]: SITE_PAGE_KIND.BOOKING,
  [SITE_SECTION.CONTACT]: SITE_PAGE_KIND.CONTACT,
};

export const sitePageFor = (section: Exclude<SiteSection, "portal">): SitePageKind =>
  SECTION_PAGE[section];

export function contentToDocument(content: SiteContent): SiteDocument {
  const on = (section: Exclude<SiteSection, "portal">): boolean =>
    content.sections.includes(section);
  const { hero, story, services, doctors, about: copy, gallery, cases, testimonials } = content;
  const { booking, contact } = content;

  return {
    brand: content.brand,
    bookingBand: copy.cta,
    portal: content.sections.includes(SITE_SECTION.PORTAL),
    collections: {
      services: { items: services.items, promo: services.promo },
      doctors: { hidden: doctors.hidden, profiles: doctors.profiles, promo: doctors.promo },
    },
    pages: [
      {
        kind: SITE_PAGE_KIND.HOME,
        enabled: true,
        blocks: [
          {
            id: "hero",
            type: SITE_BLOCK_TYPE.HERO,
            eyebrow: story.eyebrow,
            title: hero.title,
            subtitle: hero.subtitle,
            images: hero.images,
            stat: hero.stat,
            highlights: content.highlights,
          },
          {
            id: "services-teaser",
            type: SITE_BLOCK_TYPE.SERVICES_TEASER,
            title: services.title,
            subtitle: services.subtitle,
          },
          {
            id: "about-teaser",
            type: SITE_BLOCK_TYPE.ABOUT_TEASER,
            eyebrow: copy.title,
            title: story.title,
            body: copy.body,
            badge: story.badge,
            image: copy.image,
            storyImage: story.image,
            stats: copy.stats,
            statsImage: copy.statsImage,
          },
          {
            id: "cases",
            type: SITE_BLOCK_TYPE.CASES,
            title: cases.title,
            subtitle: cases.subtitle,
            items: cases.items,
          },
          {
            id: "doctors-teaser",
            type: SITE_BLOCK_TYPE.DOCTORS_TEASER,
            title: doctors.title,
            subtitle: doctors.subtitle,
          },
          {
            id: "testimonials",
            type: SITE_BLOCK_TYPE.TESTIMONIALS,
            title: testimonials.title,
            subtitle: testimonials.subtitle,
            items: testimonials.items,
          },
        ],
      },
      {
        kind: SITE_PAGE_KIND.SERVICES,
        enabled: on(SITE_SECTION.SERVICES),
        blocks: [
          {
            id: "page-hero",
            type: SITE_BLOCK_TYPE.PAGE_HERO,
            eyebrow: {},
            title: services.title,
            subtitle: services.subtitle,
            intro: services.intro,
            image: services.image,
            tagline: false,
            features: [],
          },
          { id: "services-grid", type: SITE_BLOCK_TYPE.SERVICES_GRID },
        ],
      },
      {
        kind: SITE_PAGE_KIND.DOCTORS,
        enabled: on(SITE_SECTION.DOCTORS),
        blocks: [
          {
            id: "page-hero",
            type: SITE_BLOCK_TYPE.PAGE_HERO,
            eyebrow: {},
            title: doctors.title,
            subtitle: doctors.subtitle,
            intro: {},
            image: doctors.image,
            tagline: false,
            features: doctors.features,
          },
          { id: "doctors-grid", type: SITE_BLOCK_TYPE.DOCTORS_GRID },
        ],
      },
      {
        kind: SITE_PAGE_KIND.ABOUT,
        enabled: on(SITE_SECTION.ABOUT),
        blocks: [
          {
            id: "page-hero",
            type: SITE_BLOCK_TYPE.PAGE_HERO,
            eyebrow: copy.eyebrow,
            title: copy.title,
            subtitle: copy.subtitle,
            intro: copy.body,
            image: copy.image,
            tagline: true,
            features: [],
          },
          {
            id: "about-pillars",
            type: SITE_BLOCK_TYPE.ABOUT_PILLARS,
            note: copy.note,
            pillars: copy.pillars,
            quote: copy.quote,
          },
          {
            id: "about-values",
            type: SITE_BLOCK_TYPE.ABOUT_VALUES,
            title: copy.whyTitle,
            values: copy.values,
            image: copy.whyImage,
            badge: copy.whyBadge,
          },
          {
            id: "gallery",
            type: SITE_BLOCK_TYPE.GALLERY,
            eyebrow: gallery.eyebrow,
            title: gallery.title,
            body: gallery.body,
            images: gallery.images,
          },
        ],
      },
      {
        kind: SITE_PAGE_KIND.CONTACT,
        enabled: on(SITE_SECTION.CONTACT),
        blocks: [
          {
            id: "page-hero",
            type: SITE_BLOCK_TYPE.PAGE_HERO,
            eyebrow: {},
            title: contact.title,
            subtitle: contact.subtitle,
            intro: contact.intro,
            image: contact.image,
            tagline: false,
            features: [],
          },
          {
            id: "contact-main",
            type: SITE_BLOCK_TYPE.CONTACT_MAIN,
            note: contact.note,
            formEnabled: contact.formEnabled,
            topics: contact.topics,
          },
          {
            id: "contact-welcome",
            type: SITE_BLOCK_TYPE.CONTACT_WELCOME,
            title: contact.welcome,
            body: contact.welcomeBody,
            image: contact.welcomeImage,
          },
        ],
      },
      {
        kind: SITE_PAGE_KIND.BOOKING,
        enabled: on(SITE_SECTION.BOOKING),
        blocks: [
          {
            id: "booking",
            type: SITE_BLOCK_TYPE.BOOKING,
            title: booking.title,
            subtitle: booking.subtitle,
            image: booking.image,
          },
        ],
      },
    ],
  };
}

export const siteDocumentPage = (
  document: SiteDocument,
  kind: SitePageKind,
): SitePage | undefined => document.pages.find((page) => page.kind === kind);

export const sitePageEnabled = (document: SiteDocument, kind: SitePageKind): boolean =>
  siteDocumentPage(document, kind)?.enabled === true;

export function siteBlock<TType extends SiteBlockType>(
  document: SiteDocument,
  type: TType,
): SiteBlockOf<TType> | undefined {
  for (const page of document.pages) {
    const found = page.blocks.find(
      (candidate): candidate is SiteBlockOf<TType> => candidate.type === type,
    );

    if (found) {
      return found;
    }
  }

  return undefined;
}

const blockImages = (item: SiteBlock): (string | null)[] => {
  switch (item.type) {
    case SITE_BLOCK_TYPE.HERO:
    case SITE_BLOCK_TYPE.GALLERY:
      return item.images;
    case SITE_BLOCK_TYPE.ABOUT_TEASER:
      return [item.image, item.storyImage, item.statsImage];
    case SITE_BLOCK_TYPE.CASES:
      return item.items.flatMap((entry) => [entry.before, entry.after]);
    case SITE_BLOCK_TYPE.PAGE_HERO:
    case SITE_BLOCK_TYPE.ABOUT_VALUES:
    case SITE_BLOCK_TYPE.CONTACT_WELCOME:
    case SITE_BLOCK_TYPE.BOOKING:
      return [item.image];
    case SITE_BLOCK_TYPE.ABOUT_PILLARS:
      return [item.quote.image];
    default:
      return [];
  }
};

export function siteDocumentImageKeys(document: SiteDocument): string[] {
  const { services, doctors } = document.collections;
  const keys = [
    document.bookingBand.image,
    services.promo.image,
    doctors.promo.image,
    ...services.items.map((item) => item.image),
    ...document.pages.flatMap((page) => page.blocks.flatMap(blockImages)),
  ];

  return [...new Set(keys.filter((key): key is string => key !== null))];
}

const isDocumentShaped = (raw: unknown): boolean =>
  typeof raw === "object" && raw !== null && "pages" in raw && Array.isArray(raw.pages);

export const defaultSiteDocument = (): SiteDocument => contentToDocument(defaultSiteContent());

export function readSiteDocument(raw: unknown): SiteDocument {
  if (isDocumentShaped(raw)) {
    const parsed = siteDocumentSchema.safeParse(raw);

    return parsed.success ? parsed.data : defaultSiteDocument();
  }

  const parsed = siteContentSchema.safeParse(raw);

  return parsed.success ? contentToDocument(parsed.data) : defaultSiteDocument();
}

export const publicSiteDoctorSchema = z.object({
  id: uuidSchema,
  name: personNameSchema,
  specialty: localizedTextSchema,
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
  address: localizedTextSchema.nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  workingHours: z.array(dayScheduleSchema),
  bookingEnabled: z.boolean(),
  chartTypes: z.array(z.enum(CHART_TYPES)),
  locale: clinicLocaleSchema,
});
export type PublicSiteClinic = z.infer<typeof publicSiteClinicSchema>;

export const publicSiteSchema = z.object({
  clinic: publicSiteClinicSchema,
  doctors: z.array(publicSiteDoctorSchema),
  document: siteDocumentSchema,
  images: z.record(z.string(), z.url()),
});
export type PublicSite = z.infer<typeof publicSiteSchema>;

export const websiteEditorSchema = z.object({
  site: publicSiteSchema,
  publishedAt: z.iso.datetime().nullable(),
  unpublished: z.boolean(),
});
export type WebsiteEditor = z.infer<typeof websiteEditorSchema>;
