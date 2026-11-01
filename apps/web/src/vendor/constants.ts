export const VENDOR_BASE = "/vendor";

export const VENDOR_API = `${import.meta.env.VITE_API_BASE_URL ?? "/api"}/vendor`;

export const VENDOR_LANGUAGE_KEY = "clinic-vendor-language";

export const VENDOR_PAGE_SIZE = 25;

export const VENDOR_PARAM = {
  SEARCH: "q",
  STATUS: "status",
  PAGE: "page",
  PLAN: "plan",
  NEW: "new",
  TAB: "tab",
} as const;

export const VENDOR_CLINIC_TABS = ["subscription", "domain", "specialties", "history"] as const;

export const VENDOR_QUERY_KEY = {
  SESSION: ["vendor", "session"],
  OVERVIEW: ["vendor", "overview"],
  CLINICS: ["vendor", "clinics"],
  CLINIC: ["vendor", "clinic"],
  PLANS: ["vendor", "plans"],
} as const;

export const VENDOR_NEW_PLAN = "new";

export const VENDOR_DEFAULT_GRACE_DAYS = 14;

export const VENDOR_TRIAL_DAYS = 30;
