import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * No field may render below 16px.
 *
 * iOS Safari zooms the page in when a field smaller than that takes focus, and
 * it does not zoom back out — so a receptionist tapping a search box is left
 * looking at a magnified fragment of the page for the rest of the session.
 *
 * The rule is a size *floor*, which makes it the kind of thing a later "make
 * this look tighter" change breaks without anyone noticing: the fix is one
 * class, and nothing on screen says why it was there. Hence a test.
 *
 * It reads the source rather than a rendered page because jsdom has no layout
 * and would report every computed size as the same default. What it checks is
 * the invariant that actually matters: a focusable field carries `text-field`
 * (16px, defined in theme.css) and never a smaller size class.
 */
const UI = join(__dirname);

/** Every component that renders a focusable field element. */
const FIELDS = [
  'input.tsx',
  'select.tsx',
  'textarea.tsx',
  'search-field.tsx',
  'date-picker.tsx',
  'time-picker.tsx',
  'date-range-picker.tsx',
];

/** Sizes below 16px in this theme; `text-field` is the only allowed one. */
const SMALLER = /\btext-(label|value|xs|sm|base)\b/;

describe('field size', () => {
  it.each(FIELDS)('%s renders its field at text-field', (file) => {
    const source = readFileSync(join(UI, file), 'utf8');

    expect(source).toContain('text-field');
  });

  it.each(FIELDS)('%s puts no smaller size on the field element', (file) => {
    const source = readFileSync(join(UI, file), 'utf8');

    // Only the element's own class list matters: a 13px label or a 15px list
    // row beside the field is fine, it is the focusable control that zooms.
    const fieldClasses = [...source.matchAll(/text-field[^'"`]*/g)].join(' ');

    expect(fieldClasses).not.toMatch(SMALLER);
  });

  it('defines the token at 16px', () => {
    const theme = readFileSync(join(UI, '..', '..', 'theme.css'), 'utf8');

    expect(theme).toMatch(/--text-field:\s*1rem/);
  });
});
