import type { PatientClinicalView, PerformedProcedure, Visit } from '@clinic/shared';
import { useMemo, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, Button, EmptyState, Icon, Ltr, usePersonName, useToast } from '@web/components/ui';
import { SkeletonCard, SkeletonStatus } from '@web/components/ui/skeleton';
import { useSession } from '@web/features/auth/session';
import { useDoctors } from '@web/features/doctors/queries';
import { ConsumeForVisit } from '@web/features/inventory/consume-for-visit';
import { canConsumeStock } from '@web/features/inventory/permissions';
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
import { useDelayedLoading } from '@web/lib/use-delayed-loading';

// Procedures live under their visit because that is how they are recorded. The same procedure also
// appears on the chart — two views of one record, not two records.
export function VisitsTab({
  patientId,
  patient,
}: {
  patientId: string;
  patient?: PatientClinicalView | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();
  const toast = useToast();

  const visits = usePatientVisits(patientId);
  const showSkeleton = useDelayedLoading(visits.isPending);
  const procedures = usePatientProcedures(patientId);
  const catalog = useProcedureCatalog();
  const doctors = useDoctors({ limit: 100 });

  const [consumingFor, setConsumingFor] = useState<string | null>(null);

  const createProcedure = useCreateProcedure(patientId);
  const updateProcedure = useUpdateProcedure(patientId);

  const [formOpen, setFormOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [procedureFor, setProcedureFor] = useState<{
    visitId: string;
    procedure: PerformedProcedure | null;
  } | null>(null);

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

  const displayName = usePersonName();
  const doctorName = (id: string): string =>
    displayName(doctors.data?.items.find((doctor) => doctor.id === id)?.user.name) || '—';

  const catalogName = (id: string): string =>
    catalog.data?.find((item) => item.id === id)?.nameAr ?? t('chart.panel.procedure');

  if (showSkeleton) {
    return (
      <div className="flex flex-col gap-3">
        <SkeletonStatus />
        <SkeletonCard count={3} />
      </div>
    );
  }

  if (visits.isPending) {
    return <></>;
  }

  if (visits.isError) {
    return <EmptyState icon="alert" title="errors.generic" hint="visits.loadFailed" />;
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
        <h2 className="text-value font-semibold text-ink">
          {t('visits.count', { count: ordered.length })}
        </h2>
        <Button
          icon={<Icon name="plus" />}
          size="sm"
          onClick={() => {
            setEditingVisit(null);
            setFormOpen(true);
          }}
        >
          {t('visits.create')}
        </Button>
      </div>

      {ordered.length === 0 && (
        <EmptyState icon="calendar" title="visits.empty" hint="visits.emptyHint" />
      )}

      <ol className="flex flex-col gap-4">
        {ordered.map((visit) => {
          const visitProcedures = byVisit.get(visit.id) ?? [];
          const showingForm = procedureFor?.visitId === visit.id;

          return (
            <li key={visit.id} className="rounded-card bg-surface shadow-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Ltr as="p" className="text-value font-semibold text-ink">
                    {formatDateTime(visit.visitDate)}
                  </Ltr>
                  <p className="mt-0.5 text-label text-ink-muted">
                    {t('visits.doctor')}: {doctorName(visit.doctorId)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* The alternative is a technician reconstructing a day's consumption from memory,
                      which is how a stock count stops matching the cupboard. */}
                  {canConsumeStock(user?.role) && (
                    <Button
                      icon={<Icon name="clipboard" />}
                      variant="secondary"
                      size="sm"
                      onClick={() => setConsumingFor(visit.id)}
                    >
                      {t('inventory.movement.consumeFromVisit')}
                    </Button>
                  )}

                  <Button
                    icon={<Icon name="edit" />}
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
              </div>

              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="visits.complaint" value={visit.complaint} />
                <Field label="visits.diagnosis" value={visit.diagnosis} emphasise />
                <Field label="visits.examination" value={visit.examination} />
                <Field label="visits.notes" value={visit.notes} />
              </dl>

              <section className="mt-4 border-t border-line pt-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-label font-semibold uppercase tracking-wide text-ink-muted">
                    {t('visits.procedures')}
                  </h3>

                  {!showingForm && (
                    <Button
                      icon={<Icon name="plus" />}
                      variant="secondary"
                      size="sm"
                      onClick={() => setProcedureFor({ visitId: visit.id, procedure: null })}
                    >
                      {t('chart.panel.addProcedure')}
                    </Button>
                  )}
                </div>

                {visitProcedures.length === 0 && !showingForm && (
                  <p className="mt-2 text-label text-ink-muted">{t('visits.noProcedures')}</p>
                )}

                {visitProcedures.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {visitProcedures.map((procedure) => (
                      <li
                        key={procedure.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-canvas px-3 py-2"
                      >
                        {/* Flex, not a margin: the tooth number is an LTR
                            isolate inside RTL text, and a gap is the only
                            spacing that survives that reliably. */}
                        <span className="flex items-center gap-2 text-value text-ink">
                          {catalogName(procedure.procedureId)}
                          {toothLabel(procedure) && (
                            <Ltr className="text-label text-ink-muted">{toothLabel(procedure)}</Ltr>
                          )}
                        </span>

                        <span className="flex items-center gap-2">
                          <Badge tone={statusTone(procedure.status)}>
                            {t(`chart.procedureStatus.${procedure.status}`)}
                          </Badge>
                          <Button
                            icon={<Icon name="edit" />}
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
                  <div className="mt-3 rounded-panel bg-sunken p-3">
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

      <ConsumeForVisit
        open={consumingFor !== null}
        onClose={() => setConsumingFor(null)}
        patient={patient}
      />

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
      <dt className="text-label text-ink-muted">{t(label)}</dt>
      <dd
        className={cn(
          'mt-0.5 whitespace-pre-wrap text-value',
          emphasise ? 'font-medium text-ink' : 'text-ink',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

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
