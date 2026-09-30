import {
  type Doctor,
  type PatientClinicalView,
  type PerformedProcedure,
  type PrescriptionItem,
  type Visit,
} from "@clinic/shared";
import { formatTime, dayMonthYear, formatDate } from "@web/shared/lib/format";
import { useMemo, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Icon,
  Ltr,
  MenuItem,
  Modal,
  PersonName,
  RowMenu,
  TotalBadge,
  useToast,
} from "@clinic/ui";
import { Skeleton, SkeletonStatus } from "@clinic/ui/components/skeleton";
import { useSession } from "@web/shared/providers/session";
import { useDoctors } from "@web/shared/queries/doctors";
import { ConsumeForVisit } from "@web/modules/inventory/components/consume-for-visit";
import { canConsumeStock } from "@web/shared/permissions/inventory";
import { canDeleteVisit } from "@web/shared/permissions/patients";
import { describeItem } from "@web/modules/patients/pages/prescriptions-tab";
import { TreatmentsPanel } from "@web/modules/patients/components/treatments/treatments-panel";
import {
  useDeleteVisit,
  usePatientPrescriptions,
  usePatientProcedures,
  usePatientVisits,
} from "@web/modules/patients/queries";
import { VisitFormModal } from "@web/modules/patients/components/visits/visit-form-modal";
import { errorMessageKey } from "@web/shared/lib/api-error";
import { useDelayedLoading } from "@clinic/ui/lib/use-delayed-loading";

type Pending = { readonly visit: Visit; readonly procedures: number };

type Treating = { readonly visit: Visit; readonly adding: boolean };

export function VisitsTab({
  patientId,
  patient,
}: {
  patientId: string;
  patient?: PatientClinicalView | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const { can } = useSession();
  const toast = useToast();

  const visits = usePatientVisits(patientId);
  const showSkeleton = useDelayedLoading(visits.isPending);
  const procedures = usePatientProcedures(patientId);
  const prescriptions = usePatientPrescriptions(patientId);
  const doctors = useDoctors({ limit: 100 });

  const deleteVisit = useDeleteVisit(patientId);

  const [consumingFor, setConsumingFor] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [treating, setTreating] = useState<Treating | null>(null);

  const byVisit = useMemo(() => {
    const grouped = new Map<string, PerformedProcedure[]>();

    for (const procedure of procedures.data ?? []) {
      if (procedure.visitId) {
        grouped.set(procedure.visitId, [...(grouped.get(procedure.visitId) ?? []), procedure]);
      }
    }

    return grouped;
  }, [procedures.data]);

  const prescriptionsByVisit = useMemo(() => {
    const grouped = new Map<string, PrescriptionItem[]>();

    for (const prescription of prescriptions.data ?? []) {
      if (prescription.visitId) {
        grouped.set(prescription.visitId, [
          ...(grouped.get(prescription.visitId) ?? []),
          ...prescription.items,
        ]);
      }
    }

    return grouped;
  }, [prescriptions.data]);

  const doctorList = doctors.data?.items ?? [];
  const doctorOf = (id: string): Doctor | undefined =>
    doctorList.find((doctor) => doctor.id === id);

  if (showSkeleton) {
    return (
      <div data-testid="visits-tab-loading" className="flex flex-col gap-4">
        <SkeletonStatus />
        <VisitsSkeleton />
      </div>
    );
  }

  if (visits.isPending) {
    return <></>;
  }

  if (visits.isError) {
    return (
      <EmptyState
        icon="alert"
        data-testid="visits-error"
        title="errors.unknown"
        hint="visits.loadFailed"
      />
    );
  }

  const ordered = [...(visits.data ?? [])].sort((a, b) => b.visitDate.localeCompare(a.visitDate));

  const confirmDelete = async (): Promise<void> => {
    if (!pending) {
      return;
    }

    try {
      await deleteVisit.mutateAsync(pending.visit.id);
      toast.success("visits.deleted");
    } catch (error) {
      toast.error(errorMessageKey(error));
      throw error;
    }
  };

  return (
    <div data-testid="visits-tab" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <TotalBadge data-testid="visits-count" total={ordered.length} label="visits.count" />
        <Button
          icon={<Icon name="plus" />}
          size="sm"
          data-testid="visits-create"
          onClick={() => {
            setEditingVisit(null);
            setFormOpen(true);
          }}
        >
          {t("visits.create")}
        </Button>
      </div>

      {ordered.length === 0 && (
        <EmptyState
          icon="calendar"
          data-testid="visits-empty"
          title="visits.empty"
          hint="visits.emptyHint"
        />
      )}

      <ol data-testid="visits-list" className="grid gap-x-2.5 md:grid-cols-2 xl:grid-cols-3">
        {ordered.map((visit) => (
          <VisitCard
            key={visit.id}
            visit={visit}
            doctor={doctorOf(visit.doctorId)}
            procedures={byVisit.get(visit.id) ?? []}
            prescriptions={prescriptionsByVisit.get(visit.id) ?? []}
            mayConsume={canConsumeStock(can)}
            mayDelete={canDeleteVisit(can)}
            onEdit={() => {
              setEditingVisit(visit);
              setFormOpen(true);
            }}
            onConsume={() => setConsumingFor(visit.id)}
            onDelete={() => setPending({ visit, procedures: (byVisit.get(visit.id) ?? []).length })}
            onAddProcedure={() => setTreating({ visit, adding: true })}
            onShowProcedures={() => setTreating({ visit, adding: false })}
          />
        ))}
      </ol>

      <Modal
        data-testid="visit-treatments-modal"
        open={treating !== null}
        onOpenChange={(open) => !open && setTreating(null)}
        title="visits.proceduresTitle"
        titleValues={{ date: treating ? formatDate(treating.visit.visitDate) : "" }}
        size="lg"
      >
        {treating && (
          <TreatmentsPanel
            key={treating.visit.id}
            data-testid="visit-treatments"
            patientId={patientId}
            treatments={byVisit.get(treating.visit.id) ?? []}
            defaults={{
              visitId: treating.visit.id,
              doctorId: treating.visit.doctorId,
              performedAt: treating.visit.visitDate,
            }}
            emptyTitle="visits.noProcedures"
            startAdding={treating.adding}
          />
        )}
      </Modal>

      <ConfirmDialog
        data-testid="visits-confirm-delete"
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        onConfirm={confirmDelete}
        {...(pending
          ? {
              title: "visits.confirmDelete.title",
              titleValues: { date: formatDate(pending.visit.visitDate) },
              consequences: [
                t("visits.confirmDelete.procedures", { count: pending.procedures }),
                t("visits.confirmDelete.attachments"),
                t("visits.confirmDelete.audit"),
              ],
            }
          : { title: "visits.confirmDelete.title" })}
      />

      <ConsumeForVisit
        data-testid="visit-consume-modal"
        open={consumingFor !== null}
        onClose={() => setConsumingFor(null)}
        patient={patient}
      />

      <VisitFormModal
        data-testid="visit-form-modal"
        open={formOpen}
        onOpenChange={setFormOpen}
        patientId={patientId}
        doctors={doctorList}
        visit={editingVisit}
      />
    </div>
  );
}

interface VisitCardProps {
  readonly visit: Visit;
  readonly doctor: Doctor | undefined;
  readonly procedures: readonly PerformedProcedure[];
  readonly prescriptions: readonly PrescriptionItem[];
  readonly mayConsume: boolean;
  readonly mayDelete: boolean;
  readonly onEdit: () => void;
  readonly onConsume: () => void;
  readonly onDelete: () => void;
  readonly onAddProcedure: () => void;
  readonly onShowProcedures: () => void;
}

function VisitCard({
  visit,
  doctor,
  procedures,
  prescriptions,
  mayConsume,
  mayDelete,
  onEdit,
  onConsume,
  onDelete,
  onAddProcedure,
  onShowProcedures,
}: VisitCardProps): JSX.Element {
  const { t } = useTranslation();
  const time = formatTime(visit.visitDate);

  const fields = [
    { key: "complaint", label: "visits.complaint", value: visit.complaint, wide: false },
    { key: "diagnosis", label: "visits.diagnosis", value: visit.diagnosis, wide: false },
    { key: "examination", label: "visits.examination", value: visit.examination, wide: true },
    { key: "notes", label: "visits.notes", value: visit.notes, wide: true },
  ].filter((field) => field.value);

  return (
    <li
      data-testid={`visit-${visit.id}`}
      className="row-span-4 mb-2.5 grid grid-rows-subgrid gap-0 rounded-card border border-line bg-surface p-4 shadow-card"
    >
      <header className="flex items-center gap-3 self-start">
        <DateBlock iso={visit.visitDate} />

        <div className="min-w-0 flex-1">
          <p data-testid="visit-time" className="text-value font-medium text-ink">
            {t("visits.visit")} · <Ltr className="tabular-nums">{time}</Ltr>
          </p>
          <PersonName
            name={doctor?.user.name}
            data-testid="visit-doctor"
            className="block truncate text-meta text-ink-muted"
          />
        </div>

        <RowMenu label={t("visits.menu")} data-testid="visit-menu">
          <MenuItem icon="edit" data-testid="visit-menu-edit" onSelect={onEdit}>
            {t("common.edit")}
          </MenuItem>
          {mayConsume && (
            <MenuItem icon="clipboard" data-testid="visit-menu-consume" onSelect={onConsume}>
              {t("inventory.movement.consumeFromVisit")}
            </MenuItem>
          )}
          {mayDelete && (
            <MenuItem icon="trash" tone="danger" data-testid="visit-delete" onSelect={onDelete}>
              {t("common.delete")}
            </MenuItem>
          )}
        </RowMenu>
      </header>

      <div className="@container mt-4">
        {fields.length > 0 ? (
          <dl data-testid="visit-fields" className="grid gap-x-6 gap-y-3 @sm:grid-cols-2">
            {fields.map((field) => (
              <div
                key={field.key}
                data-testid={`visit-field-${field.key}`}
                className={field.wide ? "@sm:col-span-full" : undefined}
              >
                <dt className="text-micro text-ink-muted">{t(field.label)}</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-meta text-ink">{field.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p data-testid="visit-nothing-recorded" className="text-meta text-ink-subtle">
            {t("visits.nothingRecorded")}
          </p>
        )}
      </div>

      <section className="mt-4 border-t border-line pt-3">
        <div className="flex items-center justify-between gap-2">
          {procedures.length > 0 ? (
            <button
              type="button"
              data-testid="visit-procedures-open"
              onClick={onShowProcedures}
              className="flex min-w-0 cursor-pointer items-center gap-1 rounded-control text-micro font-medium text-ink-muted hover:text-primary-700"
            >
              <span className="truncate">{t("visits.procedures")}</span>
              <Badge tone="neutral">
                <Ltr>{procedures.length}</Ltr>
              </Badge>
              <Icon name="chevron-end" className="size-3.5" />
            </button>
          ) : (
            <h3 className="truncate text-micro font-medium text-ink-muted">
              {t("visits.procedures")}
            </h3>
          )}
          <AddTreatment onClick={onAddProcedure} />
        </div>

        {procedures.length === 0 && (
          <p data-testid="visit-no-procedures" className="mt-2 text-meta text-ink-subtle">
            {t("visits.noProcedures")}
          </p>
        )}
      </section>

      <section
        data-testid={prescriptions.length > 0 ? "visit-prescriptions" : undefined}
        className={prescriptions.length > 0 ? "mt-4 border-t border-line pt-3" : undefined}
      >
        {prescriptions.length > 0 && (
          <>
            <h3 className="text-micro font-medium text-ink-muted">
              {t("patients.tabs.prescriptions")}
            </h3>
            <ul className="mt-2 flex flex-col gap-1">
              {prescriptions.map((item, index) => (
                <li key={index} className="text-meta text-ink">
                  <span className="font-medium">{item.drug}</span>
                  {describeItem(item) && (
                    <span className="text-ink-muted"> · {describeItem(item)}</span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </li>
  );
}

function DateBlock({ iso }: { readonly iso: string }): JSX.Element {
  const date = dayMonthYear(iso);

  return (
    <span
      data-testid="visit-date"
      className="flex min-w-14 shrink-0 flex-col items-center rounded-field bg-primary-50 px-2 py-1 text-primary-700"
    >
      <Ltr className="text-section font-semibold tabular-nums">{date.day}</Ltr>
      <Ltr className="text-micro tabular-nums">
        {date.month} {date.year}
      </Ltr>
    </span>
  );
}

function VisitsSkeleton(): JSX.Element {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-(--control-h-sm) w-20 rounded-pill" />
        <Skeleton className="h-(--control-h-sm) w-28 rounded-control" />
      </div>

      <ul className="grid items-start gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((card) => (
          <li key={card} className="rounded-card border border-line bg-surface p-4 shadow-card">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 shrink-0 rounded-field" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="flex shrink-0 gap-1">
                {[0, 1, 2].map((button) => (
                  <Skeleton key={button} className="size-(--control-h-sm) rounded-control" />
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {[0, 1].map((field) => (
                <div key={field} className="flex flex-col gap-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3.5 w-3/5" />
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-line pt-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-10 w-full rounded-control" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddTreatment({ onClick }: { readonly onClick: () => void }): JSX.Element {
  const { t } = useTranslation();

  return (
    <Button
      size="sm"
      variant="quiet"
      icon={<Icon name="plus" />}
      data-testid="visit-add-procedure"
      className="shrink-0"
      onClick={onClick}
    >
      {t("visits.addTreatment")}
    </Button>
  );
}
