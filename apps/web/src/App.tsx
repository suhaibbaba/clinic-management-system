import { useEffect, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { isRtl } from '@web/i18n';
import { HealthPage } from '@web/pages/HealthPage';

export function App(): JSX.Element {
  const { i18n } = useTranslation();

  // Keep the document direction in sync with the active language. The initial
  // value is already `dir="rtl"` in index.html so the first paint is correct.
  useEffect(() => {
    document.documentElement.lang = i18n.language;
    document.documentElement.dir = isRtl(i18n.language) ? 'rtl' : 'ltr';
  }, [i18n.language]);

  return <HealthPage />;
}
