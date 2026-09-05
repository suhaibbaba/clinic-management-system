import type { PerformedProcedure, Visit } from '@clinic/shared';
import { useMemo, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, Button, EmptyState, useToast } from '@web/components/ui';
import { useSession } from '@web/features/auth/session';
import { useDoctors } from '@web/features/doctors/queries';
import {
  ProcedureForm,
  type ProcedureFormValues,
} from '@web/features/patients/procedures/procedure-form';
import {
  useCreateProcedure,
  usePatientProcedures,
  usePatientVisits,
  useProcedureCatalog,
  useUpdateProcedure,
} from '@web/features/patients/queries';
import { VisitFormModal } from '@web/features/patients/visits/visit-form-modal';
import { errorMessageKey } from '@web/lib/api-error';
import { formatDateTime } from '@web/lib/format';
import { cn } from '@web/lib/cn';

/**
 * The visits tab: one encounter per card, newest first, with the procedures
 * carried out during it listed inside.
 *
 * Procedures live under their visit rather than in a flat list because that is
 * how they are recorded — a visit is the thing that happened, and the work is
 * what happened in it. The same procedure also appears on the chart, coloured
 * by the tooth it touched; these are two views of one record, not two records.
 */
export function VisitsTab({ patientId }: { patientId: string }): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();
  const toast = useToast();

  const visits = usePatientVisits(patientId);
  const procedures = usePatientProcedures(patientId);
  const catalog = useProcedureCatalog();
  const doctors = useDoctors({ limit: 100 });

  const createProcedure = useCreateProcedure(patientId);
  const updateProcedure = useUpdateProcedure(patientId);

  const [formOpen, setFormOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  /** The visit currently showing its procedure form, and what it is editing. */
  const [procedureFor, setProcedureFor] = useState<{
    visitId: string;
    procedure: PerformedProcedure | null;
  } | null>(null);

  /** Procedures grouped by the visit they were recorded in. */
  const byVisit = useMemo(() => {
    const grouped = new Map<string, PerformedProcedure[]>();

    for (const procedure of procedures.data ?? []) {
      if (!procedure.visitId) {
        continue;
      }

      grouped.set(procedure.visitId, [...(grouped.get(procedure.visitId) ?? []), procedure]);
    }

    return grouped;
  }, [procedures.data]);

  const doctorName = (id: string): string =>
    doctors.data?.items.find((doctor) => doctor.id === id)?.user.name ?? '—';

  const catalogName = (id: string): string =>
    catalog.data?.find((item) => item.id === id)?.nameAr ?? t('chart.panel.procedure');

  if (visits.isPending) {
    return <p className="text-sm text-gray-500">{t('common.loading')}</p>;
  }

  if (visits.isError) {
    return <EmptyState title="errors.generic" hint="visits.loadFailed" />;
  }

  const ordered = [...(visits.data ?? [])].sort((a, b) => b.visitDate.localeCompare(a.visitDate));

  const submitProcedure = async (visitId: string, values: ProcedureFormValues): Promise<void> => {
    const editing = procedureFor?.procedure;

    try {
      if (editing) {
        await updateProcedure.mutateAsync({ id: editing.id, body: values });
        toast.success('visits.procedureUpdated');
      } else {
        await createProcedure.mutateAsync({ ...values, patientId, visitId });
        toast.success('chart.panel.recorded');
      }

      setProcedureFor(null);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-800">
          {t('visits.count', { count: ordered.length })}
        </h2>
        <Button
          size="sm"
          onClick={() => {
            setEditingVisit(null);
            setFormOpen(true);
          }}
        >
          {t('visits.create')}
        </Button>
      </div>

      {ordered.length === 0 && <EmptyState title="visits.empty" hint="visits.emptyHint" />}

      <ol className="flex flex-col gap-4">
        {ordered.map((visit) => {
          const visitProcedures = byVisit.get(visit.id) ?? [];
          const showingForm = procedureFor?.visitId === visit.id;

          return (
            <li key={visit.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900" dir="ltr">
                    {formatDateTime(visit.visitDate)}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {t('visits.doctor')}: {doctorName(visit.doctorId)}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingVisit(visit);
                    setFormOpen(true);
                  }}
                >
                  {t('common.edit')}
                </Button>
              </div>

              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="visits.complaint" value={visit.complaint} />
                <Field label="visits.diagnosis" value={visit.diagnosis} emphasise />
                <Field label="visits.examination" value={visit.examination} />
                <Field label="visits.notes" value={visit.notes} />
              </dl>

              <section className="mt-4 border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {t('visits.procedures')}
                  </h3>

                  {!showingForm && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setProcedureFor({ visitId: visit.id, procedure: null })}
                    >
                      {t('chart.panel.addProcedure')}
                    </Button>
                  )}
                </div>

                {visitProcedures.length === 0 && !showingForm && (
                  <p className="mt-2 text-xs text-gray-500">{t('visits.noProcedures')}</p>
                )}

                {visitProcedures.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {visitProcedures.map((procedure) => (
                      <li
                        key={procedure.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-gray-50 px-3 py-2"
                      >
                        {/* Flex, not a margin: the tooth number is an LTR
                            isolate inside RTL text, and a gap is the only
                            spacing that survives that reliably. */}
                        <span className="flex items-center gap-2 text-sm text-gray-900">
                          {catalogName(procedure.procedureId)}
                          {toothLabel(procedure) && (
                            <span className="text-xs text-gray-500" dir="ltr">
                              {toothLabel(procedure)}
                            </span>
                          )}
                        </span>

                        <span className="flex items-center gap-2">
                          <Badge tone={statusTone(procedure.status)}>
                            {t(`chart.procedureStatus.${procedure.status}`)}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setProcedureFor({ visitId: visit.id, procedure })}
                          >
                            {t('common.edit')}
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {showingForm && (
                  <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    {user && (
                      <ProcedureForm
                        role={user.role}
                        catalog={catalog.data ?? []}
                        doctors={doctors.data?.items ?? []}
                        submitting={createProcedure.isPending || updateProcedure.isPending}
                        visitId={visit.id}
                        {...(procedureFor.procedure
                          ? {
                              procedure: procedureFor.procedure,
                              ...toothOf(procedureFor.procedure),
                            }
                          : {})}
                        onCancel={() => setProcedureFor(null)}
                        onSubmit={(values) => void submitProcedure(visit.id, values)}
                      />
                    )}
                  </div>
                )}
              </section>
            </li>
          );
        })}
      </ol>

      <VisitFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        patientId={patientId}
        doctors={doctors.data?.items ?? []}
        visit={editingVisit}
      />
    </div>
  );
}

function Field({
  label,
  value,
  emphasise = false,
}: {
  label: string;
  value: string | null;
  emphasise?: boolean;
}): JSX.Element | null {
  const { t } = useTranslation();

  if (!value) {
    return null;
  }

  return (
    <div>
      <dt className="text-xs text-gray-500">{t(label)}</dt>
      <dd
        className={cn(
          'mt-0.5 whitespace-pre-wrap text-sm',
          emphasise ? 'font-medium text-gray-900' : 'text-gray-700',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** The tooth a procedure was recorded on, when it has one. */
function toothOf(procedure: PerformedProcedure): { tooth?: number } {
  const tooth = (procedure.chartMarks?.[0]?.location as { tooth?: number } | undefined)?.tooth;

  return tooth === undefined ? {} : { tooth };
}

function toothLabel(procedure: PerformedProcedure): string {
  const teeth = (procedure.chartMarks ?? [])
    .map((mark) => (mark.location as { tooth?: number }).tooth)
    .filter((tooth): tooth is number => typeof tooth === 'number');

  return teeth.length === 0 ? '' : teeth.join(' · ');
}

function statusTone(status: PerformedProcedure['status']): 'success' | 'warning' | 'neutral' {
  if (status === 'done') {
    return 'success';
  }

  return status === 'in_progress' ? 'warning' : 'neutral';
}
