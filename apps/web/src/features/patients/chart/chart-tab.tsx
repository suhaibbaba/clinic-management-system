import { isDeciduousTooth, type PatientClinicalView } from '@clinic/shared';
import { useMemo, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState, SegmentedControl, useToast } from '@web/components/ui';
import { useDoctors } from '@web/features/doctors/queries';
import type { Dentition } from '@web/features/patients/chart/fdi-layout';
import type { NewProcedureInput } from '@web/features/patients/chart/add-procedure-form';
import { ToothChart, ToothChartSkeleton } from '@web/features/patients/chart/tooth-chart';
import { ToothLegend } from '@web/features/patients/chart/tooth-legend';
import { ToothPanel } from '@web/features/patients/chart/tooth-panel';
import {
  deriveToothSummaries,
  healthyTooth,
  useToothStates,
} from '@web/features/patients/chart/tooth-state';
import {
  useCreateProcedure,
  useProcedureCatalog,
  usePatientProcedures,
} from '@web/features/patients/queries';
import { useSession } from '@web/features/auth/session';
import { OrderFormModal, type LabOrderDefaults } from '@web/features/labs/order-form-modal';
import { canCreateLabOrder } from '@web/features/labs/permissions';
import { ageInYears } from '@web/features/patients/age';
import { errorMessageKey } from '@web/lib/api-error';

// A tooth's state is the pair of queries: the procedure says how far along, the catalog what it
// charts as. Past thirteen the deciduous arch is noise unless a tooth is retained.
const PERMANENT_DENTITION_AGE = 13;

export function ChartTab({
  patientId,
  dateOfBirth,
  patient,
}: {
  readonly patientId: string;
  readonly dateOfBirth?: string | null | undefined;
  /** Fills the lab order's patient without a second lookup. */
  readonly patient?: PatientClinicalView | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();
  const toast = useToast();

  const [dentition, setDentition] = useState<Dentition>('permanent');
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [labOrder, setLabOrder] = useState<LabOrderDefaults | undefined>();

  const procedures = usePatientProcedures(patientId);
  const catalog = useProcedureCatalog();
  const doctors = useDoctors({ limit: 100 });
  const createProcedure = useCreateProcedure(patientId);

  const outcomes = useMemo(
    () => new Map((catalog.data ?? []).map((item) => [item.id, item.chartOutcome])),
    [catalog.data],
  );

  const states = useToothStates();

  const summaries = useMemo(
    () => deriveToothSummaries(procedures.data ?? [], outcomes, states),
    [procedures.data, outcomes, states],
  );

  // An unknown date of birth keeps the toggle, as does a deciduous tooth already on file: the chart
  // must never be unable to show a tooth it has a procedure for.
  const age = dateOfBirth ? ageInYears(dateOfBirth) : null;
  const hasDeciduousHistory = [...summaries.keys()].some(isDeciduousTooth);
  const showDentitionToggle = age === null || age < PERMANENT_DENTITION_AGE || hasDeciduousHistory;

  if (procedures.isPending || catalog.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <ToothChartSkeleton />
      </div>
    );
  }

  if (procedures.isError) {
    return <EmptyState icon="alert" title="errors.generic" hint="chart.loadFailed" />;
  }

  const role = user?.role;
  const hasHistory = summaries.size > 0;

  const handleRecord = (input: NewProcedureInput): void => {
    createProcedure.mutate(
      { ...input, patientId },
      {
        onSuccess: () => toast.success('chart.panel.recorded'),
        // The cache rollback happens in the mutation; this is what tells the
        // user why the tooth they just watched change colour changed back.
        onError: (error) => toast.error(errorMessageKey(error)),
      },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {showDentitionToggle && (
          <SegmentedControl
            label={t('chart.dentition')}
            value={dentition}
            onChange={(next) => {
              setDentition(next);
              // The deciduous arch has no tooth 27, so a selection kept across the switch would
              // describe a tooth that is not on screen.
              setSelectedTooth(null);
            }}
            options={(['permanent', 'deciduous'] as const).map((option) => ({
              value: option,
              label: t(`chart.${option}`),
            }))}
          />
        )}

        {/* `ms-auto`, so the hint stays at the far end whether or not the
            toggle beside it exists. */}
        <p className="ms-auto text-label text-ink-muted">{t('chart.keyboardHint')}</p>
      </div>

      {/* A new patient still gets a chart — every tooth healthy — with a line
          saying so, rather than an empty box in place of the thing to click. */}
      {!hasHistory && <EmptyState icon="tooth" title="chart.empty" hint="chart.emptyHint" />}

      <div className="flex flex-col gap-3">
        <ToothChart
          dentition={dentition}
          summaries={summaries}
          selectedTooth={selectedTooth}
          onSelect={setSelectedTooth}
        />

        <ToothLegend />
      </div>

      {role && (
        <ToothPanel
          patientId={patientId}
          tooth={selectedTooth}
          summary={
            selectedTooth === null
              ? null
              : (summaries.get(selectedTooth) ?? healthyTooth(selectedTooth))
          }
          role={role}
          catalog={catalog.data ?? []}
          doctors={doctors.data?.items ?? []}
          submitting={createProcedure.isPending}
          onClose={() => setSelectedTooth(null)}
          onRecord={handleRecord}
          {...(canCreateLabOrder(role) && {
            onSendToLab: (input: { teeth: number[]; performedProcedureId?: string }) =>
              setLabOrder({
                teeth: input.teeth,
                ...(input.performedProcedureId && {
                  performedProcedureId: input.performedProcedureId,
                }),
                ...(patient && {
                  patient: {
                    id: patient.id,
                    fullName: patient.fullName,
                    phone: patient.phone,
                    fileNumber: patient.fileNumber,
                  },
                }),
              }),
          })}
        />
      )}

      {/* Raised from the chart, so the tooth — and the treatment that needs the
          work, when it started from a procedure — are already on the form. */}
      <OrderFormModal
        open={labOrder !== undefined}
        onOpenChange={(open) => !open && setLabOrder(undefined)}
        defaults={labOrder}
      />
    </div>
  );
}
