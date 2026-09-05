import { describe, expect, it } from 'vitest';

import { cn } from '@web/lib/cn';

/**
 * The class merger has to know this app's own type scale.
 *
 * `text-label`, `text-value` and `text-kpi` are font sizes declared in
 * theme.css. tailwind-merge cannot know that on its own — it reads them as
 * colours, and drops whichever colour class came first. The failure is silent
 * and invisible in review: the class list simply comes out short, and a button
 * ends up with its background colour as its text colour.
 */
describe('cn', () => {
  it('keeps a text colour and a text size together', () => {
    const result = cn('bg-neutral-900 text-ink-inverse', 'text-value');

    expect(result).toContain('text-ink-inverse');
    expect(result).toContain('text-value');
  });

  it.each(['label', 'value', 'kpi'])('treats text-%s as a size, not a colour', (size) => {
    expect(cn(`text-ink-muted text-${size}`)).toContain('text-ink-muted');
  });

  it('still lets one size win over another', () => {
    expect(cn('text-label', 'text-kpi')).toBe('text-kpi');
  });

  it('still resolves ordinary conflicts, so an override works', () => {
    expect(cn('w-full', 'w-64')).toBe('w-64');
    expect(cn('text-ink', 'text-ink-muted')).toBe('text-ink-muted');
  });
});
