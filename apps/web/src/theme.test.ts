import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The single-source-of-truth rule, enforced.
 *
 * theme.css is the only place a colour is named. These tests fail the build if
 * a component reaches past it — for a stock Tailwind palette class, a raw hex,
 * or an inline colour — because that is exactly the kind of change that passes
 * review one utility at a time and leaves the brand in forty files.
 */

const SRC = join(__dirname);

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);

    if (statSync(path).isDirectory()) {
      sourceFiles(path, acc);
    } else if (/\.tsx?$/.test(entry) && !/\.(test|stories)\.tsx?$/.test(entry)) {
      acc.push(path);
    }
  }

  return acc;
}

const FILES = sourceFiles(SRC).map((path) => ({
  path: path.slice(SRC.length + 1),
  source: readFileSync(path, 'utf8'),
}));

describe('design tokens', () => {
  it('has files to check', () => {
    expect(FILES.length).toBeGreaterThan(30);
  });

  it('uses no stock Tailwind palette class', () => {
    // `neutral-*` is ours; the stock families and bare colour words are not.
    const stock =
      /\b(?:[a-z-]+:)?(?:text|bg|border|ring|divide|placeholder|fill|stroke|outline|from|via|to)-(?:gray|slate|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|brand|white|black)(?:-\d{2,3})?\b/;

    const offenders = FILES.filter((file) => stock.test(file.source)).map((file) => file.path);

    expect(offenders).toEqual([]);
  });

  it('names no colour by hex, rgb() or hsl()', () => {
    const literal = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b|\brgba?\(|\bhsla?\(/;

    const offenders = FILES.filter((file) => literal.test(file.source)).map((file) => file.path);

    expect(offenders).toEqual([]);
  });

  it('sets no colour through an inline style', () => {
    // Dynamic layout in a `style` prop is fine; colour in one is not, because a
    // colour there cannot be themed and never shows up in a token audit.
    const inlineColour = /style=\{\{[^}]*\b(?:color|backgroundColor|borderColor|fill|stroke)\b/s;

    const offenders = FILES.filter((file) => inlineColour.test(file.source))
      .map((file) => file.path)
      // The legend swatch paints itself from the tooth-state token map, which
      // is the single source — the value is per-state, so it cannot be a class.
      .filter((path) => path !== join('features', 'patients', 'chart', 'tooth-legend.tsx'));

    expect(offenders).toEqual([]);
  });
});
