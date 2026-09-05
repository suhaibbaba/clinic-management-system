import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { EmptyState } from '@web/components/ui';
import { useSession } from '@web/features/auth/session';
import { AccountTab } from '@web/features/billing/account-tab';
import { PatientBalanceCard } from '@web/features/billing/patient-balance-card';
import { canSeeBilling } from '@web/features/billing/permissions';
import { AllergyBanner } from '@web/features/patients/allergy-banner';
import { ChartTab } from '@web/features/patients/chart/chart-tab';
import { ImagingTab } from '@web/features/patients/imaging/imaging-tab';
import { canViewChart } from '@web/features/patients/permissions';
import { usePatient } from '@web/features/patients/queries';
import { TreatmentPlansTab } from '@web/features/patients/treatment-plans/treatment-plans-tab';
import { VisitsTab } from '@web/features/patients/visits/visits-tab';
import { cn } from '@web/lib/cn';

/**
 * Tabs of the patient file. The chart is first because it is what a dentist
 * opens the file for; the rest arrive with their own modules and are listed
 * here so the shape of the file is visible from the start.
 */
const TABS = [
  { id: 'chart', label: 'patients.tabs.chart', clinical: true },
  { id: 'visits', label: 'patients.tabs.visits', clinical: true },
  { id: 'treatmentPlans', label: 'patients.tabs.treatmentPlans', clinical: true },
  { id: 'attachments', label: 'patients.tabs.attachments', clinical: true },
  { id: 'prescriptions', label: 'patients.tabs.prescriptions', clinical: true },
  { id: 'timeline', label: 'patients.tabs.timeline', clinical: true },
  { id: 'billing', label: 'patients.tabs.billing', clinical: false },
] as const;

type TabId = (typeof TABS)[number]['id'];

/** Tabs still waiting on the module that fills them. */
const PLACEHOLDER_TABS: readonly TabId[] = ['prescriptions', 'timeline'];

export function PatientPage(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();
  const { id = '' } = useParams();

  // A receptionist reaches this page for the account only, so the clinical
  // tabs are not merely disabled — they are not part of their file at all.
  const role = user?.role;
  const tabs = TABS.filter((tab) => (tab.clinical ? role && canViewChart(role) : true));
  const [activeTab, setActiveTab] = useState<TabId>(tabs[0]?.id ?? 'billing');

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

            {role && canSeeBilling(role) && <PatientBalanceCard patientId={id} />}
          </div>
        )}
      </header>

      <div role="tablist" aria-label={t('patients.tabs.label')} className="flex flex-wrap gap-1">
        {tabs.map((tab) => (
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
        {activeTab === 'chart' && <ChartTab patientId={id} />}
        {activeTab === 'visits' && <VisitsTab patientId={id} />}
        {activeTab === 'treatmentPlans' && (
          <TreatmentPlansTab patientId={id} patient={patient.data} />
        )}
        {activeTab === 'attachments' && <ImagingTab patientId={id} />}
        {activeTab === 'billing' && <AccountTab patientId={id} patient={patient.data} />}

        {PLACEHOLDER_TABS.includes(activeTab) && (
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
