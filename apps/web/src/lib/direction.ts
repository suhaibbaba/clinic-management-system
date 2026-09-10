// Read off `<html>`, where `applyLanguageToDocument` puts it, because the callers portal to
// `document.body` and cannot inherit the tree's direction.
export function documentDirection(): 'rtl' | 'ltr' {
  return typeof document !== 'undefined' && document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr';
}
