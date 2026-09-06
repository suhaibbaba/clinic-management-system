import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Modal } from '@web/components/ui/modal';
import { applyLanguageToDocument } from '@web/i18n/language';
import { renderWithProviders } from '@test/helpers/render';

/**
 * Anything that portals to `document.body` has to *ask* which way the page is
 * laid out.
 *
 * A dialog, a drawer and a menu all render outside the React tree, so they do
 * not inherit the app's direction the way an ordinary child does. `Modal` used
 * to answer this by pinning `dir="rtl"`, which was invisible while the app was
 * Arabic and wrong the moment it was not: in English every form dialog came out
 * with its labels, its field icons, its phone numbers and its button icons on
 * the right, footer buttons at the far left, and `+963…` rendered as `963…+`.
 */
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

/**
 * The guard for the bug itself rather than for one component's symptom.
 *
 * `dir="ltr"` is a legitimate island — a phone number, a tooth number, a date,
 * an anatomical chart — and there are dozens of those. `dir="rtl"` written as a
 * literal is a different thing: it pins a piece of the app to Arabic, which is
 * only ever correct on the print sheet, whose whole job is to be an Arabic
 * document regardless of the UI language.
 */
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
