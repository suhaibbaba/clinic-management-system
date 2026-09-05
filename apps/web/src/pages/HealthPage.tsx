import { useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchHealth } from '@web/services/api';

/**
 * The only page in the skeleton: it proves the full wiring — React → TanStack
 * Query → the API service → the API's /health endpoint → PostgreSQL — and
 * parses the response with the schema shared by both sides.
 */
export function HealthPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const {
    data: health,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
  });

  return (
    <main className="page">
      <h1>{t('app.title')}</h1>
      <section className="card">
        <h2>{t('health.title')}</h2>

        {isPending && <p>{t('health.loading')}</p>}
        {isError && <p role="alert">{t('health.error')}</p>}

        {health && (
          <dl>
            <dt>{t('health.api')}</dt>
            <dd data-status={health.status}>{t(`health.status.${health.status}`)}</dd>

            <dt>{t('health.database')}</dt>
            <dd data-status={health.database}>{t(`health.status.${health.database}`)}</dd>

            <dt>{t('health.version')}</dt>
            <dd>{health.version}</dd>

            <dt>{t('health.checkedAt')}</dt>
            {/* Gregorian dates (CLAUDE.md), localized to the active language. */}
            <dd>{new Date(health.timestamp).toLocaleString(i18n.language)}</dd>
          </dl>
        )}
      </section>
    </main>
  );
}
