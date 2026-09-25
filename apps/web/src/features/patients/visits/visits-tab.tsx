import {
  addMoney,
  subtractMoney,
  type Doctor,
  type PatientClinicalView,
  type PerformedProcedure,
  type PrescriptionItem,
  type Visit,
} from "@clinic/shared";
import { useMemo, useState, type JSX, type ReactNode } from "react";
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
  Money,
  PersonName,
  RowMenu,
  TotalBadge,
  useToast,
} from "@clinic/ui";
import { Skeleton, SkeletonStatus } from "@clinic/ui/components/skeleton";
import { minutesOf, toTimeLabel } from "@web/features/appointments/calendar-time";
import { useSession } from "@web/features/auth/session";
import { useCurrency } from "@web/features/clinic/queries";
import { useDoctors } from "@web/features/doctors/queries";
import { ConsumeForVisit } from "@web/features/inventory/consume-for-visit";
import { canConsumeStock } from "@web/features/inventory/permissions";
import {
  canDeleteProcedure,
  canDeleteVisit,
  canSeePrices,
} from "@web/features/patients/permissions";
import { describeItem } from "@web/features/patients/prescriptions/prescriptions-tab";
import {
  ProcedureForm,
  ProcedureFormActions,
  type ProcedureFormValues,
} from "@web/features/patients/procedures/procedure-form";
import { procedureName } from "@web/features/patients/procedures/procedure-name";
import {
  useCreateProcedure,
  useDeleteProcedure,
  useDeleteVisit,
  usePatientPrescriptions,
  usePatientProcedures,
  usePatientVisits,
  useProcedureCatalog,
  useUpdateProcedure,
} from "@web/features/patients/queries";
import { VisitFormModal } from "@web/features/patients/visits/visit-form-modal";
import { errorMessageKey } from "@web/lib/api-error";
import { dayMonthYear, formatDate, formatList } from "@web/lib/format";
import { useDelayedLoading } from "@clinic/ui/lib/use-delayed-loading";

const PROCEDURE_FORM_ID = "visit-procedure-form";

type Pending =
  | { readonly kind: "visit"; readonly visit: Visit; readonly procedures: number }
  | { readonly kind: "procedure"; readonly procedure: PerformedProcedure };

export function VisitsTab({
  patientId,
  patient,
}: {
  patientId: string;
  patient?: PatientClinicalView | undefined;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const { user, can } = useSession();
  const toast = useToast();

  const visits = usePatientVisits(patientId);
  const showSkeleton = useDelayedLoading(visits.isPending);
  const procedures = usePatientProcedures(patientId);
  const prescriptions = usePatientPrescriptions(patientId);
  const catalog = useProcedureCatalog();
  const doctors = useDoctors({ limit: 100 });

  const createProcedure = useCreateProcedure(patientId);
  const updateProcedure = useUpdateProcedure(patientId);
  const deleteVisit = useDeleteVisit(patientId);
  const deleteProcedure = useDeleteProcedure(patientId);

  const [consumingFor, setConsumingFor] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [procedureFor, setProcedureFor] = useState<{
    visitId: string;
    procedure: PerformedProcedure | null;
  } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [detailsFor, setDetailsFor] = useState<Visit | null>(null);

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

  const catalogName = (id: string): string => {
    const entry = catalog.data?.find((item) => item.id === id);
    return entry ? procedureName(entry, i18n.language) : t("chart.panel.procedure");
  };

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
        title="errors.generic"
        hint="visits.loadFailed"
      />
    );
  }

  const ordered = [...(visits.data ?? [])].sort((a, b) => b.visitDate.localeCompare(a.visitDate));

  const submitProcedure = async (visitId: string, values: ProcedureFormValues): Promise<void> => {
    const editing = procedureFor?.procedure;

    try {
      if (editing) {
        await updateProcedure.mutateAsync({ id: editing.id, body: values });
        toast.success("visits.procedureUpdated");
      } else {
        await createProcedure.mutateAsync({ ...values, patientId, visitId });
        toast.success("chart.panel.recorded");
      }

      setProcedureFor(null);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (!pending) {
      return;
    }

    try {
      if (pending.kind === "visit") {
        await deleteVisit.mutateAsync(pending.visit.id);
        toast.success("visits.deleted");
      } else {
        await deleteProcedure.mutateAsync(pending.procedure.id);
        toast.success("visits.procedureDeleted");
      }
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
            onDelete={() =>
              setPending({
                kind: "visit",
                visit,
                procedures: (byVisit.get(visit.id) ?? []).length,
              })
            }
            onAddProcedure={() => setProcedureFor({ visitId: visit.id, procedure: null })}
            onShowProcedures={() => setDetailsFor(visit)}
          />
        ))}
      </ol>

      {user && (
        <Modal
          data-testid="visit-procedure-modal"
          open={procedureFor !== null}
          onOpenChange={(open) => !open && setProcedureFor(null)}
          size="form"
          {...(procedureFor?.procedure
            ? {
                title: "visits.editTreatmentTitle",
                titleValues: { name: catalogName(procedureFor.procedure.procedureId) },
              }
            : {
                title: "visits.addTreatmentTitle",
                titleValues: {
                  date: shortDate(
                    ordered.find((visit) => visit.id === procedureFor?.visitId)?.visitDate ??
                      new Date().toISOString(),
                  ),
                },
              })}
          footer={
            <ProcedureFormActions
              formId={PROCEDURE_FORM_ID}
              submitting={createProcedure.isPending || updateProcedure.isPending}
              onCancel={() => setProcedureFor(null)}
            />
          }
        >
          {procedureFor && (
            <ProcedureForm
              key={procedureFor.procedure?.id ?? procedureFor.visitId}
              formId={PROCEDURE_FORM_ID}
              role={user.role}
              catalog={catalog.data ?? []}
              doctors={doctorList}
              submitting={createProcedure.isPending || updateProcedure.isPending}
              visitId={procedureFor.visitId}
              defaultDoctorId={ordered.find((visit) => visit.id === procedureFor.visitId)?.doctorId}
              {...(procedureFor.procedure && { procedure: procedureFor.procedure })}
              onCancel={() => setProcedureFor(null)}
              onSubmit={(values) => void submitProcedure(procedureFor.visitId, values)}
            />
          )}
        </Modal>
      )}

      <ProceduresModal
        visit={detailsFor}
        procedures={detailsFor ? (byVisit.get(detailsFor.id) ?? []) : []}
        catalogName={catalogName}
        doctorOf={doctorOf}
        showPrices={user ? canSeePrices(user.role) : false}
        mayDelete={canDeleteProcedure(can)}
        onClose={() => setDetailsFor(null)}
        onEdit={(procedure) => {
          setDetailsFor(null);
          setProcedureFor({ visitId: procedure.visitId ?? "", procedure });
        }}
        onDelete={(procedure) => setPending({ kind: "procedure", procedure })}
      />

      <ConfirmDialog
        data-testid="visits-confirm-delete"
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        onConfirm={confirmDelete}
        {...(pending?.kind === "visit"
          ? {
              title: "visits.confirmDelete.title",
              titleValues: { date: shortDate(pending.visit.visitDate) },
              consequences: [
                t("visits.confirmDelete.procedures", { count: pending.procedures }),
                t("visits.confirmDelete.attachments"),
                t("visits.confirmDelete.audit"),
              ],
            }
          : pending?.kind === "procedure"
            ? {
                title: toothLabel(pending.procedure)
                  ? "visits.confirmProcedure.titleWithTooth"
                  : "visits.confirmProcedure.title",
                titleValues: {
                  name: catalogName(pending.procedure.procedureId),
                  tooth: toothLabel(pending.procedure),
                },
                consequences: [
                  t("visits.confirmProcedure.charge"),
                  t("visits.confirmProcedure.chart"),
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
  const time = toTimeLabel(minutesOf(visit.visitDate));

  const fields = [
    { key: "complaint", label: "visits.complaint", value: visit.complaint, wide: false },
    { key: "diagnosis", label: "visits.diagnosis", value: visit.diagnosis, wide: false },
    { key: "examination", label: "visits.examination", value: visit.examination, wide: true },
    { key: "notes", label: "visits.notes", value: visit.notes, wide: true },
  ].filter((field) => field.value);

  // Four children, always, one per row track the grid shares across the row: a card's header,
  // fields, treatments and prescriptions each line up with its neighbours'. Not a size container:
  // containment makes a subgrid fall back to its own rows, so the fields hold the container.
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

/** The day large, the month and year under it: a visit two years back reads as one. */
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

function ProcedureMenu({
  procedure,
  mayDelete,
  onEdit,
  onDelete,
}: {
  readonly procedure: PerformedProcedure;
  readonly mayDelete: boolean;
  readonly onEdit: (procedure: PerformedProcedure) => void;
  readonly onDelete: (procedure: PerformedProcedure) => void;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <RowMenu label={t("visits.procedureMenu")} data-testid={`visit-procedure-${procedure.id}-menu`}>
      <MenuItem icon="edit" data-testid="visit-procedure-edit" onSelect={() => onEdit(procedure)}>
        {t("common.edit")}
      </MenuItem>
      {mayDelete && (
        <MenuItem
          icon="trash"
          tone="danger"
          data-testid="visit-procedure-delete"
          onSelect={() => onDelete(procedure)}
        >
          {t("common.delete")}
        </MenuItem>
      )}
    </RowMenu>
  );
}

interface ProceduresModalProps {
  readonly visit: Visit | null;
  readonly procedures: readonly PerformedProcedure[];
  readonly catalogName: (id: string) => string;
  readonly doctorOf: (id: string) => Doctor | undefined;
  readonly showPrices: boolean;
  readonly mayDelete: boolean;
  readonly onClose: () => void;
  readonly onEdit: (procedure: PerformedProcedure) => void;
  readonly onDelete: (procedure: PerformedProcedure) => void;
}

// Everything recorded about each treatment, which the card's one line per treatment leaves out.
function ProceduresModal({
  visit,
  procedures,
  catalogName,
  doctorOf,
  showPrices,
  mayDelete,
  onClose,
  onEdit,
  onDelete,
}: ProceduresModalProps): JSX.Element {
  const { t } = useTranslation();
  const currency = useCurrency();
  const total = procedures.reduce(
    (sum, procedure) => addMoney(sum, subtractMoney(procedure.price, procedure.discount)),
    "0.00",
  );

  return (
    <Modal
      data-testid="visit-procedures-modal"
      open={visit !== null}
      onOpenChange={(open) => !open && onClose()}
      title="visits.proceduresTitle"
      titleValues={{ date: visit ? shortDate(visit.visitDate) : "" }}
      size="lg"
    >
      <ul className="flex flex-col gap-2">
        {procedures.map((procedure) => {
          const surfaces = surfacesOf(procedure);
          const hasDiscount = Number(procedure.discount) !== 0;

          return (
            <li
              key={procedure.id}
              data-testid={`visit-procedures-modal-${procedure.id}`}
              className="rounded-panel border border-line p-3"
            >
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-value font-medium text-ink">
                  {catalogName(procedure.procedureId)}
                </span>
                <Badge tone={statusTone(procedure.status)} className="shrink-0">
                  {t(`chart.procedureStatus.${procedure.status}`)}
                </Badge>
                <ProcedureMenu
                  procedure={procedure}
                  mayDelete={mayDelete}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              </div>

              <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-3">
                <Detail label="visits.teeth">
                  {toothLabel(procedure) ? <Ltr>{toothLabel(procedure)}</Ltr> : "—"}
                </Detail>
                {surfaces.length > 0 && (
                  <Detail label="chart.panel.surfaces">
                    {formatList(surfaces.map((surface) => t(`chart.surfaces.${surface}`)))}
                  </Detail>
                )}
                <Detail label="chart.panel.doctor">
                  <PersonName name={doctorOf(procedure.doctorId)?.user.name} />
                </Detail>
                <Detail label="chart.panel.date">
                  <Ltr>{formatDate(procedure.performedAt)}</Ltr>
                </Detail>
                {showPrices && (
                  <>
                    <Detail label="chart.panel.price">
                      <Money amount={procedure.price} currency={currency} />
                    </Detail>
                    {hasDiscount && (
                      <Detail label="chart.panel.discount">
                        <Money amount={procedure.discount} currency={currency} />
                        {procedure.discountReason && (
                          <span className="text-ink-muted"> · {procedure.discountReason}</span>
                        )}
                      </Detail>
                    )}
                  </>
                )}
                {procedure.notes && (
                  <Detail label="visits.notes" wide>
                    {procedure.notes}
                  </Detail>
                )}
              </dl>
            </li>
          );
        })}
      </ul>

      {showPrices && procedures.length > 0 && (
        <p
          data-testid="visit-procedures-total"
          className="mt-3 flex items-center justify-between border-t border-line pt-3 text-value font-medium text-ink"
        >
          {t("visits.proceduresTotal")}
          <Money amount={total} currency={currency} />
        </p>
      )}
    </Modal>
  );
}

function Detail({
  label,
  wide = false,
  children,
}: {
  readonly label: string;
  readonly wide?: boolean;
  readonly children: ReactNode;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className={wide ? "sm:col-span-full" : undefined}>
      <dt className="text-micro text-ink-muted">{t(label)}</dt>
      <dd className="mt-0.5 text-meta text-ink">{children}</dd>
    </div>
  );
}

function surfacesOf(procedure: PerformedProcedure): string[] {
  return (procedure.chartMarks ?? []).flatMap(
    (mark) => (mark.location as { surfaces?: string[] }).surfaces ?? [],
  );
}

// The card's own shape, so the page does not jump when the visits land.
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

// Isolated, or "1 Sep" inside an Arabic title reads as "Sep 1".
const shortDate = (iso: string): string => {
  const { day, month, year } = dayMonthYear(iso);
  return `\u2066${day} ${month} ${year}\u2069`;
};

function toothLabel(procedure: PerformedProcedure): string {
  const teeth = (procedure.chartMarks ?? [])
    .map((mark) => (mark.location as { tooth?: number }).tooth)
    .filter((tooth): tooth is number => typeof tooth === "number");

  return teeth.length === 0 ? "" : teeth.join(" · ");
}

function statusTone(status: PerformedProcedure["status"]): "success" | "warning" | "neutral" {
  if (status === "done") {
    return "success";
  }

  return status === "in_progress" ? "warning" : "neutral";
}
