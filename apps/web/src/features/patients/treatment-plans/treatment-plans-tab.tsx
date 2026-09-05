import {
  TREATMENT_PLAN_ITEM_STATUS,
  TREATMENT_PLAN_STATUSES,
  type PatientClinicalView,
  type TreatmentPlan,
  type TreatmentPlanItem,
} from '@clinic/shared';
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Badge,
  Button,
  EmptyState,
  EntityCard,
  Icon,
  SegmentedControl,
  Select,
  useToast,
} from '@web/components/ui';
import { useSession } from '@web/features/auth/session';
import { useClinic } from '@web/features/clinic/queries';
import { useDoctors } from '@web/features/doctors/queries';
import { canSeePrices } from '@web/features/patients/permissions';
import {
  useAddPlanItem,
  useConvertPlanItem,
  useCreateTreatmentPlan,
  useProcedureCatalog,
  useTreatmentPlans,
  useUpdatePlanItem,
} from '@web/features/patients/queries';
import { PlanPrint } from '@web/features/patients/treatment-plans/plan-print';
import { planRemaining, planTotal } from '@web/features/patients/treatment-plans/plan-total';
import { errorMessageKey } from '@web/lib/api-error';

/**
 * The plan-status filter, with `all` in front of the real statuses.
 *
 * Built from the shared enum rather than typed out, so a status added to the
 * state machine appears here on the next build instead of being quietly
 * unfilterable.
 */
const PLAN_FILTERS = ['all', ...TREATMENT_PLAN_STATUSES] as const;
type PlanFilter = (typeof PLAN_FILTERS)[number];

/**
 * Treatment plans: what has been quoted, in the order it will be carried out.
 *
 * A plan item is a quote and stays one. Converting it creates a performed
 * procedure through the existing endpoint — the estimate is left alone, so the
 * quote and what was actually charged remain separately readable, and the
 * conversion is one-way (the API enforces that with a unique index).
 */
export function TreatmentPlansTab({
  patientId,
  patient,
}: {
  patientId: string;
  patient: PatientClinicalView | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();
  const toast = useToast();

  const plans = useTreatmentPlans(patientId);
  const catalog = useProcedureCatalog();
  const doctors = useDoctors({ limit: 100 });
  const clinic = useClinic();

  const createPlan = useCreateTreatmentPlan(patientId);
  const addItem = useAddPlanItem(patientId);
  const updateItem = useUpdatePlanItem(patientId);
  const convertItem = useConvertPlanItem(patientId);

  const [statusFilter, setStatusFilter] = useState<PlanFilter>('all');
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newItemProcedure, setNewItemProcedure] = useState('');
  /** Which plan the print sheet is currently rendering. */
  const [printing, setPrinting] = useState<TreatmentPlan | null>(null);

  const showPrices = user ? canSeePrices(user.role) : false;
  const currency = clinic.data?.currency ?? '';

  const catalogName = (id: string): string =>
    catalog.data?.find((item) => item.id === id)?.nameAr ?? t('chart.panel.procedure');

  const doctorName = (id: string): string =>
    doctors.data?.items.find((doctor) => doctor.id === id)?.user.name ?? '—';

  if (plans.isPending) {
    return <p className="text-value text-ink-muted">{t('common.loading')}</p>;
  }

  if (plans.isError) {
    return <EmptyState title="errors.generic" hint="treatmentPlans.loadFailed" />;
  }

  const ordered = [...(plans.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const visible = ordered.filter((plan) => statusFilter === 'all' || plan.status === statusFilter);

  const handleCreatePlan = async (): Promise<void> => {
    const doctorId = doctors.data?.items[0]?.id;

    if (!doctorId) {
      toast.error('treatmentPlans.needsDoctor');
      return;
    }

    try {
      await createPlan.mutateAsync({
        patientId,
        doctorId,
        title: t('treatmentPlans.defaultTitle'),
        status: 'draft',
        items: [],
      });
      toast.success('treatmentPlans.created');
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const handleAddItem = async (planId: string): Promise<void> => {
    if (!newItemProcedure) {
      return;
    }

    try {
      await addItem.mutateAsync({
        planId,
        body: { procedureId: newItemProcedure, sortOrder: 0 },
      });
      setNewItemProcedure('');
      setAddingTo(null);
      toast.success('treatmentPlans.itemAdded');
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const handleConvert = async (item: TreatmentPlanItem): Promise<void> => {
    try {
      await convertItem.mutateAsync(item.id);
      toast.success('treatmentPlans.converted');
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const handleCancelItem = async (item: TreatmentPlanItem): Promise<void> => {
    try {
      await updateItem.mutateAsync({ itemId: item.id, body: { status: 'cancelled' } });
      toast.success('treatmentPlans.itemCancelled');
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const print = (plan: TreatmentPlan): void => {
    setPrinting(plan);
    // Let the sheet render before the browser snapshots the page.
    requestAnimationFrame(() => window.print());
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl
            label={t('treatmentPlans.filterByStatus')}
            value={statusFilter}
            onChange={setStatusFilter}
            options={PLAN_FILTERS.map((filter) => ({
              value: filter,
              label: filter === 'all' ? t('common.all') : t(`treatmentPlans.planStatus.${filter}`),
              count: ordered.filter((plan) => filter === 'all' || plan.status === filter).length,
            }))}
          />

          <Button
            size="sm"
            onClick={() => void handleCreatePlan()}
            icon={<Icon name="plus" className="size-4" />}
          >
            {t('treatmentPlans.create')}
          </Button>
        </div>

        {ordered.length === 0 && (
          <EmptyState title="treatmentPlans.empty" hint="treatmentPlans.emptyHint" />
        )}

        {ordered.length > 0 && visible.length === 0 && (
          <EmptyState title="treatmentPlans.noneInFilter" hint="treatmentPlans.noneInFilterHint" />
        )}

        {visible.map((plan) => {
          const items = [...(plan.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
          // Progress is work *done*: an item that became a real procedure.
          // Cancelled items are neither done nor outstanding, so they leave
          // the denominator rather than counting as unfinished forever.
          const live = items.filter((item) => item.status !== TREATMENT_PLAN_ITEM_STATUS.CANCELLED);
          const converted = live.filter(
            (item) => item.status === TREATMENT_PLAN_ITEM_STATUS.CONVERTED,
          );

          return (
            <EntityCard
              key={plan.id}
              icon="clipboard"
              title={plan.title}
              subtitle={`${t('visits.doctor')}: ${doctorName(plan.doctorId)}`}
              status={{
                label: t(`treatmentPlans.planStatus.${plan.status}`),
                tone: planTone(plan.status),
              }}
              {...(live.length > 0 && {
                progress: {
                  value: converted.length,
                  total: live.length,
                  label: t('treatmentPlans.progressLabel'),
                  caption: t('treatmentPlans.progressCaption', {
                    done: converted.length,
                    total: live.length,
                  }),
                },
              })}
              {...(showPrices &&
                items.length > 0 && {
                  meta: [
                    {
                      label: t('treatmentPlans.total'),
                      value: `${planTotal(items)} ${currency}`,
                      ltr: true,
                    },
                    {
                      label: t('treatmentPlans.remaining'),
                      value: `${planRemaining(items)} ${currency}`,
                      ltr: true,
                    },
                  ],
                })}
              action={{
                label: t('treatmentPlans.print'),
                icon: 'file',
                onClick: () => print(plan),
              }}
            >
              {items.length === 0 ? (
                <p className="mt-3 text-label text-ink-muted">{t('treatmentPlans.noItems')}</p>
              ) : (
                <ol className="mt-3 flex flex-col gap-1.5">
                  {items.map((item, index) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-inset px-3 py-2"
                    >
                      <span className="flex items-center gap-2 text-value text-ink">
                        <span className="text-label text-ink-subtle" dir="ltr">
                          {index + 1}
                        </span>
                        {catalogName(item.procedureId)}
                      </span>

                      <span className="flex flex-wrap items-center gap-2">
                        {showPrices && (
                          <span className="text-value text-ink-muted" dir="ltr">
                            {item.estimatedPrice} {currency}
                          </span>
                        )}

                        <Badge tone={itemTone(item.status)}>
                          {t(`treatmentPlans.itemStatus.${item.status}`)}
                        </Badge>

                        {item.status === TREATMENT_PLAN_ITEM_STATUS.PLANNED && (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={convertItem.isPending}
                              onClick={() => void handleConvert(item)}
                            >
                              {t('treatmentPlans.convert')}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void handleCancelItem(item)}
                            >
                              {t('treatmentPlans.cancelItem')}
                            </Button>
                          </>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              )}

              <div className="mt-4">
                {addingTo === plan.id ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-56 flex-1">
                      <label
                        htmlFor={`add-item-${plan.id}`}
                        className="mb-1 block text-label text-ink-muted"
                      >
                        {t('chart.panel.procedure')}
                      </label>
                      <Select
                        id={`add-item-${plan.id}`}
                        value={newItemProcedure}
                        onChange={(event) => setNewItemProcedure(event.target.value)}
                        placeholder={t('chart.panel.selectProcedure')}
                        options={(catalog.data ?? []).map((entry) => ({
                          value: entry.id,
                          label: entry.nameAr,
                        }))}
                      />
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={addItem.isPending || !newItemProcedure}
                      onClick={() => void handleAddItem(plan.id)}
                    >
                      {t('common.save')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setAddingTo(null)}>
                      {t('common.cancel')}
                    </Button>
                  </div>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => setAddingTo(plan.id)}>
                    {t('treatmentPlans.addItem')}
                  </Button>
                )}
              </div>
            </EntityCard>
          );
        })}
      </div>

      {/* Rendered only while printing; `print.css` reveals it. */}
      {printing && (
        <div className="print-root">
          <PlanPrint
            plan={printing}
            clinic={clinic.data}
            patientName={patient?.fullName ?? ''}
            fileNumber={patient?.fileNumber ?? ''}
            catalog={catalog.data ?? []}
            doctorName={doctorName(printing.doctorId)}
          />
        </div>
      )}
    </div>
  );
}

function planTone(status: TreatmentPlan['status']): 'neutral' | 'info' | 'success' | 'danger' {
  switch (status) {
    case 'active':
      return 'info';
    case 'completed':
      return 'success';
    case 'cancelled':
      return 'danger';
    default:
      return 'neutral';
  }
}

function itemTone(status: TreatmentPlanItem['status']): 'neutral' | 'success' | 'danger' {
  switch (status) {
    case TREATMENT_PLAN_ITEM_STATUS.CONVERTED:
      return 'success';
    case TREATMENT_PLAN_ITEM_STATUS.CANCELLED:
      return 'danger';
    default:
      return 'neutral';
  }
}
