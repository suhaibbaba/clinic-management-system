import type { Prescription, PrescriptionItem } from "@clinic/shared";
import { useMemo, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, EmptyState, Icon, Ltr, TotalBadge, useConfirm, useToast } from "@clinic/ui";
import { SkeletonCard, SkeletonStatus } from "@clinic/ui/components/skeleton";
import { useSession } from "@web/features/auth/session";
import { canDeletePrescription, canWritePrescription } from "@web/features/patients/permissions";
import { PrescriptionFormModal } from "@web/features/patients/prescriptions/prescription-form-modal";
import {
  useDeletePrescription,
  usePatientPrescriptions,
  usePatientVisits,
} from "@web/features/patients/queries";
import { errorMessageKey } from "@web/lib/api-error";
import { formatDateTime } from "@web/lib/format";
import { useDelayedLoading } from "@clinic/ui/lib/use-delayed-loading";

export const describeItem = (item: PrescriptionItem): string =>
  [item.dose, item.frequency, item.duration].filter(Boolean).join(" · ");

export function PrescriptionsTab({ patientId }: { readonly patientId: string }): JSX.Element {
  const { t } = useTranslation();
  const { can } = useSession();
  const toast = useToast();
  const mayWrite = canWritePrescription(can);
  const mayDelete = canDeletePrescription(can);
  const remove = useDeletePrescription(patientId);

  const { confirm, dialog } = useConfirm("prescriptions-confirm-delete");

  const destroy = (prescription: Prescription): void =>
    confirm({
      title: "prescriptions.confirmDelete.title",
      consequences: [t("prescriptions.confirmDelete.consequence")],
      onConfirm: async () => {
        try {
          await remove.mutateAsync(prescription.id);
          toast.success("prescriptions.deleted");
        } catch (error) {
          toast.error(errorMessageKey(error));
          throw error;
        }
      },
    });

  const prescriptions = usePatientPrescriptions(patientId);
  const visits = usePatientVisits(patientId);
  const showSkeleton = useDelayedLoading(prescriptions.isPending || visits.isPending);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Prescription | null>(null);

  const orderedVisits = useMemo(
    () => [...(visits.data ?? [])].sort((a, b) => b.visitDate.localeCompare(a.visitDate)),
    [visits.data],
  );

  // Grouped under their visit, newest visit first; a prescription with no visit sorts by its own date.
  const groups = useMemo(() => {
    const visitDate = new Map(orderedVisits.map((visit) => [visit.id, visit.visitDate]));
    const byKey = new Map<string, { date: string | null; items: Prescription[] }>();

    for (const prescription of prescriptions.data ?? []) {
      const key = prescription.visitId ?? `none-${prescription.id}`;
      const date = prescription.visitId ? (visitDate.get(prescription.visitId) ?? null) : null;
      const group = byKey.get(key) ?? { date, items: [] };

      group.items.push(prescription);
      byKey.set(key, group);
    }

    return [...byKey.entries()]
      .map(([key, group]) => ({
        key,
        ...group,
        sortBy: group.date ?? group.items[0]?.createdAt ?? "",
      }))
      .sort((a, b) => b.sortBy.localeCompare(a.sortBy));
  }, [prescriptions.data, orderedVisits]);

  if (showSkeleton) {
    return (
      <div data-testid="prescriptions-tab-loading" className="flex flex-col gap-3">
        <SkeletonStatus />
        <SkeletonCard count={2} />
      </div>
    );
  }

  if (prescriptions.isPending || visits.isPending) {
    return <></>;
  }

  if (prescriptions.isError || visits.isError) {
    return (
      <EmptyState
        icon="alert"
        data-testid="prescriptions-error"
        title="errors.generic"
        hint="prescriptions.loadFailed"
      />
    );
  }

  const noVisits = orderedVisits.length === 0;

  return (
    <div data-testid="prescriptions-tab" className="flex flex-col gap-4">
      {dialog}
      <div className="flex items-center justify-between gap-3">
        <TotalBadge
          data-testid="prescriptions-count"
          total={prescriptions.data.length}
          label="prescriptions.count"
        />
        {mayWrite && !noVisits && (
          <Button
            icon={<Icon name="plus" />}
            size="sm"
            data-testid="prescriptions-create"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            {t("prescriptions.create")}
          </Button>
        )}
      </div>

      {groups.length === 0 && (
        <EmptyState
          icon="clipboard"
          data-testid="prescriptions-empty"
          title={noVisits ? "prescriptions.noVisits" : "prescriptions.empty"}
          hint={noVisits ? "prescriptions.noVisitsHint" : "prescriptions.emptyHint"}
        />
      )}

      <ol data-testid="prescriptions-list" className="flex flex-col gap-4">
        {groups.map((group) => (
          <li
            key={group.key}
            data-testid={`prescriptions-group-${group.key}`}
            className="rounded-card border border-line bg-surface p-4 shadow-card"
          >
            <h3 className="flex items-center gap-1.5 text-value font-medium text-ink">
              {group.date ? (
                <>
                  <span>{t("prescriptions.visit")}</span>
                  <Ltr>{formatDateTime(group.date)}</Ltr>
                </>
              ) : (
                t("prescriptions.withoutVisit")
              )}
            </h3>

            <ul className="mt-3 flex flex-col gap-2">
              {group.items.map((prescription) => (
                <li
                  key={prescription.id}
                  data-testid={`prescription-${prescription.id}`}
                  className="flex items-start justify-between gap-3 rounded-panel bg-canvas px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <ul className="flex flex-col gap-1">
                      {prescription.items.map((item, index) => (
                        <li key={index} className="text-value text-ink">
                          <span className="font-medium">{item.drug}</span>
                          {describeItem(item) && (
                            <span className="text-ink-muted"> · {describeItem(item)}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {prescription.notes && (
                      <p className="mt-1 whitespace-pre-wrap text-label text-ink-muted">
                        {prescription.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {mayWrite && (
                      <Button
                        icon={<Icon name="edit" />}
                        variant="ghost"
                        size="sm"
                        data-testid={`prescription-${prescription.id}-edit`}
                        onClick={() => {
                          setEditing(prescription);
                          setFormOpen(true);
                        }}
                      >
                        {t("common.edit")}
                      </Button>
                    )}
                    {mayDelete && (
                      <Button
                        icon={<Icon name="trash" />}
                        variant="quiet"
                        size="sm"
                        data-testid={`prescription-${prescription.id}-delete`}
                        onClick={() => destroy(prescription)}
                      >
                        {t("common.delete")}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <PrescriptionFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        patientId={patientId}
        visits={orderedVisits}
        prescription={editing}
      />
    </div>
  );
}
