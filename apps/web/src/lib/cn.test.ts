import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { cn, FONT_SIZE_KEYS, RADIUS_KEYS } from '@web/lib/cn';

const theme = readFileSync(join(__dirname, '..', 'theme.css'), 'utf8');

const tokensOf = (prefix: string): string[] =>
  [...theme.matchAll(new RegExp(`^\\s*--${prefix}-([a-z0-9-]+):`, 'gm'))]
    .map((match) => match[1] ?? '')
    .filter((name) => !name.endsWith('--line-height'));

// Every `--text-*` key is a font size tailwind-merge reads as a colour, dropping whichever class
// came first — silently, and invisibly in review.
describe('cn', () => {
  it('keeps a text colour and a text size together', () => {
    const result = cn('bg-neutral-900 text-ink-inverse', 'text-value');

    expect(result).toContain('text-ink-inverse');
    expect(result).toContain('text-value');
  });

  it.each(FONT_SIZE_KEYS)('treats text-%s as a size, not a colour', (size) => {
    expect(cn(`text-ink-muted text-${size}`)).toContain('text-ink-muted');
    expect(cn(`text-ink-muted text-${size}`)).toContain(`text-${size}`);
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

  // The registry is hand-written, so this is what stops theme.css growing a token it never learns
  // about: the failure is silent otherwise — the class is simply dropped.
  it.each([
    ['text', FONT_SIZE_KEYS],
    ['radius', RADIUS_KEYS],
  ])('registers every %s token theme.css names', (prefix, registered) => {
    expect([...registered].sort()).toEqual(tokensOf(prefix as string).sort());
  });
});
