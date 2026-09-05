import {
  TREATMENT_PLAN_ITEM_STATUS,
  type PatientClinicalView,
  type TreatmentPlan,
  type TreatmentPlanItem,
} from '@clinic/shared';
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, Button, EmptyState, Select, useToast } from '@web/components/ui';
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
    return <p className="text-sm text-gray-500">{t('common.loading')}</p>;
  }

  if (plans.isError) {
    return <EmptyState title="errors.generic" hint="treatmentPlans.loadFailed" />;
  }

  const ordered = [...(plans.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

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
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-800">
            {t('treatmentPlans.count', { count: ordered.length })}
          </h2>
          <Button size="sm" onClick={() => void handleCreatePlan()}>
            {t('treatmentPlans.create')}
          </Button>
        </div>

        {ordered.length === 0 && (
          <EmptyState title="treatmentPlans.empty" hint="treatmentPlans.emptyHint" />
        )}

        {ordered.map((plan) => {
          const items = [...(plan.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

          return (
            <article key={plan.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <header className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{plan.title}</h3>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {t('visits.doctor')}: {doctorName(plan.doctorId)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge tone={planTone(plan.status)}>
                    {t(`treatmentPlans.planStatus.${plan.status}`)}
                  </Badge>
                  <Button variant="secondary" size="sm" onClick={() => print(plan)}>
                    {t('treatmentPlans.print')}
                  </Button>
                </div>
              </header>

              {items.length === 0 ? (
                <p className="mt-3 text-xs text-gray-500">{t('treatmentPlans.noItems')}</p>
              ) : (
                <ol className="mt-3 flex flex-col gap-1.5">
                  {items.map((item, index) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-gray-50 px-3 py-2"
                    >
                      <span className="flex items-center gap-2 text-sm text-gray-900">
                        <span className="text-xs text-gray-400" dir="ltr">
                          {index + 1}
                        </span>
                        {catalogName(item.procedureId)}
                      </span>

                      <span className="flex flex-wrap items-center gap-2">
                        {showPrices && (
                          <span className="text-sm text-gray-600" dir="ltr">
                            {item.estimatedPrice} {currency}
                          </span>
                        )}

                        <Badge tone={itemTone(item.status)}>
                          {t(`treatmentPlans.itemStatus.${item.status}`)}
                        </Badge>

                        {item.status === TREATMENT_PLAN_ITEM_STATUS.PLANNED && (
                          <>
                            <Button
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

              {showPrices && items.length > 0 && (
                <dl className="mt-3 flex flex-wrap justify-end gap-x-6 gap-y-1 border-t border-gray-100 pt-3 text-sm">
                  <div className="flex gap-2">
                    <dt className="text-gray-500">{t('treatmentPlans.total')}</dt>
                    <dd className="font-semibold text-gray-900" dir="ltr">
                      {planTotal(items)} {currency}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-gray-500">{t('treatmentPlans.remaining')}</dt>
                    <dd className="font-medium text-gray-700" dir="ltr">
                      {planRemaining(items)} {currency}
                    </dd>
                  </div>
                </dl>
              )}

              <div className="mt-3 border-t border-gray-100 pt-3">
                {addingTo === plan.id ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-56 flex-1">
                      <label
                        htmlFor={`add-item-${plan.id}`}
                        className="mb-1 block text-xs text-gray-600"
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
            </article>
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
