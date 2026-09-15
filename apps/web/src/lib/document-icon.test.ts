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

  it('points the tab at the clinic’s own mark once it has one', () => {
    applyDocumentIcon(true);

    expect(hrefs('icon')).toEqual(['/api/clinic/icon/favicon.ico']);
    expect(hrefs('apple-touch-icon')).toEqual(['/api/clinic/icon/apple-touch-icon.png']);
  });

  // A clinic that has uploaded no logo, and one whose logo predates the icons, both land here.
  it('leaves the product mark alone when there is no clinic set', () => {
    applyDocumentIcon(false);

    expect(hrefs('icon')).toEqual(['/favicon.svg']);
    expect(hrefs('apple-touch-icon')).toEqual([]);
  });

  // Branding resolves after the first paint, so this runs twice on an ordinary load.
  it('replaces rather than accumulates when it runs again', () => {
    applyDocumentIcon(true);
    applyDocumentIcon(true);
    applyDocumentIcon(false);
    applyDocumentIcon(true);

    expect(hrefs('icon')).toEqual(['/api/clinic/icon/favicon.ico']);
    expect(hrefs('apple-touch-icon')).toHaveLength(1);
  });
});
