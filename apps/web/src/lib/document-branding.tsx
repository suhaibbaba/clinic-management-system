import { useEffect } from "react";
import { useClinicBranding } from "@web/queries/clinic";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

const PRODUCT_MARK = { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" } as const;

const CLINIC_MARKS = [
  { rel: "icon", type: "image/x-icon", name: "favicon.ico" },
  { rel: "apple-touch-icon", type: "image/png", name: "apple-touch-icon.png" },
] as const;

const MANAGED = "data-clinic-icon";

const APPLE_TITLE = "apple-mobile-web-app-title";

export function applyDocumentIcon(iconsAt: string | null): void {
  for (const link of document.head.querySelectorAll(`link[${MANAGED}]`)) {
    link.remove();
  }

  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');

  if (existing && !existing.hasAttribute(MANAGED)) {
    existing.remove();
  }

  if (iconsAt === null) {
    document.head.append(managedLink(PRODUCT_MARK.rel, PRODUCT_MARK.type, PRODUCT_MARK.href));
    return;
  }

  const version = encodeURIComponent(iconsAt);

  for (const mark of CLINIC_MARKS) {
    document.head.append(
      managedLink(mark.rel, mark.type, `${API_BASE_URL}/clinic/icon/${mark.name}?v=${version}`),
    );
  }
}

export function applyAppTitle(appName: string): void {
  const existing = document.head.querySelector(`meta[name="${APPLE_TITLE}"]`);

  if (appName === "") {
    existing?.remove();
    return;
  }

  const meta = existing ?? document.head.appendChild(document.createElement("meta"));

  meta.setAttribute("name", APPLE_TITLE);
  meta.setAttribute("content", appName);
}

function managedLink(rel: string, type: string, href: string): HTMLLinkElement {
  const link = document.createElement("link");

  link.setAttribute(MANAGED, "");
  link.rel = rel;
  link.type = type;
  link.href = href;

  return link;
}

export function DocumentBranding(): null {
  const { data } = useClinicBranding();
  const iconsAt = data?.iconsAt ?? null;
  const appName = data?.appName ?? "";

  useEffect(() => {
    applyDocumentIcon(iconsAt);
  }, [iconsAt]);

  useEffect(() => {
    applyAppTitle(appName);
  }, [appName]);

  return null;
}
