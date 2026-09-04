import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ar from './locales/ar.json';
import en from './locales/en.json';

export const DEFAULT_LANGUAGE = 'ar';

/** Languages that render right-to-left; drives the `dir` attribute. */
const RTL_LANGUAGES = new Set(['ar']);

export const isRtl = (language: string): boolean => RTL_LANGUAGES.has(language.split('-')[0] ?? '');

/**
 * Arabic is the default and only shipped language for now (CLAUDE.md);
 * English resources are wired up so adding it later is a config change.
 * UI strings never live in components — always `t('some.key')`.
 */
void i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    en: { translation: en },
  },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
});

export default i18n;
