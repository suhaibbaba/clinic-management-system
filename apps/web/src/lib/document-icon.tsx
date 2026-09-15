import { useEffect } from 'react';

import { useClinicBranding } from '@web/features/clinic/queries';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

/** What `index.html` declares, and what the tab falls back to when a clinic has no logo. */
const PRODUCT_MARK = { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' } as const;

const CLINIC_MARKS = [
  { rel: 'icon', type: 'image/x-icon', name: 'favicon.ico' },
  { rel: 'apple-touch-icon', type: 'image/png', name: 'apple-touch-icon.png' },
] as const;

const MANAGED = 'data-clinic-icon';

/**
 * Points the tab at the clinic's own mark, or back at the product's when it has none. The
 * endpoint is public and redirects to a window-stable signed URL, so the browser caches it.
 */
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

  // The generation time is in the address: a browser keeps a favicon long past any cache header,
  // and only reaches for a new one when the URL it was told about has moved.
  const version = encodeURIComponent(iconsAt);

  for (const mark of CLINIC_MARKS) {
    document.head.append(
      managedLink(mark.rel, mark.type, `${API_BASE_URL}/clinic/icon/${mark.name}?v=${version}`),
    );
  }
}

function managedLink(rel: string, type: string, href: string): HTMLLinkElement {
  const link = document.createElement('link');

  link.setAttribute(MANAGED, '');
  link.rel = rel;
  link.type = type;
  link.href = href;

  return link;
}

/**
 * Renders nothing. Branding is public, cached for the session and shared with the sign-in screen,
 * so asking for it here costs one request whether or not anybody is signed in.
 */
export function DocumentIcon(): null {
  const { data } = useClinicBranding();
  const iconsAt = data?.iconsAt ?? null;

  useEffect(() => {
    applyDocumentIcon(iconsAt);
  }, [iconsAt]);

  return null;
}
