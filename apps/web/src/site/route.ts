export type SiteSource =
  | { readonly kind: "slug"; readonly slug: string }
  | { readonly kind: "host" }
  | { readonly kind: "preview" };

export type SitePageRoute =
  | { readonly kind: "home" }
  | { readonly kind: "services" }
  | { readonly kind: "doctors" }
  | { readonly kind: "doctor"; readonly id: string }
  | { readonly kind: "about" }
  | { readonly kind: "contact" }
  | { readonly kind: "booking" }
  | { readonly kind: "account" }
  | { readonly kind: "notFound" };

export const SITE_PATH = {
  SERVICES: "/services",
  DOCTORS: "/doctors",
  ABOUT: "/about",
  CONTACT: "/contact",
  BOOKING: "/appointment",
  ACCOUNT: "/account",
} as const;

export const SITE_PREVIEW_BASE = "/site/preview";

const SLUG_BASE = /^\/site\/([a-z0-9-]+)(?=\/|$)/;

export function siteSource(pathname: string): { source: SiteSource; base: string } {
  if (pathname === SITE_PREVIEW_BASE || pathname.startsWith(`${SITE_PREVIEW_BASE}/`)) {
    return { source: { kind: "preview" }, base: SITE_PREVIEW_BASE };
  }

  const match = SLUG_BASE.exec(pathname);

  return match?.[1]
    ? { source: { kind: "slug", slug: match[1] }, base: match[0] }
    : { source: { kind: "host" }, base: "" };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function sitePage(pathname: string, base: string): SitePageRoute {
  const rest = pathname.slice(base.length).replace(/\/+$/, "");
  const [first, second, ...extra] = rest.split("/").filter(Boolean);

  if (first === undefined) {
    return { kind: "home" };
  }

  if (extra.length > 0) {
    return { kind: "notFound" };
  }

  if (`/${first}` === SITE_PATH.DOCTORS && second !== undefined) {
    return UUID.test(second) ? { kind: "doctor", id: second } : { kind: "notFound" };
  }

  if (second !== undefined) {
    return { kind: "notFound" };
  }

  switch (`/${first}`) {
    case SITE_PATH.SERVICES:
      return { kind: "services" };
    case SITE_PATH.DOCTORS:
      return { kind: "doctors" };
    case SITE_PATH.ABOUT:
      return { kind: "about" };
    case SITE_PATH.CONTACT:
      return { kind: "contact" };
    case SITE_PATH.BOOKING:
      return { kind: "booking" };
    case SITE_PATH.ACCOUNT:
      return { kind: "account" };
    default:
      return { kind: "notFound" };
  }
}
