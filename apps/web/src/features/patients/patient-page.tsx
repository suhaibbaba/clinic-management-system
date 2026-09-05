import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { Badge, EmptyState } from '@web/components/ui';
import { AllergyBanner } from '@web/features/patients/allergy-banner';
import { ChartTab } from '@web/features/patients/chart/chart-tab';
import { usePatient } from '@web/features/patients/queries';
import { cn } from '@web/lib/cn';

/**
 * Tabs of the patient file. The chart is first because it is what a dentist
 * opens the file for; the rest arrive with their own modules and are listed
 * here so the shape of the file is visible from the start.
 */
const TABS = [
  { id: 'chart', label: 'patients.tabs.chart' },
  { id: 'visits', label: 'patients.tabs.visits' },
  { id: 'treatmentPlans', label: 'patients.tabs.treatmentPlans' },
  { id: 'attachments', label: 'patients.tabs.attachments' },
  { id: 'prescriptions', label: 'patients.tabs.prescriptions' },
  { id: 'timeline', label: 'patients.tabs.timeline' },
  { id: 'billing', label: 'patients.tabs.billing' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function PatientPage(): JSX.Element {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const [activeTab, setActiveTab] = useState<TabId>('chart');

  const patient = usePatient(id);

  return (
    <div className="flex flex-col gap-5">
      {/* First, and before the record itself has loaded. */}
      <AllergyBanner patientId={id} />

      <header className="rounded-lg border border-gray-200 bg-white px-5 py-4">
        {patient.isPending && <p className="text-sm text-gray-500">{t('common.loading')}</p>}

        {patient.isError && <p className="text-sm text-red-600">{t('errors.notFound')}</p>}

        {patient.data && (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{patient.data.fullName}</h1>
              <dl className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-600">
                <div className="flex gap-1">
                  <dt>{t('patients.fileNumber')}:</dt>
                  <dd dir="ltr">{patient.data.fileNumber}</dd>
                </div>
                <div className="flex gap-1">
                  <dt>{t('patients.age')}:</dt>
                  <dd>
                    {patient.data.dateOfBirth
                      ? t('patients.years', { count: ageInYears(patient.data.dateOfBirth) })
                      : '—'}
                  </dd>
                </div>
                <div className="flex gap-1">
                  <dt>{t('patients.phone')}:</dt>
                  <dd dir="ltr">{patient.data.phone}</dd>
                </div>
              </dl>
            </div>

            {/* A balance is sum(charges) − sum(payments) and there is no ledger
                yet, so this names the field without inventing a number. */}
            <div className="text-end">
              <span className="block text-xs text-gray-500">{t('patients.balance')}</span>
              <span className="block text-lg font-semibold text-gray-400">—</span>
              <Badge tone="neutral">{t('patients.balancePending')}</Badge>
            </div>
          </div>
        )}
      </header>

      <div role="tablist" aria-label={t('patients.tabs.label')} className="flex flex-wrap gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-brand-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100',
            )}
          >
            {t(tab.label)}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        className="rounded-lg border border-gray-200 bg-white p-4"
      >
        {activeTab === 'chart' ? (
          <ChartTab patientId={id} />
        ) : (
          <EmptyState title="patients.tabs.comingSoon" hint="patients.tabs.comingSoonHint" />
        )}
      </div>
    </div>
  );
}

/** Whole years since a `YYYY-MM-DD` date of birth. */
export function ageInYears(dateOfBirth: string, now: Date = new Date()): number {
  const born = new Date(`${dateOfBirth}T00:00:00`);
  let age = now.getFullYear() - born.getFullYear();

  const monthDelta = now.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < born.getDate())) {
    age -= 1;
  }

  return age;
}
