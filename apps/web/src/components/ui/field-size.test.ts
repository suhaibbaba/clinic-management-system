import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// iOS Safari zooms in when a field under 16px takes focus and never zooms back. A floor is the kind
// of rule a later "tighter" change breaks silently, so it is read out of the source.
const UI = join(__dirname);

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

  // The root is not 16px — `base.css` sets the reference's 93.75% — so the literal `1rem` this
  // used to look for would now be 15px and silently under the floor. Both halves are read and
  // multiplied instead.
  it('resolves the token to 16px against the root the app sets', () => {
    const theme = readFileSync(join(UI, '..', '..', 'theme.css'), 'utf8');
    const base = readFileSync(join(UI, '..', '..', 'base.css'), 'utf8');

    const token = Number(/--text-field:\s*([\d.]+)rem/.exec(theme)?.[1]);
    const rootPercent = Number(/html\s*\{[^}]*font-size:\s*([\d.]+)%/.exec(base)?.[1]);

    expect(token).toBeGreaterThan(0);
    expect(rootPercent).toBeGreaterThan(0);
    expect(token * (rootPercent / 100) * 16).toBeGreaterThanOrEqual(16);
  });
});
