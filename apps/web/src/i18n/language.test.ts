import { afterEach, describe, expect, it } from 'vitest';

import i18n from '@web/i18n';
import {
  applyLanguageToDocument,
  changeLanguage,
  initLanguage,
  storedLanguage,
} from '@web/i18n/language';

/**
 * Switching language has to do three things together, and the third is the one
 * that gets forgotten: change the strings, remember the choice, and flip the
 * document's direction. A language switch that leaves `dir="rtl"` renders
 * English right-aligned with the sidebar on the wrong side.
 */
describe('language', () => {
  afterEach(async () => {
    window.localStorage.clear();
    await i18n.changeLanguage('ar');
    applyLanguageToDocument('ar');
  });

  it('switches the strings, the direction and the stored choice together', async () => {
    await changeLanguage('en');

    expect(i18n.language).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
    expect(storedLanguage()).toBe('en');
  });

  it('goes back to right-to-left for Arabic', async () => {
    await changeLanguage('en');
    await changeLanguage('ar');

    expect(document.documentElement.dir).toBe('rtl');
    expect(storedLanguage()).toBe('ar');
  });

  it('restores the stored choice on the next boot', async () => {
    await changeLanguage('en');

    // A fresh load: the document starts as the HTML shell left it.
    applyLanguageToDocument('ar');
    initLanguage();

    expect(document.documentElement.dir).toBe('ltr');
    expect(i18n.language).toBe('en');
  });

  it('falls back to Arabic when nothing is stored', () => {
    window.localStorage.clear();
    initLanguage();

    expect(document.documentElement.dir).toBe('rtl');
  });

  /*
   * The ordering guard: the direction has to be on the document before the
   * language change re-renders the tree, or direction-relative icons paint
   * with the old direction.
   */
  it('sets the direction before the strings change', async () => {
    let dirWhenStringsChanged: string | undefined;
    const onLanguageChanged = (): void => {
      dirWhenStringsChanged = document.documentElement.dir;
    };

    i18n.on('languageChanged', onLanguageChanged);
    await changeLanguage('en');
    i18n.off('languageChanged', onLanguageChanged);

    expect(dirWhenStringsChanged).toBe('ltr');
  });

  it('ignores a stored value that is not a language we ship', () => {
    window.localStorage.setItem('clinic.language', 'fr');

    expect(storedLanguage()).toBeNull();
  });
});
