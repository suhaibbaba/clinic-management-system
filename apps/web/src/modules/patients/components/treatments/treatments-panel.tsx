import {
  PERFORMED_PROCEDURE_STATUS,
  type PerformedProcedure,
  type PerformedProcedureStatus,
} from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Icon,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Modal,
  Money,
  useToast,
} from "@clinic/ui";
import {
  TreatmentForm,
  TreatmentFormActions,
  type TreatmentDefaults,
  type TreatmentFormValues,
} from "@web/modules/patients/components/treatments/treatment-form";
import { TreatmentItem } from "@web/modules/patients/components/treatments/treatment-item";
import {
  newestTreatmentsFirst,
  treatmentTeeth,
  treatmentsTotal,
} from "@web/modules/patients/lib/treatments/treatments";
import {
  useCreateProcedure,
  useDeleteProcedure,
  usePatientProcedures,
  useProcedureCatalog,
  useUpdateProcedure,
} from "@web/modules/patients/queries";
import { TREATMENT_FORM_ID } from "@web/modules/patients/constants";
import {
  canDeleteProcedure,
  canRecordProcedure,
  canSeePrices,
} from "@web/shared/permissions/patients";
import { errorMessageKey } from "@web/shared/lib/api-error";
import { useSession } from "@web/shared/providers/session";
import { useCurrency } from "@web/shared/queries/clinic";
import { useDoctors } from "@web/shared/queries/doctors";

export interface TreatmentsPanelProps {
  readonly patientId: string;
  readonly treatments: readonly PerformedProcedure[];
  readonly defaults: TreatmentDefaults;
  readonly emptyTitle: string;
  readonly startAdding?: boolean | undefined;
  readonly showTotal?: boolean | undefined;
  readonly layout?: "list" | "grid" | undefined;
  readonly onSendToLab?: ((treatment: PerformedProcedure) => void) | undefined;
  readonly "data-testid": string;
}

type Editing = { readonly treatment: PerformedProcedure | null };

export function TreatmentsPanel({
  patientId,
  treatments,
  defaults,
  emptyTitle,
  startAdding = false,
  showTotal = true,
  layout = "list",
  onSendToLab,
  "data-testid": testId,
}: TreatmentsPanelProps): JSX.Element {
  const { t } = useTranslation();
  const { user, can } = useSession();
  const toast = useToast();
  const currency = useCurrency();

  const catalog = useProcedureCatalog();
  const doctors = useDoctors({ limit: 100 });
  const everything = usePatientProcedures(patientId);
  const create = useCreateProcedure(patientId);
  const update = useUpdateProcedure(patientId);
  const remove = useDeleteProcedure(patientId);

  const [editing, setEditing] = useState<Editing | null>(startAdding ? { treatment: null } : null);
  const [deleting, setDeleting] = useState<PerformedProcedure | null>(null);

  const role = user?.role;
  const mayChange = canRecordProcedure(can);
  const mayDelete = canDeleteProcedure(can);
  const showPrices = role ? canSeePrices(role) : false;
  const doctorList = doctors.data?.items ?? [];
  const ordered = newestTreatmentsFirst(treatments);

  const nameOf = (procedureId: string): string =>
    catalog.data?.find((item) => item.id === procedureId)?.name ?? t("chart.panel.procedure");

  const waiting =
    defaults.visitId === undefined
      ? []
      : (everything.data ?? []).filter(
          (treatment) =>
            treatment.visitId === null &&
            (treatment.status === PERFORMED_PROCEDURE_STATUS.PLANNED ||
              treatment.status === PERFORMED_PROCEDURE_STATUS.IN_PROGRESS),
        );

  const run = async (action: () => Promise<unknown>, success: string): Promise<void> => {
    try {
      await action();
      toast.success(success);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const move = (treatment: PerformedProcedure, status: PerformedProcedureStatus): void =>
    void run(
      () => update.mutateAsync({ id: treatment.id, body: { status } }),
      `treatments.moved.${status}`,
    );

  const performHere = (treatment: PerformedProcedure): void =>
    void run(
      () =>
        update.mutateAsync({
          id: treatment.id,
          body: {
            status: PERFORMED_PROCEDURE_STATUS.DONE,
            visitId: defaults.visitId ?? null,
            ...(defaults.performedAt !== undefined && { performedAt: defaults.performedAt }),
          },
        }),
      "treatments.moved.done",
    );

  const save = async (values: TreatmentFormValues): Promise<void> => {
    const current = editing?.treatment;

    try {
      if (current) {
        await update.mutateAsync({ id: current.id, body: values });
        toast.success("treatments.updated");
      } else {
        await create.mutateAsync({ ...values, patientId });
        toast.success("treatments.recorded");
      }
      setEditing(null);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <section data-testid={testId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {showTotal && showPrices && ordered.length > 0 ? (
          <p data-testid={`${testId}-total`} className="text-meta text-ink-muted">
            {t("treatments.total")}:{" "}
            <Money amount={treatmentsTotal(ordered)} currency={currency} className="text-ink" />
          </p>
        ) : (
          <span />
        )}

        {mayChange && (
          <div className="flex flex-wrap items-center gap-2">
            {waiting.length > 0 && (
              <Menu>
                <MenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Icon name="clipboard" />}
                    data-testid={`${testId}-from-planned`}
                  >
                    {t("treatments.fromPlanned")}
                  </Button>
                </MenuTrigger>
                <MenuContent data-testid={`${testId}-from-planned-menu`}>
                  {waiting.map((treatment) => (
                    <MenuItem
                      key={treatment.id}
                      icon="check"
                      data-testid={`${testId}-perform-${treatment.id}`}
                      onSelect={() => performHere(treatment)}
                    >
                      {nameOf(treatment.procedureId)}
                      {treatmentTeeth(treatment).length > 0 &&
                        ` · ${treatmentTeeth(treatment).join(" · ")}`}
                    </MenuItem>
                  ))}
                </MenuContent>
              </Menu>
            )}

            <Button
              size="sm"
              variant="secondary"
              icon={<Icon name="plus" />}
              data-testid={`${testId}-add`}
              onClick={() => setEditing({ treatment: null })}
            >
              {t("treatments.add")}
            </Button>
          </div>
        )}
      </div>

      {ordered.length === 0 ? (
        <EmptyState icon="tooth" data-testid={`${testId}-empty`} title={emptyTitle} />
      ) : (
        <ol
          data-testid={`${testId}-list`}
          className={
            layout === "grid" ? "grid gap-2.5 md:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-2"
          }
        >
          {ordered.map((treatment) => (
            <TreatmentItem
              key={treatment.id}
              treatment={treatment}
              name={nameOf(treatment.procedureId)}
              doctor={doctorList.find((doctor) => doctor.id === treatment.doctorId)}
              currency={currency}
              showPrice={showPrices}
              mayChange={mayChange}
              mayDelete={mayDelete}
              onMove={(status) => move(treatment, status)}
              onEdit={() => setEditing({ treatment })}
              onDelete={() => setDeleting(treatment)}
              {...(onSendToLab && { onSendToLab: () => onSendToLab(treatment) })}
            />
          ))}
        </ol>
      )}

      {role && (
        <Modal
          data-testid={`${testId}-form-modal`}
          open={editing !== null}
          onOpenChange={(open) => !open && setEditing(null)}
          size="form"
          title={editing?.treatment ? "treatments.edit" : "treatments.add"}
          footer={
            <TreatmentFormActions
              formId={TREATMENT_FORM_ID}
              submitting={create.isPending || update.isPending}
              onCancel={() => setEditing(null)}
            />
          }
        >
          {editing && (
            <TreatmentForm
              key={editing.treatment?.id ?? "new"}
              formId={TREATMENT_FORM_ID}
              role={role}
              catalog={catalog.data ?? []}
              doctors={doctorList}
              defaults={defaults}
              {...(editing.treatment && { treatment: editing.treatment })}
              onSubmit={(values) => void save(values)}
            />
          )}
        </Modal>
      )}

      <ConfirmDialog
        data-testid={`${testId}-confirm-delete`}
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="treatments.confirmDelete.title"
        titleValues={{ name: deleting ? nameOf(deleting.procedureId) : "" }}
        consequences={[t("treatments.confirmDelete.charge"), t("treatments.confirmDelete.chart")]}
        onConfirm={async () => {
          if (!deleting) {
            return;
          }

          try {
            await remove.mutateAsync(deleting.id);
            toast.success("treatments.deleted");
          } catch (error) {
            toast.error(errorMessageKey(error));
            throw error;
          }
        }}
      />
    </section>
  );
}
