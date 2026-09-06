import ar from '@web/booking/locales/ar.json';

/**
 * The booking page's translator.
 *
 * Same rule as the dashboard — **no Arabic string is ever written in a
 * component** (CLAUDE.md), every one comes from a locale file by key — but not
 * the same machinery. `i18next` plus `react-i18next` is around 18 KB gzipped,
 * which is a fifth of this page's entire JavaScript budget spent on a language
 * switcher the page does not have: it is opened from a WhatsApp link by an
 * Arabic-speaking patient, renders once, and has no signed-in preference to
 * restore.
 *
 * So: the same call shape (`t('a.b', { name })`, `{{var}}` interpolation) over
 * a plain JSON dictionary. Adding English later is a second import and a
 * language argument here — the components, which only ever name keys, do not
 * change either way.
 */
type Dictionary = { readonly [key: string]: string | Dictionary };

const DICTIONARIES: Record<string, Dictionary> = { ar };

export const BOOKING_LANGUAGE = 'ar';

/**
 * A key like `otp.resendIn`, with `{{seconds}}` filled from `vars`.
 *
 * A missing key returns the key itself rather than an empty string: a screen
 * reading `otp.resendIn` is a bug someone reports in a minute, where a blank
 * space is one that ships.
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const value = key
    .split('.')
    .reduce<string | Dictionary | undefined>(
      (node, part) => (typeof node === 'object' ? node[part] : undefined),
      DICTIONARIES[BOOKING_LANGUAGE],
    );

  if (typeof value !== 'string') {
    return key;
  }

  if (!vars) {
    return value;
  }

  return value.replaceAll(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
