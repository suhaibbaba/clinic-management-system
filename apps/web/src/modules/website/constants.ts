import type { SiteIcon, SiteSection, SiteSocial } from "@clinic/shared";
import type { IconName } from "@clinic/ui";

export const WEBSITE_TAB_CONTENT = "content";
export const WEBSITE_TAB_MESSAGES = "messages";

export const PREVIEW_DEVICE_PARAM = "device";
export const PREVIEW_DEVICE_DESKTOP = "desktop";
export const PREVIEW_DEVICE_MOBILE = "mobile";

export const PREVIEW_PAGE_PARAM = "page";

export const PREVIEW_PAGES = [
  { value: "home", path: "", label: "website.preview.pages.home" },
  { value: "services", path: "/services", label: "website.preview.pages.services" },
  { value: "doctors", path: "/doctors", label: "website.preview.pages.doctors" },
  { value: "about", path: "/about", label: "website.preview.pages.about" },
  { value: "contact", path: "/contact", label: "website.preview.pages.contact" },
  { value: "booking", path: "/appointment", label: "website.preview.pages.booking" },
  { value: "account", path: "/account", label: "website.preview.pages.account" },
] as const;

export const MESSAGES_STATUS_PARAM = "status";

export const SITE_PREVIEW_SRC = "/site/preview";

export const SITE_IMAGE_MIN_WIDTH = {
  HERO: 1200,
  WIDE: 900,
  CARD: 600,
  ICON: 240,
} as const;

export const SITE_SECTION_LABELS: Record<SiteSection, string> = {
  services: "website.sections.services",
  doctors: "website.sections.doctors",
  about: "website.sections.about",
  booking: "website.sections.booking",
  contact: "website.sections.contact",
  portal: "website.sections.portal",
};

export const SITE_SOCIAL_LABELS: Record<SiteSocial, string> = {
  instagram: "website.social.instagram",
  facebook: "website.social.facebook",
  whatsapp: "website.social.whatsapp",
  youtube: "website.social.youtube",
};

export const SITE_ICON_GLYPHS: Record<SiteIcon, IconName> = {
  users: "users",
  sparkles: "sparkles",
  shield: "shield",
  heart: "heart",
  gem: "gem",
  smile: "smile",
  star: "star",
  award: "award",
  stethoscope: "stethoscope",
  clock: "clock",
  building: "building",
  calendar: "calendar",
  eye: "eye",
  send: "send",
  monitor: "monitor",
  armchair: "armchair",
  target: "target",
  tooth: "tooth",
};
