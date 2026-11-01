import {
  CONTACT_MESSAGE_STATUS,
  languageDefinition,
  localized,
  localizedValues,
  type ContactMessage,
  type LocalizedText,
  type PublicSite,
  type SiteContent,
} from "@clinic/shared";
import { type contactMessages, type siteContent } from "@api/database/schema";
import { SITE_DESCRIPTION_MAX } from "@api/modules/website/constants";

export type SiteContentRow = typeof siteContent.$inferSelect;

export type ContactMessageRow = typeof contactMessages.$inferSelect;

export type HandlerRow = { name: LocalizedText } | null;

export function toContactMessage(row: ContactMessageRow, handler: HandlerRow): ContactMessage {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    topic: row.topic,
    message: row.message,
    status: row.handledAt ? CONTACT_MESSAGE_STATUS.HANDLED : CONTACT_MESSAGE_STATUS.OPEN,
    createdAt: row.createdAt.toISOString(),
    handledAt: row.handledAt?.toISOString() ?? null,
    handledBy: handler ? handler.name : null,
  };
}

export const sameContent = (a: SiteContent | null, b: SiteContent | null): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export function siteHost(raw: string | undefined): string {
  return (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/^www\./, "");
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const clip = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;

export type SiteIconLinks = { favicon: string; appleTouchIcon: string };

export function siteHead(site: PublicSite, icons: SiteIconLinks | null): string {
  const { clinic, content } = site;
  const language = clinic.locale.primaryLanguage;
  const text = (value: LocalizedText): string =>
    localized(value, language, clinic.locale.languages);

  const name = text(clinic.name);
  const title = text(content.hero.title) || name;
  const description = clip(
    text(content.hero.subtitle) || text(content.about.body) || clinic.address || name,
    SITE_DESCRIPTION_MAX,
  );

  const [alternateName] = localizedValues(clinic.name).filter((value) => value !== name);
  const firstImage = content.hero.images[0];
  const image = (firstImage && site.images[firstImage]) ?? clinic.logoUrl;

  const structured = {
    "@context": "https://schema.org",
    "@type": "MedicalClinic",
    name,
    ...(alternateName && { alternateName }),
    ...(clinic.phone && { telephone: clinic.phone }),
    ...(clinic.email && { email: clinic.email }),
    ...(clinic.address && { address: clinic.address }),
    ...(clinic.latitude !== null &&
      clinic.longitude !== null && {
        geo: { "@type": "GeoCoordinates", latitude: clinic.latitude, longitude: clinic.longitude },
      }),
    ...(image && { image }),
  };

  const page = `${title === name ? title : `${title} — ${name}`}`;

  return [
    `<title>${escapeHtml(page)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="${languageDefinition(language).intlLocale.replace("-", "_")}" />`,
    `<meta property="og:site_name" content="${escapeHtml(name)}" />`,
    `<meta property="og:title" content="${escapeHtml(page)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    ...(image ? [`<meta property="og:image" content="${escapeHtml(image)}" />`] : []),
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
    ...(icons
      ? [
          `<link rel="icon" type="image/x-icon" href="${escapeHtml(icons.favicon)}" />`,
          `<link rel="apple-touch-icon" href="${escapeHtml(icons.appleTouchIcon)}" />`,
        ]
      : []),
    `<script type="application/ld+json">${JSON.stringify(structured).replaceAll("<", "\\u003c")}</script>`,
  ].join("\n    ");
}
