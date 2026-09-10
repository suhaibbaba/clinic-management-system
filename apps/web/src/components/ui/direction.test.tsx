import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Modal } from '@web/components/ui/modal';
import { applyLanguageToDocument } from '@web/i18n/language';
import { renderWithProviders } from '@test/helpers/render';

// Portalled content does not inherit the app's direction. `Modal` used to pin `dir="rtl"`, which
// was invisible in Arabic and wrong the moment the app was English.
describe('portalled direction', () => {
  afterEach(() => {
    applyLanguageToDocument('ar');
  });

  it.each([
    ['ar', 'rtl'],
    ['en', 'ltr'],
  ])('lays a modal out the way the document is (%s)', (language, expected) => {
    applyLanguageToDocument(language);

    renderWithProviders(
      <Modal open onOpenChange={() => undefined} title="common.edit">
        <p>محتوى</p>
      </Modal>,
    );

    expect(screen.getByRole('dialog')).toHaveAttribute('dir', expected);
  });
});

// `dir="ltr"` is a legitimate island; a literal `dir="rtl"` pins a piece of the app to Arabic,
// which is only ever right on the print sheet.
describe('no component pins itself to Arabic', () => {
  const SRC = join(__dirname, '..', '..');

  /** The print sheet is a deliberately Arabic document, not a screen. */
  const ALLOWED = new Set(['plan-print.tsx']);

  function sources(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        return sources(path);
      }

      return entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx') ? [path] : [];
    });
  }

  /** Comments talk *about* the attribute; only the code counts. */
  const withoutComments = (source: string): string =>
    source.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/\/\/.*/g, '');

  it('never hardcodes dir="rtl"', () => {
    const offenders = sources(SRC).filter(
      (path) =>
        !ALLOWED.has(path.split('/').at(-1) ?? '') &&
        withoutComments(readFileSync(path, 'utf8')).includes('dir="rtl"'),
    );

    expect(offenders).toEqual([]);
  });
});

// Physical classes are right in English and wrong in Arabic, invisibly. Two exceptions: `left-1/2`
// centring, which a logical property would not mirror, and explicit `rtl:`/`ltr:` pairs.
describe('no physical direction in the styles', () => {
  const SRC = join(__dirname, '..', '..');

  /** Physical utilities, unprefixed — a `rtl:`/`ltr:` pair is allowed. */
  const PHYSICAL =
    /(?<![\w:-])(?:pl|pr|ml|mr)-[\w./[\]-]+|(?<![\w:-])text-(?:left|right)\b|(?<![\w:-])border-[lr](?:-[\w[\]-]+)?\b|(?<![\w:-])rounded-[lr](?:-[\w[\]-]+)?\b|(?<![\w:-])-?(?:left|right)-[\w./[\]-]+/g;

  // `-translate-x-1/2` is not mirrored, so `start-1/2` would push the dialog off centre in Arabic
  // rather than centring it.
  const ALLOWED = new Map<string, RegExp>([
    ['modal.tsx', /left-1\/2/],
    ['tooth-chart.tsx', /left-1\/2/],
  ]);

  function sources(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        return sources(path);
      }

      return entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx') ? [path] : [];
    });
  }

  const withoutComments = (source: string): string =>
    source.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/\/\/.*/g, '');

  it('uses logical properties everywhere', () => {
    const offenders = sources(SRC).flatMap((path) => {
      const file = path.split('/').at(-1) ?? '';
      const allowed = ALLOWED.get(file);
      const found = [...withoutComments(readFileSync(path, 'utf8')).matchAll(PHYSICAL)]
        .map((match) => match[0])
        .filter((utility) => !(allowed && allowed.test(utility)));

      return found.length > 0 ? [`${file}: ${[...new Set(found)].join(', ')}`] : [];
    });

    expect(offenders).toEqual([]);
  });
});
