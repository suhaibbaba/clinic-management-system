import { useMemo, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState, SegmentedControl, useToast } from '@web/components/ui';
import { useDoctors } from '@web/features/doctors/queries';
import type { Dentition } from '@web/features/patients/chart/fdi-layout';
import type { NewProcedureInput } from '@web/features/patients/chart/add-procedure-form';
import { ToothChart, ToothChartSkeleton } from '@web/features/patients/chart/tooth-chart';
import { ToothLegend } from '@web/features/patients/chart/tooth-legend';
import { ToothPanel } from '@web/features/patients/chart/tooth-panel';
import { deriveToothSummaries, healthyTooth } from '@web/features/patients/chart/tooth-state';
import {
  useCreateProcedure,
  useProcedureCatalog,
  usePatientProcedures,
} from '@web/features/patients/queries';
import { useSession } from '@web/features/auth/session';
import { errorMessageKey } from '@web/lib/api-error';

/**
 * The chart tab: fetches what colours the teeth, and owns the selection.
 *
 * Two queries back it — the patient's procedures and the procedure catalog —
 * because a tooth's state is the pair of them: the procedure says how far along
 * it is, the catalog says what it charts as when finished.
 */
export function ChartTab({ patientId }: { patientId: string }): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();
  const toast = useToast();

  const [dentition, setDentition] = useState<Dentition>('permanent');
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);

  const procedures = usePatientProcedures(patientId);
  const catalog = useProcedureCatalog();
  const doctors = useDoctors({ limit: 100 });
  const createProcedure = useCreateProcedure(patientId);

  const outcomes = useMemo(
    () => new Map((catalog.data ?? []).map((item) => [item.id, item.chartOutcome])),
    [catalog.data],
  );

  const summaries = useMemo(
    () => deriveToothSummaries(procedures.data ?? [], outcomes),
    [procedures.data, outcomes],
  );

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
        <SegmentedControl
          label={t('chart.dentition')}
          value={dentition}
          onChange={(next) => {
            setDentition(next);
            // The deciduous arch has no tooth 27; keeping a selection across
            // the switch would leave the panel describing a tooth that is not
            // on screen.
            setSelectedTooth(null);
          }}
          options={(['permanent', 'deciduous'] as const).map((option) => ({
            value: option,
            label: t(`chart.${option}`),
          }))}
        />

        <p className="text-label text-ink-muted">{t('chart.keyboardHint')}</p>
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
        />
      )}
    </div>
  );
}
