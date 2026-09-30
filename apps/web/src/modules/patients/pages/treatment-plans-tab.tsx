import {
  PERFORMED_PROCEDURE_STATUS,
  type PatientClinicalView,
  type PerformedProcedure,
  type TreatmentPlan,
} from "@clinic/shared";
import { useMemo, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Badge,
  Button,
  EmptyState,
  EntityCard,
  Icon,
  Ltr,
  MenuItem,
  Modal,
  Money,
  NotePreview,
  RowMenu,
  SegmentedControl,
  useConfirm,
  usePersonName,
  useTabParam,
  useToast,
} from "@clinic/ui";
import { SkeletonCard, SkeletonStatus } from "@clinic/ui/components/skeleton";
import { useSession } from "@web/shared/providers/session";
import { useClinic } from "@web/shared/queries/clinic";
import { useDoctors } from "@web/shared/queries/doctors";
import {
  canCreatePlan,
  canDeletePlan,
  canEditPlan,
  canRecordProcedure,
  canSeePrices,
} from "@web/shared/permissions/patients";
import {
  useDeleteTreatmentPlan,
  usePatientProcedures,
  useProcedureCatalog,
  useTreatmentPlans,
} from "@web/modules/patients/queries";
import { PlanFormModal } from "@web/modules/patients/components/treatment-plans/plan-form-modal";
import { PlanPrint } from "@web/modules/patients/components/treatment-plans/plan-print";
import { TreatmentsPanel } from "@web/modules/patients/components/treatments/treatments-panel";
import { errorMessageKey } from "@web/shared/lib/api-error";
import { formatDate } from "@web/shared/lib/format";
import { useDelayedLoading } from "@clinic/ui/lib/use-delayed-loading";
import { TREATMENT_PLAN_FILTERS } from "@web/modules/patients/constants";

type PlanFilter = (typeof TREATMENT_PLAN_FILTERS)[number];

type Treating = { readonly plan: TreatmentPlan; readonly adding: boolean };

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
  const treatments = usePatientProcedures(patientId);
  const showSkeleton = useDelayedLoading(plans.isPending);
  const catalog = useProcedureCatalog();
  const doctors = useDoctors({ limit: 100 });
  const clinic = useClinic();
  const deletePlan = useDeleteTreatmentPlan(patientId);
  const { confirm, dialog } = useConfirm("treatment-plans-confirm-delete");

  const [statusFilter, setStatusFilter] = useTabParam<PlanFilter>(
    "plan",
    TREATMENT_PLAN_FILTERS,
    "all",
  );
  const [planEditor, setPlanEditor] = useState<{ plan: TreatmentPlan | null } | null>(null);
  const [treating, setTreating] = useState<Treating | null>(null);
  const [printing, setPrinting] = useState<TreatmentPlan | null>(null);

  const showPrices = user ? canSeePrices(user.role) : false;
  const currency = clinic.data?.currency ?? "";
  const doctorList = doctors.data?.items ?? [];
  const mayCreate = canCreatePlan(can);
  const mayEdit = canEditPlan(can);
  const mayDelete = canDeletePlan(can);
  const mayAdd = canRecordProcedure(can);

  const displayName = usePersonName();
  const doctorName = (id: string): string =>
    displayName(doctorList.find((doctor) => doctor.id === id)?.user.name) || "—";

  const byPlan = useMemo(() => {
    const grouped = new Map<string, PerformedProcedure[]>();

    for (const treatment of treatments.data ?? []) {
      if (treatment.treatmentPlanId) {
        grouped.set(treatment.treatmentPlanId, [
          ...(grouped.get(treatment.treatmentPlanId) ?? []),
          treatment,
        ]);
      }
    }

    return grouped;
  }, [treatments.data]);

  if (showSkeleton) {
    return (
      <div data-testid="treatment-plans-loading" className="flex flex-col gap-3">
        <SkeletonStatus />
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonCard count={2} />
        </div>
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

  const handleDeletePlan = (plan: TreatmentPlan): void =>
    confirm({
      title: "treatmentPlans.confirmDelete.title",
      titleValues: { title: plan.title },
      consequences: [t("treatmentPlans.confirmDelete.consequence")],
      onConfirm: async () => {
        try {
          await deletePlan.mutateAsync(plan.id);
          toast.success("treatmentPlans.deleted");
        } catch (error) {
          toast.error(errorMessageKey(error));
          throw error;
        }
      },
    });

  const print = (plan: TreatmentPlan): void => {
    setPrinting(plan);
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
          options={TREATMENT_PLAN_FILTERS.map((filter) => ({
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

      <ol data-testid="treatment-plans-list" className="grid gap-4 md:grid-cols-2">
        {visible.map((plan) => {
          const { summary } = plan;
          const count = (byPlan.get(plan.id) ?? []).length;

          return (
            <li key={plan.id} className="flex min-w-0 flex-col">
              <EntityCard
                data-testid={`treatment-plan-${plan.id}`}
                className="flex-1"
                icon="clipboard"
                title={plan.title}
                subtitle={`${t("treatmentPlans.responsibleDoctor")}: ${doctorName(plan.doctorId)} · ${formatDate(plan.createdAt)}`}
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
                {...(summary.treatments > 0 && {
                  progress: {
                    value: summary.completed,
                    total: summary.treatments,
                    label: t("treatmentPlans.progressLabel"),
                    caption: t("treatmentPlans.progressCaption", {
                      done: summary.completed,
                      total: summary.treatments,
                    }),
                  },
                })}
                {...(showPrices &&
                  summary.treatments > 0 && {
                    meta: [
                      {
                        label: t("treatmentPlans.total"),
                        value: <Money amount={summary.total} currency={currency} />,
                      },
                      {
                        label: t("treatmentPlans.completedAmount"),
                        value: <Money amount={summary.done} currency={currency} />,
                      },
                      {
                        label: t("treatmentPlans.remaining"),
                        value: <Money amount={summary.remaining} currency={currency} />,
                      },
                    ],
                  })}
              >
                <div className="flex flex-1 flex-col">
                  {plan.notes && (
                    <NotePreview
                      data-testid={`treatment-plan-${plan.id}-notes`}
                      className="mt-3"
                      text={plan.notes}
                      title="treatmentPlans.notesOf"
                      titleValues={{ title: plan.title }}
                    />
                  )}

                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                    <Button
                      variant="secondary"
                      icon={<Icon name="list" />}
                      data-testid={`treatment-plan-${plan.id}-treatments`}
                      onClick={() => setTreating({ plan, adding: false })}
                    >
                      {t("treatmentPlans.treatments")}
                      <Badge tone="neutral">
                        <Ltr>{count}</Ltr>
                      </Badge>
                    </Button>

                    {mayAdd && (
                      <Button
                        variant="quiet"
                        icon={<Icon name="plus" />}
                        data-testid={`treatment-plan-${plan.id}-add`}
                        onClick={() => setTreating({ plan, adding: true })}
                      >
                        {t("treatments.add")}
                      </Button>
                    )}
                  </div>
                </div>
              </EntityCard>
            </li>
          );
        })}
      </ol>

      <Modal
        data-testid="treatment-plan-treatments-modal"
        open={treating !== null}
        onOpenChange={(open) => !open && setTreating(null)}
        title="treatmentPlans.treatmentsOf"
        titleValues={{ title: treating?.plan.title ?? "" }}
        size="lg"
      >
        {treating && (
          <TreatmentsPanel
            key={treating.plan.id}
            data-testid="treatment-plan-treatments"
            patientId={patientId}
            treatments={byPlan.get(treating.plan.id) ?? []}
            defaults={{
              treatmentPlanId: treating.plan.id,
              status: PERFORMED_PROCEDURE_STATUS.PLANNED,
              doctorId: treating.plan.doctorId,
            }}
            emptyTitle="treatmentPlans.noItems"
            startAdding={treating.adding}
          />
        )}
      </Modal>

      <PlanFormModal
        open={planEditor !== null}
        onOpenChange={(open) => !open && setPlanEditor(null)}
        patientId={patientId}
        doctors={doctorList}
        plan={planEditor?.plan ?? null}
      />

      {printing && (
        <div data-testid="treatment-plan-print-root" className="print-root">
          <PlanPrint
            plan={printing}
            treatments={byPlan.get(printing.id) ?? []}
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
