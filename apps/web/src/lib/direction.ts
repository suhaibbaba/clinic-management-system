/**
 * The direction the app is currently laid out in.
 *
 * Read off `<html>` rather than off i18next, because that is where
 * `applyLanguageToDocument` puts it and because the things that need this are
 * the ones that portal to `document.body` — a dialog, a drawer, a menu — where
 * inheriting the tree's direction is not an option.
 *
 * Safe to call during render: the document is updated *before*
 * `i18n.changeLanguage`, so the re-render that a language switch causes already
 * sees the new value. Guarded for the server/test case where there is no
 * document at all.
 */
export function documentDirection(): 'rtl' | 'ltr' {
  return typeof document !== 'undefined' && document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr';
}
