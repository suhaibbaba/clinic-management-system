import type { Doctor, PerformedProcedure, ProcedureCatalogItem, UserRole } from '@clinic/shared';
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, Button, Drawer, EmptyState, Icon } from '@web/components/ui';
import {
  AddProcedureForm,
  type NewProcedureInput,
} from '@web/features/patients/chart/add-procedure-form';
import { SurfaceSelector } from '@web/features/patients/chart/surface-selector';
import { ToothAttachments } from '@web/features/patients/chart/tooth-attachments';
import { toothStateLabelKey, type ToothSummary } from '@web/features/patients/chart/tooth-state';
import {
  canRecordProcedure,
  canSeeAttachments,
  canSeePrices,
} from '@web/features/patients/permissions';
import { useToothHistory } from '@web/features/patients/queries';
import { formatDate } from '@web/lib/format';

export interface ToothPanelProps {
  readonly patientId: string;
  readonly tooth: number | null;
  readonly summary: ToothSummary | null;
  readonly role: UserRole;
  readonly catalog: readonly ProcedureCatalogItem[];
  readonly doctors: readonly Doctor[];
  readonly submitting: boolean;
  readonly onClose: () => void;
  readonly onRecord: (input: NewProcedureInput) => void;
}

/**
 * Everything on one tooth: what has been done to it, what it looks like, and —
 * for the roles ROLES.md allows — what it cost and what was imaged.
 *
 * The history comes from `GET /patients/:id/teeth/:fdi`, which already
 * aggregates procedures, marks and attachments server-side. Prices and
 * attachments are gated here as well as there: the API is the boundary, this is
 * so a role never sees a control it would only be refused.
 */
export function ToothPanel({
  patientId,
  tooth,
  summary,
  role,
  catalog,
  doctors,
  submitting,
  onClose,
  onRecord,
}: ToothPanelProps): JSX.Element {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);

  const { data, isPending, isError } = useToothHistory(patientId, tooth);

  const showPrices = canSeePrices(role);
  const showAttachments = canSeeAttachments(role);
  const canAdd = canRecordProcedure(role);

  const catalogNames = new Map(catalog.map((item) => [item.id, item.nameAr]));

  return (
    <Drawer
      open={tooth !== null}
      onOpenChange={(open) => {
        if (!open) {
          setAdding(false);
          onClose();
        }
      }}
      descriptionKey="chart.panel.description"
      title={
        <span className="flex items-center gap-2">
          {t('chart.panel.title')}
          <span dir="ltr" className="font-mono">
            {tooth}
          </span>
          {summary && <Badge tone="neutral">{t(toothStateLabelKey(summary.state))}</Badge>}
        </span>
      }
    >
      <div className="flex flex-col gap-6">
        {/*
          The intro card: what this tooth *is*, before the list of what has
          been done to it. It floats on a tinted ground inside the drawer —
          the same "detail card over a surface" idea used elsewhere — so the
          summary reads as a distinct answer rather than as the first row of
          the history below it.
        */}
        {summary && (
          <section className="rounded-card bg-canvas p-4 shadow-float">
            <div className="flex items-center gap-3">
              <span
                dir="ltr"
                className="inline-flex size-12 shrink-0 items-center justify-center rounded-panel bg-surface font-mono text-lg font-semibold text-ink shadow-pill"
              >
                {tooth}
              </span>

              <div className="min-w-0">
                <p className="text-label text-ink-muted">{t('chart.panel.title')}</p>
                <p className="text-value font-semibold text-ink">
                  {t(toothStateLabelKey(summary.state))}
                </p>
              </div>

              <Badge className="ms-auto" tone={summary.surfaces.length > 0 ? 'info' : 'neutral'}>
                {t('chart.panel.procedureCount', { count: data?.procedures.length ?? 0 })}
              </Badge>
            </div>

            {summary.surfaces.length > 0 && (
              <div className="mt-4 border-t border-line pt-4">
                <h3 className="mb-2 text-label font-medium text-ink-muted">
                  {t('chart.panel.surfaces')}
                </h3>
                <SurfaceSelector value={summary.surfaces} readOnly />
              </div>
            )}
          </section>
        )}

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-value font-semibold text-ink">{t('chart.panel.history')}</h3>

            {canAdd && !adding && (
              <Button
                icon={<Icon name="plus" />}
                size="sm"
                variant="secondary"
                onClick={() => setAdding(true)}
              >
                {t('chart.panel.addProcedure')}
              </Button>
            )}
          </div>

          {isPending && <p className="text-value text-ink-muted">{t('common.loading')}</p>}
          {isError && <p className="text-value text-danger-600">{t('errors.generic')}</p>}

          {data && data.procedures.length === 0 && (
            <EmptyState icon="tooth" title="chart.panel.noProcedures" />
          )}

          {data && data.procedures.length > 0 && (
            <ol className="flex flex-col gap-2">
              {[...data.procedures]
                .sort((a, b) => b.performedAt.localeCompare(a.performedAt))
                .map((procedure) => (
                  <ProcedureRow
                    key={procedure.id}
                    procedure={procedure}
                    name={catalogNames.get(procedure.procedureId)}
                    doctorName={
                      doctors.find((doctor) => doctor.id === procedure.doctorId)?.user.name
                    }
                    showPrice={showPrices}
                  />
                ))}
            </ol>
          )}
        </section>

        {adding && tooth !== null && (
          <section className="rounded-panel bg-sunken p-4">
            <h3 className="mb-3 text-value font-semibold text-ink">
              {t('chart.panel.addProcedure')}
            </h3>
            <AddProcedureForm
              tooth={tooth}
              role={role}
              catalog={catalog}
              doctors={doctors}
              submitting={submitting}
              onCancel={() => setAdding(false)}
              onSubmit={(input) => {
                setAdding(false);
                onRecord(input);
              }}
            />
          </section>
        )}

        {showAttachments && (
          <section className="flex flex-col gap-2">
            <h3 className="text-value font-semibold text-ink">{t('chart.panel.attachments')}</h3>
            {data && <ToothAttachments attachments={data.attachments} />}
          </section>
        )}
      </div>
    </Drawer>
  );
}

function ProcedureRow({
  procedure,
  name,
  doctorName,
  showPrice,
}: {
  procedure: PerformedProcedure;
  name: string | undefined;
  doctorName: string | undefined;
  showPrice: boolean;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <li className="rounded-panel bg-canvas p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-value font-medium text-ink">
          {name ?? t('chart.panel.procedure')}
        </span>
        <Badge tone={statusTone(procedure.status)}>
          {t(`chart.procedureStatus.${procedure.status}`)}
        </Badge>
      </div>

      <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-label text-ink-muted">
        <div className="flex gap-1">
          <dt>{t('chart.panel.date')}:</dt>
          <dd dir="ltr">{formatDate(procedure.performedAt)}</dd>
        </div>

        {doctorName && (
          <div className="flex gap-1">
            <dt>{t('chart.panel.doctor')}:</dt>
            <dd>{doctorName}</dd>
          </div>
        )}

        {/* ROLES.md: financial detail is not shown to roles without billing access. */}
        {showPrice && (
          <div className="flex gap-1">
            <dt>{t('chart.panel.price')}:</dt>
            <dd dir="ltr">{procedure.price}</dd>
          </div>
        )}

        {showPrice && procedure.discount !== '0.00' && (
          <div className="flex gap-1">
            <dt>{t('chart.panel.discount')}:</dt>
            <dd dir="ltr">{procedure.discount}</dd>
          </div>
        )}
      </dl>
    </li>
  );
}

function statusTone(status: PerformedProcedure['status']): 'success' | 'warning' | 'neutral' {
  if (status === 'done') {
    return 'success';
  }

  return status === 'in_progress' ? 'warning' : 'neutral';
}
