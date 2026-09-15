import { beforeEach, describe, expect, it } from 'vitest';

import { applyDocumentIcon } from '@web/lib/document-icon';

const hrefs = (rel: string): string[] =>
  [...document.head.querySelectorAll<HTMLLinkElement>(`link[rel="${rel}"]`)].map(
    (link) => link.getAttribute('href') ?? '',
  );

describe('applyDocumentIcon', () => {
  beforeEach(() => {
    document.head.innerHTML = '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />';
  });

  const AT = '2026-09-15T10:00:00.000Z';

  it('points the tab at the clinic’s own mark once it has one', () => {
    applyDocumentIcon(AT);

    expect(hrefs('icon')).toEqual([`/api/clinic/icon/favicon.ico?v=${encodeURIComponent(AT)}`]);
    expect(hrefs('apple-touch-icon')).toEqual([
      `/api/clinic/icon/apple-touch-icon.png?v=${encodeURIComponent(AT)}`,
    ]);
  });

  // A browser holds a favicon well past any cache header, so a re-render has to move the address.
  it('moves the address when the set is rendered again', () => {
    applyDocumentIcon(AT);
    const before = hrefs('icon');

    applyDocumentIcon('2026-09-16T08:30:00.000Z');

    expect(hrefs('icon')).not.toEqual(before);
    expect(hrefs('icon')[0]).toContain('2026-09-16');
  });

  // A clinic that has uploaded no logo, and one whose logo predates the icons, both land here.
  it('leaves the product mark alone when there is no clinic set', () => {
    applyDocumentIcon(null);

    expect(hrefs('icon')).toEqual(['/favicon.svg']);
    expect(hrefs('apple-touch-icon')).toEqual([]);
  });

  // Branding resolves after the first paint, so this runs twice on an ordinary load.
  it('replaces rather than accumulates when it runs again', () => {
    applyDocumentIcon(AT);
    applyDocumentIcon(AT);
    applyDocumentIcon(null);
    applyDocumentIcon(AT);

    expect(hrefs('icon')).toEqual([`/api/clinic/icon/favicon.ico?v=${encodeURIComponent(AT)}`]);
    expect(hrefs('apple-touch-icon')).toHaveLength(1);
  });
});
