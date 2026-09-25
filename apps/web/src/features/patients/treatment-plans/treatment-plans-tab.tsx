import {
  TREATMENT_PLAN_ITEM_STATUS,
  TREATMENT_PLAN_STATUSES,
  type PatientClinicalView,
  type TreatmentPlan,
  type TreatmentPlanItem,
} from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Badge,
  Button,
  EmptyState,
  EntityCard,
  Icon,
  Ltr,
  MenuItem,
  Money,
  RowMenu,
  SegmentedControl,
  useConfirm,
  usePersonName,
  useTabParam,
  useToast,
} from "@clinic/ui";
import { SkeletonCard, SkeletonStatus } from "@clinic/ui/components/skeleton";
import { useSession } from "@web/features/auth/session";
import { useClinic } from "@web/features/clinic/queries";
import { useDoctors } from "@web/features/doctors/queries";
import {
  canAddPlanItem,
  canConvertPlanItem,
  canCreatePlan,
  canDeletePlan,
  canDeletePlanItem,
  canEditPlan,
  canEditPlanItem,
  canSeePrices,
} from "@web/features/patients/permissions";
import {
  useConvertPlanItem,
  useDeletePlanItem,
  useDeleteTreatmentPlan,
  useProcedureCatalog,
  useTreatmentPlans,
  useUpdatePlanItem,
} from "@web/features/patients/queries";
import { PlanFormModal } from "@web/features/patients/treatment-plans/plan-form-modal";
import { PlanItemFormModal } from "@web/features/patients/treatment-plans/plan-item-form-modal";
import { PlanPrint } from "@web/features/patients/treatment-plans/plan-print";
import { planRemaining, planTotal } from "@web/features/patients/treatment-plans/plan-total";
import { errorMessageKey } from "@web/lib/api-error";
import { useDelayedLoading } from "@clinic/ui/lib/use-delayed-loading";

const PLAN_FILTERS = ["all", ...TREATMENT_PLAN_STATUSES] as const;
type PlanFilter = (typeof PLAN_FILTERS)[number];

type ItemEditor = { planId: string; nextSortOrder: number; item: TreatmentPlanItem | null };

// A plan item is a quote and stays one: converting creates a procedure and leaves the estimate
// alone, one way, which the API enforces with a unique index.
export function TreatmentPlansTab({
  patientId,
  patient,
}: {
  patientId: string;
  patient: PatientClinicalView | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const { user, can } = useSession();
  const toast = useToast();

  const plans = useTreatmentPlans(patientId);
  const showSkeleton = useDelayedLoading(plans.isPending);
  const catalog = useProcedureCatalog();
  const doctors = useDoctors({ limit: 100 });
  const clinic = useClinic();

  const updateItem = useUpdatePlanItem(patientId);
  const convertItem = useConvertPlanItem(patientId);
  const deletePlan = useDeleteTreatmentPlan(patientId);
  const deleteItem = useDeletePlanItem(patientId);
  const { confirm, dialog } = useConfirm("treatment-plans-confirm-delete");

  // `?plan=accepted` is what a dentist pastes and what survives a refresh. Its own parameter, since
  // the file's tab strip already owns `tab`.
  const [statusFilter, setStatusFilter] = useTabParam<PlanFilter>("plan", PLAN_FILTERS, "all");
  const [planEditor, setPlanEditor] = useState<{ plan: TreatmentPlan | null } | null>(null);
  const [itemEditor, setItemEditor] = useState<ItemEditor | null>(null);
  const [printing, setPrinting] = useState<TreatmentPlan | null>(null);

  const showPrices = user ? canSeePrices(user.role) : false;
  const currency = clinic.data?.currency ?? "";
  const doctorList = doctors.data?.items ?? [];

  const mayCreate = canCreatePlan(can);
  const mayEdit = canEditPlan(can);
  const mayDelete = canDeletePlan(can);
  const mayAddItem = canAddPlanItem(can);
  const mayEditItem = canEditPlanItem(can);
  const mayDeleteItem = canDeletePlanItem(can);
  const mayConvert = canConvertPlanItem(can);

  const catalogName = (id: string): string => {
    const entry = catalog.data?.find((item) => item.id === id);
    return entry ? entry.name : t("chart.panel.procedure");
  };

  const displayName = usePersonName();
  const doctorName = (id: string): string =>
    displayName(doctorList.find((doctor) => doctor.id === id)?.user.name) || "—";

  if (showSkeleton) {
    return (
      <div data-testid="treatment-plans-loading" className="flex flex-col gap-3">
        <SkeletonStatus />
        <SkeletonCard count={2} />
      </div>
    );
  }

  if (plans.isPending) {
    return <></>;
  }

  if (plans.isError) {
    return (
      <EmptyState
        icon="alert"
        data-testid="treatment-plans-error"
        title="errors.generic"
        hint="treatmentPlans.loadFailed"
      />
    );
  }

  const ordered = [...(plans.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const visible = ordered.filter((plan) => statusFilter === "all" || plan.status === statusFilter);

  const run = async (action: () => Promise<unknown>, success: string): Promise<void> => {
    try {
      await action();
      toast.success(success);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const removing = (action: () => Promise<unknown>, success: string) => async () => {
    try {
      await action();
      toast.success(success);
    } catch (error) {
      toast.error(errorMessageKey(error));
      throw error;
    }
  };

  const handleDeletePlan = (plan: TreatmentPlan): void =>
    confirm({
      title: "treatmentPlans.confirmDelete.title",
      titleValues: { title: plan.title },
      consequences: [t("treatmentPlans.confirmDelete.consequence")],
      onConfirm: removing(() => deletePlan.mutateAsync(plan.id), "treatmentPlans.deleted"),
    });

  const handleDeleteItem = (item: TreatmentPlanItem): void =>
    confirm({
      title: "treatmentPlans.confirmDeleteItem",
      titleValues: { name: catalogName(item.procedureId) },
      onConfirm: removing(() => deleteItem.mutateAsync(item.id), "treatmentPlans.itemDeleted"),
    });

  const handleConvert = (item: TreatmentPlanItem): void => {
    void run(() => convertItem.mutateAsync(item.id), "treatmentPlans.converted");
  };

  const handleCancelItem = (item: TreatmentPlanItem): void => {
    void run(
      () => updateItem.mutateAsync({ itemId: item.id, body: { status: "cancelled" } }),
      "treatmentPlans.itemCancelled",
    );
  };

  const print = (plan: TreatmentPlan): void => {
    setPrinting(plan);
    // Let the sheet render before the browser snapshots the page.
    requestAnimationFrame(() => window.print());
  };

  return (
    <div data-testid="treatment-plans-tab" className="flex flex-col gap-4">
      {dialog}
      <p data-testid="treatment-plans-about" className="text-value text-ink-muted">
        {t("treatmentPlans.about")}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          data-testid="treatment-plans-filter"
          label={t("treatmentPlans.filterByStatus")}
          value={statusFilter}
          onChange={setStatusFilter}
          options={PLAN_FILTERS.map((filter) => ({
            value: filter,
            label: filter === "all" ? t("common.all") : t(`treatmentPlans.planStatus.${filter}`),
            count: ordered.filter((plan) => filter === "all" || plan.status === filter).length,
          }))}
        />

        {mayCreate && (
          <Button
            data-testid="treatment-plans-create"
            onClick={() => setPlanEditor({ plan: null })}
            icon={<Icon name="plus" />}
          >
            {t("treatmentPlans.create")}
          </Button>
        )}
      </div>

      {ordered.length === 0 && (
        <EmptyState
          icon="clipboard"
          data-testid="treatment-plans-empty"
          title="treatmentPlans.empty"
          hint="treatmentPlans.emptyHint"
        />
      )}

      {ordered.length > 0 && visible.length === 0 && (
        <EmptyState
          icon="search"
          data-testid="treatment-plans-none-in-filter"
          title="treatmentPlans.noneInFilter"
          hint="treatmentPlans.noneInFilterHint"
        />
      )}

      {visible.map((plan) => {
        const items = [...(plan.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
        const live = items.filter((item) => item.status !== TREATMENT_PLAN_ITEM_STATUS.CANCELLED);
        const converted = live.filter(
          (item) => item.status === TREATMENT_PLAN_ITEM_STATUS.CONVERTED,
        );
        const nextSortOrder = items.reduce((max, item) => Math.max(max, item.sortOrder + 1), 0);

        return (
          <EntityCard
            key={plan.id}
            data-testid={`treatment-plan-${plan.id}`}
            icon="clipboard"
            title={plan.title}
            subtitle={`${t("treatmentPlans.responsibleDoctor")}: ${doctorName(plan.doctorId)}`}
            status={{
              label: t(`treatmentPlans.planStatus.${plan.status}`),
              tone: planTone(plan.status),
            }}
            menu={
              <RowMenu
                label={t("treatmentPlans.menu")}
                data-testid={`treatment-plan-${plan.id}-menu`}
              >
                {mayEdit && (
                  <MenuItem
                    icon="edit"
                    data-testid={`treatment-plan-${plan.id}-edit`}
                    onSelect={() => setPlanEditor({ plan })}
                  >
                    {t("common.edit")}
                  </MenuItem>
                )}
                <MenuItem
                  icon="file"
                  data-testid={`treatment-plan-${plan.id}-print`}
                  onSelect={() => print(plan)}
                >
                  {t("treatmentPlans.print")}
                </MenuItem>
                {mayDelete && (
                  <MenuItem
                    icon="trash"
                    tone="danger"
                    data-testid={`treatment-plan-${plan.id}-delete`}
                    onSelect={() => handleDeletePlan(plan)}
                  >
                    {t("common.delete")}
                  </MenuItem>
                )}
              </RowMenu>
            }
            {...(live.length > 0 && {
              progress: {
                value: converted.length,
                total: live.length,
                label: t("treatmentPlans.progressLabel"),
                caption: t("treatmentPlans.progressCaption", {
                  done: converted.length,
                  total: live.length,
                }),
              },
            })}
            {...(showPrices &&
              items.length > 0 && {
                meta: [
                  {
                    label: t("treatmentPlans.total"),
                    value: <Money amount={planTotal(items)} currency={currency} />,
                  },
                  {
                    label: t("treatmentPlans.remaining"),
                    value: <Money amount={planRemaining(items)} currency={currency} />,
                  },
                ],
              })}
          >
            {plan.notes && (
              <p className="mt-3 whitespace-pre-wrap text-value text-ink-muted">{plan.notes}</p>
            )}

            {items.length === 0 ? (
              <p data-testid="treatment-plan-no-items" className="mt-3 text-value text-ink-muted">
                {t("treatmentPlans.noItems")}
              </p>
            ) : (
              <ol data-testid="treatment-plan-items" className="mt-3 flex flex-col gap-1.5">
                {items.map((item, index) => {
                  const planned = item.status === TREATMENT_PLAN_ITEM_STATUS.PLANNED;
                  const hasMenu = planned && (mayConvert || mayEditItem || mayDeleteItem);

                  return (
                    <li
                      key={item.id}
                      data-testid={`treatment-plan-item-${item.id}`}
                      className="flex items-center gap-3 rounded-panel bg-canvas px-3 py-2"
                    >
                      <Ltr className="text-label text-ink-subtle">{index + 1}</Ltr>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-value text-ink">
                          {catalogName(item.procedureId)}
                        </p>
                        <p
                          data-testid="treatment-plan-item-performer"
                          className="truncate text-meta text-ink-muted"
                        >
                          {t("treatmentPlans.performedBy", {
                            name: doctorName(item.performerDoctorId ?? plan.doctorId),
                          })}
                        </p>
                      </div>

                      {showPrices && (
                        <Money
                          amount={item.estimatedPrice}
                          currency={currency}
                          className="text-value text-ink-muted"
                        />
                      )}

                      <Badge tone={itemTone(item.status)} data-testid="treatment-plan-item-status">
                        {t(`treatmentPlans.itemStatus.${item.status}`)}
                      </Badge>

                      {hasMenu && (
                        <RowMenu
                          label={t("treatmentPlans.itemMenu")}
                          data-testid={`treatment-plan-item-${item.id}-menu`}
                        >
                          {mayConvert && (
                            <MenuItem
                              icon="check"
                              data-testid="treatment-plan-item-convert"
                              onSelect={() => handleConvert(item)}
                            >
                              {t("treatmentPlans.convert")}
                            </MenuItem>
                          )}
                          {mayEditItem && (
                            <MenuItem
                              icon="edit"
                              data-testid="treatment-plan-item-edit"
                              onSelect={() =>
                                setItemEditor({ planId: plan.id, nextSortOrder, item })
                              }
                            >
                              {t("common.edit")}
                            </MenuItem>
                          )}
                          {mayEditItem && (
                            <MenuItem
                              icon="x"
                              data-testid="treatment-plan-item-cancel"
                              onSelect={() => handleCancelItem(item)}
                            >
                              {t("treatmentPlans.cancelItem")}
                            </MenuItem>
                          )}
                          {mayDeleteItem && (
                            <MenuItem
                              icon="trash"
                              tone="danger"
                              data-testid="treatment-plan-item-delete"
                              onSelect={() => handleDeleteItem(item)}
                            >
                              {t("common.delete")}
                            </MenuItem>
                          )}
                        </RowMenu>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}

            {mayAddItem && (
              <Button
                icon={<Icon name="plus" />}
                variant="secondary"
                className="mt-4 self-start"
                data-testid="treatment-plan-add-item"
                onClick={() => setItemEditor({ planId: plan.id, nextSortOrder, item: null })}
              >
                {t("treatmentPlans.addItem")}
              </Button>
            )}
          </EntityCard>
        );
      })}

      <PlanFormModal
        open={planEditor !== null}
        onOpenChange={(open) => !open && setPlanEditor(null)}
        patientId={patientId}
        doctors={doctorList}
        plan={planEditor?.plan ?? null}
      />

      <PlanItemFormModal
        open={itemEditor !== null}
        onOpenChange={(open) => !open && setItemEditor(null)}
        patientId={patientId}
        planId={itemEditor?.planId ?? ""}
        nextSortOrder={itemEditor?.nextSortOrder ?? 0}
        catalog={catalog.data ?? []}
        doctors={doctorList}
        showPrices={showPrices}
        item={itemEditor?.item ?? null}
      />

      {/* Rendered only while printing; `print.css` reveals it. */}
      {printing && (
        <div data-testid="treatment-plan-print-root" className="print-root">
          <PlanPrint
            plan={printing}
            clinic={clinic.data}
            patientName={patient?.fullName ?? ""}
            fileNumber={patient?.fileNumber ?? ""}
            catalog={catalog.data ?? []}
            doctorName={doctorName(printing.doctorId)}
          />
        </div>
      )}
    </div>
  );
}

function planTone(status: TreatmentPlan["status"]): "neutral" | "info" | "success" | "danger" {
  switch (status) {
    case "active":
      return "info";
    case "completed":
      return "success";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

function itemTone(status: TreatmentPlanItem["status"]): "neutral" | "success" | "danger" {
  switch (status) {
    case TREATMENT_PLAN_ITEM_STATUS.CONVERTED:
      return "success";
    case TREATMENT_PLAN_ITEM_STATUS.CANCELLED:
      return "danger";
    default:
      return "neutral";
  }
}
