import type { SiteIcon, SitePageKind, SiteSocial } from "@clinic/shared";
import type { IconName } from "@clinic/ui";

export const WEBSITE_TAB_CONTENT = "content";
export const WEBSITE_TAB_MESSAGES = "messages";

export const PREVIEW_DEVICE_PARAM = "device";
export const PREVIEW_DEVICE_DESKTOP = "desktop";
export const PREVIEW_DEVICE_MOBILE = "mobile";

export const EDITOR_PAGE_PARAM = "page";
export const EDITOR_EDIT_PARAM = "edit";
export const EDITOR_SETTINGS_PARAM = "settings";
export const EDITOR_SETTINGS_OPEN = "1";
export const EDITOR_LANGUAGE_PARAM = "lang";
export const EDITOR_PARAMS = [
  EDITOR_PAGE_PARAM,
  EDITOR_EDIT_PARAM,
  EDITOR_SETTINGS_PARAM,
  EDITOR_LANGUAGE_PARAM,
  PREVIEW_DEVICE_PARAM,
] as const;

export const SITE_LANGUAGE_QUERY = "lang";

export const SITE_PAGE_PATHS: Record<SitePageKind, string> = {
  home: "",
  services: "/services",
  doctors: "/doctors",
  about: "/about",
  contact: "/contact",
  booking: "/appointment",
};

export const SERVICES_COLLECTION_PATH = "collections.services";
export const DOCTORS_COLLECTION_PATH = "collections.doctors";

export const MESSAGES_STATUS_PARAM = "status";

export const SITE_PREVIEW_SRC = "/site/preview";

export const SITE_IMAGE_MIN_WIDTH = {
  HERO: 1200,
  WIDE: 900,
  CARD: 600,
  ICON: 240,
} as const;

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
  bone: "bone",
};
