import { describe, expect, it } from 'vitest';

import { cn } from '@web/lib/cn';

// `text-label`/`text-value`/`text-kpi` are font sizes tailwind-merge reads as colours, dropping
// whichever colour class came first — silently, and invisibly in review.
describe('cn', () => {
  it('keeps a text colour and a text size together', () => {
    const result = cn('bg-neutral-900 text-ink-inverse', 'text-value');

    expect(result).toContain('text-ink-inverse');
    expect(result).toContain('text-value');
  });

  it.each(['label', 'value', 'kpi'])('treats text-%s as a size, not a colour', (size) => {
    expect(cn(`text-ink-muted text-${size}`)).toContain('text-ink-muted');
  });

  // The same blindness one token over: `rounded-card` and `rounded-pill` are both "unknown", so a
  // component's own radius survived every override and a card came out as a pill.
  it('lets a caller override the radius a component sets', () => {
    expect(cn('skeleton rounded-pill', 'rounded-card')).toContain('rounded-card');
    expect(cn('skeleton rounded-pill', 'rounded-card')).not.toContain('rounded-pill');
  });

  it('still lets one size win over another', () => {
    expect(cn('text-label', 'text-kpi')).toBe('text-kpi');
  });

  it('still resolves ordinary conflicts, so an override works', () => {
    expect(cn('w-full', 'w-64')).toBe('w-64');
    expect(cn('text-ink', 'text-ink-muted')).toBe('text-ink-muted');
  });
});
