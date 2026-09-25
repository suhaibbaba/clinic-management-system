import type { Doctor, ProcedureCatalogItem, TreatmentPlanItem } from "@clinic/shared";
import { useEffect, useState, type FormEvent, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  FormField,
  Icon,
  Modal,
  MoneyInput,
  Select,
  Textarea,
  usePersonName,
  useToast,
} from "@clinic/ui";
import { useSession } from "@web/features/auth/session";
import { useCurrency } from "@web/features/clinic/queries";
import { doctorOptionLabel } from "@web/features/doctors/doctor-label";
import { canAddVisitingDoctor } from "@web/features/doctors/permissions";
import { VisitingDoctorModal } from "@web/features/doctors/visiting-doctor-modal";
import { useAddPlanItem, useUpdatePlanItem } from "@web/features/patients/queries";
import { ellipsis } from "@web/i18n/ellipsis";
import { errorMessageKey } from "@web/lib/api-error";

interface PlanItemFormModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly patientId: string;
  readonly planId: string;
  readonly nextSortOrder: number;
  readonly catalog: readonly ProcedureCatalogItem[];
  readonly doctors: readonly Doctor[];
  readonly showPrices: boolean;
  readonly item: TreatmentPlanItem | null;
}

const FORM_ID = "treatment-plan-item-form";
const PLAN_DOCTOR = "";

export function PlanItemFormModal({
  open,
  onOpenChange,
  patientId,
  planId,
  nextSortOrder,
  catalog,
  doctors,
  showPrices,
  item,
}: PlanItemFormModalProps): JSX.Element {
  const { t } = useTranslation();
  const { can } = useSession();
  const toast = useToast();
  const currency = useCurrency();
  const displayName = usePersonName();
  const add = useAddPlanItem(patientId);
  const update = useUpdatePlanItem(patientId);

  const [procedureId, setProcedureId] = useState("");
  const [performerId, setPerformerId] = useState(PLAN_DOCTOR);
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [procedureMissing, setProcedureMissing] = useState(false);
  const [addingVisitor, setAddingVisitor] = useState(false);
  const [added, setAdded] = useState<Doctor | null>(null);

  const performers =
    added && !doctors.some((doctor) => doctor.id === added.id) ? [...doctors, added] : doctors;

  // Chosen a commit after its option exists: Radix's hidden native select reports "" for a value it
  // has no option for yet, and the picker would drop the doctor just added.
  useEffect(() => {
    if (added) {
      setPerformerId(added.id);
    }
  }, [added]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setProcedureId(item?.procedureId ?? "");
    setPerformerId(item?.performerDoctorId ?? PLAN_DOCTOR);
    setPrice(item ? String(Math.round(Number(item.estimatedPrice))) : "");
    setNotes(item?.notes ?? "");
    setProcedureMissing(false);
    setAdded(null);
  }, [open, item]);

  const chooseProcedure = (id: string): void => {
    setProcedureId(id);
    setProcedureMissing(false);

    const entry = catalog.find((candidate) => candidate.id === id);
    if (entry) {
      setPrice(String(Math.round(Number(entry.defaultPrice))));
    }
  };

  const submitting = add.isPending || update.isPending;

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();

    if (!procedureId) {
      setProcedureMissing(true);
      return;
    }

    const body = {
      procedureId,
      performerDoctorId: performerId === PLAN_DOCTOR ? null : performerId,
      notes: notes.trim() === "" ? null : notes.trim(),
      ...(showPrices && price !== "" && { estimatedPrice: price }),
    };

    try {
      if (item) {
        await update.mutateAsync({ itemId: item.id, body });
        toast.success("treatmentPlans.itemUpdated");
      } else {
        await add.mutateAsync({ planId, body: { ...body, sortOrder: nextSortOrder } });
        toast.success("treatmentPlans.itemAdded");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <>
      <Modal
        data-testid="treatment-plan-item-form-modal"
        open={open}
        onOpenChange={onOpenChange}
        title={item ? "treatmentPlans.editItem" : "treatmentPlans.addItem"}
        footer={
          <>
            <Button
              icon={<Icon name="x" />}
              variant="secondary"
              data-testid="treatment-plan-item-form-cancel"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              icon={<Icon name="check" />}
              type="submit"
              form={FORM_ID}
              data-testid="treatment-plan-item-form-save"
              isLoading={submitting}
            >
              {submitting ? ellipsis(t("common.saving")) : t("common.save")}
            </Button>
          </>
        }
      >
        <form
          id={FORM_ID}
          className="flex flex-col gap-4"
          onSubmit={(event) => void handleSubmit(event)}
          noValidate
        >
          <FormField
            label="chart.panel.procedure"
            htmlFor="treatment-plan-item-procedure"
            {...(procedureMissing && { error: { type: "invalid_type" } })}
            required
          >
            <Select
              id="treatment-plan-item-procedure"
              data-testid="treatment-plan-item-field-procedure"
              value={procedureId}
              onChange={(event) => chooseProcedure(event.target.value)}
              placeholder={t("chart.panel.selectProcedure")}
              options={catalog.map((entry) => ({
                value: entry.id,
                label: entry.name,
              }))}
            />
          </FormField>

          <FormField
            label="treatmentPlans.performer"
            htmlFor="treatment-plan-item-performer"
            hint="treatmentPlans.performerHint"
          >
            <Select
              id="treatment-plan-item-performer"
              data-testid="treatment-plan-item-field-performer"
              value={performerId}
              onChange={(event) => setPerformerId(event.target.value)}
              placeholder={t("treatmentPlans.performerPlanDoctor")}
              options={performers.map((doctor) => ({
                value: doctor.id,
                label: doctorOptionLabel(doctor, displayName(doctor.user.name), t),
              }))}
            />
          </FormField>

          {canAddVisitingDoctor(can) && (
            <Button
              icon={<Icon name="user-plus" />}
              variant="secondary"
              size="sm"
              className="-mt-2 self-start"
              data-testid="treatment-plan-item-add-visitor"
              onClick={() => setAddingVisitor(true)}
            >
              {t("doctors.visiting.create")}
            </Button>
          )}

          {showPrices && (
            <FormField label="treatmentPlans.estimatedPrice" htmlFor="treatment-plan-item-price">
              <MoneyInput
                id="treatment-plan-item-price"
                data-testid="treatment-plan-item-field-price"
                currency={currency}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </FormField>
          )}

          <FormField label="treatmentPlans.notes" htmlFor="treatment-plan-item-notes" optional>
            <Textarea
              id="treatment-plan-item-notes"
              data-testid="treatment-plan-item-field-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </FormField>
        </form>
      </Modal>

      <VisitingDoctorModal
        open={addingVisitor}
        onOpenChange={setAddingVisitor}
        onCreated={setAdded}
      />
    </>
  );
}
