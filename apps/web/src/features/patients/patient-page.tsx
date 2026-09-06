import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { Avatar, EmptyState } from '@web/components/ui';
import { useSession } from '@web/features/auth/session';
import { AccountTab } from '@web/features/billing/account-tab';
import { PatientBalanceCard } from '@web/features/billing/patient-balance-card';
import { canSeeBilling } from '@web/features/billing/permissions';
import { ageInYears } from '@web/features/patients/age';
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
      {/*
        The file's identity line, not a card.

        It was a full-width white slab with a name at one edge and a balance at
        the other and a hole in between; on a wide screen the two facts it
        carried were a screen apart. As a plain header row — avatar, name, the
        rest of the identity as one quiet line under it — it says the same
        things in a third of the height, and the white surfaces below it are
        left to mean "content".
      */}
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        {patient.isPending && <p className="text-value text-ink-muted">{t('common.loading')}</p>}

        {patient.isError && <p className="text-value text-danger-600">{t('errors.notFound')}</p>}

        {patient.data && (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={patient.data.fullName} tintKey={id} className="size-11 text-value" />

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="truncate text-xl font-semibold tracking-tight text-ink">
                  {patient.data.fullName}
                </h1>
                {/* Beside the name it qualifies, and it appears the moment its
                    own query lands rather than waiting on the record. */}
                <AllergyBanner patientId={id} />
              </div>

              {/*
                One line, dot-separated. Three labelled pairs spread across a
                row read as a form; the labels are only there for a screen
                reader, which is what `sr-only` on the `dt` is for.
              */}
              <dl className="mt-0.5 flex flex-wrap items-center gap-x-2 text-label text-ink-muted">
                <dt className="sr-only">{t('patients.fileNumber')}</dt>
                <dd dir="ltr" className="tabular-nums">
                  {patient.data.fileNumber}
                </dd>

                <span aria-hidden="true">·</span>

                <dt className="sr-only">{t('patients.age')}</dt>
                <dd>
                  {patient.data.dateOfBirth
                    ? t('patients.years', { count: ageInYears(patient.data.dateOfBirth) })
                    : '—'}
                </dd>

                <span aria-hidden="true">·</span>

                <dt className="sr-only">{t('patients.phone')}</dt>
                <dd dir="ltr" className="tabular-nums">
                  {patient.data.phone}
                </dd>
              </dl>
            </div>
          </div>
        )}

        {patient.data && role && canSeeBilling(role) && <PatientBalanceCard patientId={id} />}
      </header>

      {/*
        Styled as the segmented control, but still real tabs — these switch
        panels rather than filter a list, so `tablist`/`tab`/`tabpanel` is what
        they are and what a screen reader is told. `SegmentedControl` is a
        radio group and would announce the wrong thing here.
      */}
      <div
        role="tablist"
        aria-label={t('patients.tabs.label')}
        className={cn(
          // One scrolling row on a phone. Seven tabs in a wrapping pill came
          // out as three ragged lines that pushed the content 120px down the
          // page; a tab strip that scrolls is what every mobile OS does.
          'flex items-center gap-1 rounded-pill bg-inset p-1',
          'max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          // `self-start` as well as `inline-flex`: the strip sits in a column
          // flex container, where `align-items: stretch` pulls an inline-flex
          // child to the full width anyway — which drew the pill as a grey bar
          // across the page with the tabs bunched at one end.
          'sm:inline-flex sm:flex-wrap sm:self-start sm:overflow-visible',
        )}
      >
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
              'shrink-0 cursor-pointer rounded-pill px-3.5 py-1.5 text-value font-medium',
              'transition-[background-color,color,box-shadow,transform] duration-150 active:scale-95',
              activeTab === tab.id
                ? 'bg-surface text-ink shadow-pill'
                : 'text-ink-muted hover:bg-surface/60 hover:text-ink',
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
        className="min-w-0"
      >
        {activeTab === 'chart' && (
          <ChartTab patientId={id} dateOfBirth={patient.data?.dateOfBirth} />
        )}
        {activeTab === 'visits' && <VisitsTab patientId={id} />}
        {activeTab === 'treatmentPlans' && (
          <TreatmentPlansTab patientId={id} patient={patient.data} />
        )}
        {activeTab === 'attachments' && <ImagingTab patientId={id} />}
        {activeTab === 'billing' && <AccountTab patientId={id} patient={patient.data} />}

        {PLACEHOLDER_TABS.includes(activeTab) && (
          <EmptyState
            icon="clipboard"
            title="patients.tabs.comingSoon"
            hint="patients.tabs.comingSoonHint"
          />
        )}
      </div>
    </div>
  );
}
