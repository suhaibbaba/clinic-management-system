import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ar from '@web/i18n/locales/ar.json';
import en from '@web/i18n/locales/en.json';

export const DEFAULT_LANGUAGE = 'ar';

const RTL_LANGUAGES = new Set(['ar']);

export const isRtl = (language: string): boolean => RTL_LANGUAGES.has(language.split('-')[0] ?? '');

// Arabic is the default and only shipped language; English is wired up so adding it is a config
// change. Strings never live in components.
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
