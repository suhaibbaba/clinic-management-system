import type { Prescription, PrescriptionItem } from "@clinic/shared";
import { useMemo, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  EmptyState,
  EntityCard,
  Icon,
  Ltr,
  MenuItem,
  Modal,
  NotePreview,
  RowMenu,
  TotalBadge,
  useConfirm,
  usePersonName,
  useToast,
} from "@clinic/ui";
import { SkeletonCard, SkeletonStatus } from "@clinic/ui/components/skeleton";
import { useSession } from "@web/features/auth/session";
import { useDoctors } from "@web/features/doctors/queries";
import { canDeletePrescription, canWritePrescription } from "@web/features/patients/permissions";
import { PrescriptionFormModal } from "@web/features/patients/prescriptions/prescription-form-modal";
import {
  useDeletePrescription,
  usePatientPrescriptions,
  usePatientVisits,
} from "@web/features/patients/queries";
import { errorMessageKey } from "@web/lib/api-error";
import { shortDate, visitMoment } from "@web/lib/format";
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
  const [drugsFor, setDrugsFor] = useState<string | null>(null);

  const orderedVisits = useMemo(
    () => [...(visits.data ?? [])].sort((a, b) => b.visitDate.localeCompare(a.visitDate)),
    [visits.data],
  );

  const doctors = useDoctors({ limit: 100 });
  const displayName = usePersonName();
  const doctorName = (id: string): string =>
    displayName(doctors.data?.items.find((doctor) => doctor.id === id)?.user.name) || "—";

  // Newest first by the visit it was written at; one with no visit by its own date.
  const ordered = useMemo(() => {
    const visitDate = new Map(orderedVisits.map((visit) => [visit.id, visit.visitDate]));

    return [...(prescriptions.data ?? [])]
      .map((prescription) => ({
        prescription,
        visitDate: prescription.visitId ? (visitDate.get(prescription.visitId) ?? null) : null,
      }))
      .sort((a, b) =>
        (b.visitDate ?? b.prescription.createdAt).localeCompare(
          a.visitDate ?? a.prescription.createdAt,
        ),
      );
  }, [prescriptions.data, orderedVisits]);

  const renderDrug = (
    prescription: Prescription,
    item: PrescriptionItem,
    index: number,
    prefix: string,
  ): JSX.Element => (
    <li
      key={index}
      data-testid={`${prefix}-${prescription.id}-drug-${index}`}
      className="flex gap-3 rounded-panel bg-canvas px-3 py-2"
    >
      <Ltr className="pt-0.5 text-label text-ink-subtle">{index + 1}</Ltr>
      <div className="min-w-0 flex-1">
        <p className="truncate text-value font-medium text-ink" dir="auto">
          {item.drug}
        </p>
        {describeItem(item) && (
          <p className="truncate text-meta text-ink-muted">{describeItem(item)}</p>
        )}
        {item.note && (
          <NotePreview
            data-testid={`${prefix}-${prescription.id}-drug-${index}-note`}
            size="meta"
            text={item.note}
            title="prescriptions.noteOf"
            titleValues={{ name: item.drug }}
          />
        )}
      </div>
    </li>
  );

  if (showSkeleton) {
    return (
      <div data-testid="prescriptions-tab-loading" className="flex flex-col gap-3">
        <SkeletonStatus />
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonCard count={2} />
        </div>
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
  const drugsEntry = ordered.find((entry) => entry.prescription.id === drugsFor);

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

      {ordered.length === 0 && (
        <EmptyState
          icon="clipboard"
          data-testid="prescriptions-empty"
          title={noVisits ? "prescriptions.noVisits" : "prescriptions.empty"}
          hint={noVisits ? "prescriptions.noVisitsHint" : "prescriptions.emptyHint"}
        />
      )}

      <ol data-testid="prescriptions-list" className="grid gap-4 md:grid-cols-2">
        {ordered.map(({ prescription, visitDate }) => (
          <li key={prescription.id} className="flex min-w-0 flex-col">
            <EntityCard
              data-testid={`prescription-${prescription.id}`}
              className="flex-1"
              icon="file"
              title={
                visitDate
                  ? `${t("prescriptions.visit")} ${visitMoment(visitDate)}`
                  : t("prescriptions.withoutVisit")
              }
              subtitle={`${t("prescriptions.writtenBy")}: ${doctorName(prescription.doctorId)}`}
              {...((mayWrite || mayDelete) && {
                menu: (
                  <RowMenu
                    label={t("prescriptions.menu")}
                    data-testid={`prescription-${prescription.id}-menu`}
                  >
                    {mayWrite && (
                      <MenuItem
                        icon="edit"
                        data-testid={`prescription-${prescription.id}-edit`}
                        onSelect={() => {
                          setEditing(prescription);
                          setFormOpen(true);
                        }}
                      >
                        {t("common.edit")}
                      </MenuItem>
                    )}
                    {mayDelete && (
                      <MenuItem
                        icon="trash"
                        tone="danger"
                        data-testid={`prescription-${prescription.id}-delete`}
                        onSelect={() => destroy(prescription)}
                      >
                        {t("common.delete")}
                      </MenuItem>
                    )}
                  </RowMenu>
                ),
              })}
            >
              {prescription.notes && (
                <NotePreview
                  data-testid={`prescription-${prescription.id}-notes`}
                  className="mt-3"
                  text={prescription.notes}
                  title="prescriptions.notesTitle"
                />
              )}

              {prescription.items.length > 0 && (
                <div className="mt-auto flex pt-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Icon name="list" />}
                    data-testid={`prescription-${prescription.id}-drugs`}
                    onClick={() => setDrugsFor(prescription.id)}
                  >
                    {t("prescriptions.showDrugs", { count: prescription.items.length })}
                  </Button>
                </div>
              )}
            </EntityCard>
          </li>
        ))}
      </ol>

      <Modal
        data-testid="prescription-drugs-modal"
        open={drugsEntry !== undefined}
        onOpenChange={(open) => !open && setDrugsFor(null)}
        title={drugsEntry?.visitDate ? "prescriptions.drugsOf" : "prescriptions.drugsTitle"}
        titleValues={{ date: drugsEntry?.visitDate ? shortDate(drugsEntry.visitDate) : "" }}
        size="lg"
      >
        {drugsEntry && (
          <ol className="flex flex-col gap-1.5">
            {drugsEntry.prescription.items.map((item, index) =>
              renderDrug(drugsEntry.prescription, item, index, "prescription-drugs-modal"),
            )}
          </ol>
        )}
      </Modal>

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
