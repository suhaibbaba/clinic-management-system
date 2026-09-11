import { lazy, Suspense, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import {
  Avatar,
  EmptyState,
  Ltr,
  PhoneLink,
  TabPanel,
  Tabs,
  useTabParam,
} from '@web/components/ui';
import { Skeleton, SkeletonStatus } from '@web/components/ui/skeleton';
import { useSession } from '@web/features/auth/session';
import { AccountTab } from '@web/features/billing/account-tab';
import { PatientBalanceCard } from '@web/features/billing/patient-balance-card';
import { canSeeBilling } from '@web/features/billing/permissions';
import { ageInYears } from '@web/features/patients/age';
import { AllergyBanner } from '@web/features/patients/allergy-banner';
import { canViewChart } from '@web/features/patients/permissions';
import { usePatient } from '@web/features/patients/queries';
import { TimelineTab } from '@web/features/patients/timeline/timeline-tab';
import { TreatmentPlansTab } from '@web/features/patients/treatment-plans/treatment-plans-tab';
import { VisitsTab } from '@web/features/patients/visits/visits-tab';
import { useDelayedLoading } from '@web/lib/use-delayed-loading';

const ChartTab = lazy(async () => ({
  default: (await import('@web/features/patients/chart/chart-tab')).ChartTab,
}));

const ImagingTab = lazy(async () => ({
  default: (await import('@web/features/patients/imaging/imaging-tab')).ImagingTab,
}));

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

const PLACEHOLDER_TABS: readonly TabId[] = ['prescriptions'];

export function PatientPage(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();
  const { id = '' } = useParams();

  // A receptionist reaches this page for the account only, so the clinical
  // tabs are not merely disabled — they are not part of their file at all.
  const role = user?.role;
  const tabs = TABS.filter((tab) => (tab.clinical ? role && canViewChart(role) : true));

  // `?tab=` like every other section: in `useState` nobody could link into a patient's X-rays. The
  // list is filtered by role first, so a pasted `?tab=chart` resolves to what the reader may see.
  const [activeTab, setActiveTab] = useTabParam<TabId>(
    'tab',
    tabs.map((tab) => tab.id),
    tabs[0]?.id ?? 'billing',
  );

  const patient = usePatient(id);
  const showSkeleton = useDelayedLoading(patient.isPending);

  return (
    <div className="flex flex-col gap-5">
      {/* The labels are drawn rather than `sr-only`: a file number, an age and a phone read as a
          dot-separated run only if you know the order, and reception reads this aloud. */}
      <header className="border border-line rounded-card bg-surface p-4 shadow-card">
        {showSkeleton && <PatientHeaderSkeleton />}

        {patient.isError && <p className="text-value text-danger-600">{t('errors.notFound')}</p>}

        {patient.data && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  name={patient.data.fullName}
                  tintKey={id}
                  size={40}
                  className="text-value"
                />

                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <h1 className="truncate text-title font-medium tracking-title text-ink">
                    {patient.data.fullName}
                  </h1>
                  {/* Beside the name it qualifies, and it appears the moment
                      its own query lands rather than waiting on the record. */}
                  <AllergyBanner patientId={id} />
                </div>
              </div>

              {role && canSeeBilling(role) && <PatientBalanceCard patientId={id} />}
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 lg:grid-cols-3">
              <div className="min-w-0">
                <dt className="text-meta text-ink-muted">{t('patients.fileNumber')}</dt>
                <Ltr as="dd" className="mt-0.5 truncate text-value text-ink tabular-nums">
                  {patient.data.fileNumber}
                </Ltr>
              </div>

              <div className="min-w-0">
                <dt className="text-meta text-ink-muted">{t('patients.age')}</dt>
                <dd className="mt-0.5 truncate text-value text-ink">
                  {patient.data.dateOfBirth
                    ? t('patients.years', { count: ageInYears(patient.data.dateOfBirth) })
                    : '—'}
                </dd>
              </div>

              <div className="min-w-0">
                <dt className="text-meta text-ink-muted">{t('patients.phone')}</dt>
                {/* The 44px band is an absolutely positioned `::after`, and an `overflow-hidden`
                    ancestor cuts it down to the line box. */}
                <dd className="mt-0.5 min-w-0 text-value text-ink">
                  <PhoneLink value={patient.data.phone} />
                </dd>
              </div>
            </dl>
          </>
        )}
      </header>

      <Tabs
        tabs={tabs.map((tab) => ({ id: tab.id, label: tab.label }))}
        value={activeTab}
        onChange={setActiveTab}
        label="patients.tabs.label"
      />

      <TabPanel id={activeTab}>
        {/* The chart and the imaging grid are the two heaviest things in the app — an SVG of 52
            teeth and a lightbox — and most visits to a file never open either. */}
        <Suspense fallback={<TabFallback />}>
          {activeTab === 'chart' && (
            <ChartTab
              patientId={id}
              dateOfBirth={patient.data?.dateOfBirth}
              patient={patient.data}
            />
          )}
          {activeTab === 'attachments' && <ImagingTab patientId={id} />}
        </Suspense>

        {activeTab === 'visits' && <VisitsTab patientId={id} patient={patient.data} />}
        {activeTab === 'treatmentPlans' && (
          <TreatmentPlansTab patientId={id} patient={patient.data} />
        )}
        {activeTab === 'timeline' && <TimelineTab patientId={id} />}
        {activeTab === 'billing' && <AccountTab patientId={id} patient={patient.data} />}

        {PLACEHOLDER_TABS.includes(activeTab) && (
          <EmptyState
            icon="clipboard"
            title="patients.tabs.comingSoon"
            hint="patients.tabs.comingSoonHint"
          />
        )}
      </TabPanel>
    </div>
  );
}

// The lazy tab's own box while its chunk arrives: the same height the chart and the grid settle
// at, so the page does not grow under the reader when it lands.
function TabFallback(): JSX.Element {
  return <Skeleton aria-hidden="true" className="h-[420px] w-full rounded-card" />;
}

function PatientHeaderSkeleton(): JSX.Element {
  return (
    <>
      <SkeletonStatus />

      <div aria-hidden="true">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <Skeleton className="h-5 w-48" />
          </div>

          <Skeleton className="h-12 w-32 rounded-panel" />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 lg:grid-cols-3">
          {[0, 1, 2].map((field) => (
            <div key={field} className="min-w-0">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-1.5 h-4 w-24" />
            </div>
          ))}
        </dl>
      </div>
    </>
  );
}
