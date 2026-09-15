import { useEffect } from 'react';

import { useClinicBranding } from '@web/features/clinic/queries';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

/** What `index.html` declares, and what the tab falls back to when a clinic has no logo. */
const PRODUCT_MARK = { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' } as const;

const CLINIC_MARKS = [
  { rel: 'icon', type: 'image/x-icon', href: `${API_BASE_URL}/clinic/icon/favicon.ico` },
  {
    rel: 'apple-touch-icon',
    type: 'image/png',
    href: `${API_BASE_URL}/clinic/icon/apple-touch-icon.png`,
  },
] as const;

const MANAGED = 'data-clinic-icon';

/**
 * Points the tab at the clinic's own mark, or back at the product's when it has none. The
 * endpoint is public and redirects to a window-stable signed URL, so the browser caches it.
 */
export function applyDocumentIcon(hasIcons: boolean): void {
  for (const link of document.head.querySelectorAll(`link[${MANAGED}]`)) {
    link.remove();
  }

  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');

  if (existing && !existing.hasAttribute(MANAGED)) {
    existing.remove();
  }

  for (const mark of hasIcons ? CLINIC_MARKS : [PRODUCT_MARK]) {
    const link = document.createElement('link');

    link.setAttribute(MANAGED, '');
    link.rel = mark.rel;
    link.type = mark.type;
    link.href = mark.href;

    document.head.append(link);
  }
}

/**
 * Renders nothing. Branding is public, cached for the session and shared with the sign-in screen,
 * so asking for it here costs one request whether or not anybody is signed in.
 */
export function DocumentIcon(): null {
  const { data } = useClinicBranding();
  const hasIcons = data?.hasIcons ?? false;

  useEffect(() => {
    applyDocumentIcon(hasIcons);
  }, [hasIcons]);

  return null;
}
