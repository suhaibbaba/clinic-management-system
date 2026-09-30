import {
  CHART_TYPE,
  type CreatePerformedProcedureInput,
  type Doctor,
  type PerformedProcedure,
  type PerformedProcedureStatus,
  type ProcedureCatalogItem,
  type TreatmentPlan,
  type UserRole,
} from "@clinic/shared";
import { useEffect, useId, useState, type FormEvent, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  FormField,
  Icon,
  Input,
  MoneyInput,
  Select,
  Textarea,
  usePersonName,
} from "@clinic/ui";
import { TeethField } from "@web/modules/labs/components/teeth-field";
import { VisitingDoctorModal } from "@web/modules/doctors/components/visiting-doctor-modal";
import {
  SurfaceSelector,
  type SelectableSurface,
} from "@web/modules/patients/components/chart/surface-selector";
import {
  statusChoices,
  treatmentSurfaces,
  treatmentTeeth,
} from "@web/modules/patients/lib/treatments/treatments";
import { NO_PLAN_VALUE, SELECTABLE_SURFACES } from "@web/modules/patients/constants";
import { canAddVisitingDoctor } from "@web/shared/permissions/doctors";
import { canSeePrices } from "@web/shared/permissions/patients";
import { doctorOptionLabel } from "@web/shared/lib/doctor-label";
import { useSession } from "@web/shared/providers/session";
import { useCurrency } from "@web/shared/queries/clinic";
import { ellipsis } from "@web/i18n/ellipsis";

export type TreatmentFormValues = Omit<CreatePerformedProcedureInput, "patientId">;

export interface TreatmentDefaults {
  readonly tooth?: number | undefined;
  readonly visitId?: string | undefined;
  readonly treatmentPlanId?: string | undefined;
  readonly status?: PerformedProcedureStatus | undefined;
  readonly doctorId?: string | undefined;
}

export interface TreatmentFormProps {
  readonly role: UserRole;
  readonly catalog: readonly ProcedureCatalogItem[];
  readonly doctors: readonly Doctor[];
  readonly plans: readonly TreatmentPlan[];
  readonly defaults: TreatmentDefaults;
  readonly treatment?: PerformedProcedure | undefined;
  readonly formId: string;
  readonly onSubmit: (values: TreatmentFormValues) => void;
}

export function TreatmentForm({
  role,
  catalog,
  doctors,
  plans,
  defaults,
  treatment,
  formId,
  onSubmit,
}: TreatmentFormProps): JSX.Element {
  const { t } = useTranslation();
  const { can } = useSession();
  const currency = useCurrency();
  const doctorName = usePersonName();
  const fieldId = useId();
  const isEdit = treatment !== undefined;
  const fixedTooth = isEdit ? undefined : defaults.tooth;

  const [procedureId, setProcedureId] = useState(treatment?.procedureId ?? "");
  const [doctorId, setDoctorId] = useState(
    treatment?.doctorId ?? defaults.doctorId ?? doctors[0]?.id ?? "",
  );
  const [status, setStatus] = useState<PerformedProcedureStatus>(
    treatment?.status ?? defaults.status ?? "done",
  );
  const [planId, setPlanId] = useState(
    treatment?.treatmentPlanId ?? defaults.treatmentPlanId ?? NO_PLAN_VALUE,
  );
  const [teeth, setTeeth] = useState<number[]>(
    fixedTooth !== undefined ? [fixedTooth] : treatment ? treatmentTeeth(treatment) : [],
  );
  const [surfaces, setSurfaces] = useState<SelectableSurface[]>(
    treatment ? selectable(treatmentSurfaces(treatment)) : [],
  );
  const [price, setPrice] = useState(treatment ? whole(treatment.price) : "");
  const [discount, setDiscount] = useState(
    treatment && Number(treatment.discount) !== 0 ? whole(treatment.discount) : "",
  );
  const [discountReason, setDiscountReason] = useState(treatment?.discountReason ?? "");
  const [notes, setNotes] = useState(treatment?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [addingVisitor, setAddingVisitor] = useState(false);
  const [added, setAdded] = useState<Doctor | null>(null);

  const showPrices = canSeePrices(role);
  const selected = catalog.find((item) => item.id === procedureId);
  const performers =
    added && !doctors.some((doctor) => doctor.id === added.id) ? [...doctors, added] : doctors;
  const hasDiscount = discount !== "" && discount !== "0" && discount !== "0.00";

  useEffect(() => {
    if (!isEdit) {
      setPrice(selected ? whole(selected.defaultPrice) : "");
    }
  }, [selected, isEdit]);

  useEffect(() => {
    if (!doctorId && doctors[0]) {
      setDoctorId(doctors[0].id);
    }
  }, [doctors, doctorId]);

  useEffect(() => {
    if (added) {
      setDoctorId(added.id);
    }
  }, [added]);

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();

    if (!procedureId || !doctorId) {
      setError("chart.panel.selectProcedure");
      return;
    }

    if (hasDiscount && discountReason.trim() === "") {
      setError("chart.panel.discountNeedsReason");
      return;
    }

    setError(null);

    onSubmit({
      doctorId,
      procedureId,
      status,
      treatmentPlanId: planId === NO_PLAN_VALUE ? null : planId,
      discount: hasDiscount ? discount : "0.00",
      notes: notes.trim() === "" ? null : notes.trim(),
      ...(showPrices && price !== "" && { price }),
      ...(hasDiscount && { discountReason: discountReason.trim() }),
      ...(!isEdit && defaults.visitId !== undefined && { visitId: defaults.visitId }),
      chartMarks: teeth.map((at) => ({
        chartType: CHART_TYPE.TOOTH_FDI,
        location: { tooth: at, surfaces: teeth.length === 1 ? surfaces : [] },
      })),
    });
  };

  return (
    <>
      <form
        id={formId}
        data-testid="treatment-form"
        className="@container flex max-w-(--form-max) flex-col gap-4"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="grid gap-4 @lg:grid-cols-2">
          <FormField label="chart.panel.procedure" htmlFor={`${fieldId}-procedure`}>
            <Select
              searchable
              id={`${fieldId}-procedure`}
              data-testid="treatment-field-procedure"
              value={procedureId}
              onChange={(event) => setProcedureId(event.target.value)}
              placeholder={t("chart.panel.selectProcedure")}
              options={catalog.map((item) => ({ value: item.id, label: item.name }))}
            />
          </FormField>

          <FormField label="chart.panel.status" htmlFor={`${fieldId}-status`}>
            <Select
              id={`${fieldId}-status`}
              data-testid="treatment-field-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as PerformedProcedureStatus)}
              options={statusChoices(treatment?.status).map((value) => ({
                value,
                label: t(`chart.procedureStatus.${value}`),
              }))}
            />
          </FormField>

          <div className="flex flex-col gap-2">
            <FormField label="chart.panel.doctor" htmlFor={`${fieldId}-doctor`}>
              <Select
                id={`${fieldId}-doctor`}
                data-testid="treatment-field-doctor"
                value={doctorId}
                onChange={(event) => setDoctorId(event.target.value)}
                options={performers.map((doctor) => ({
                  value: doctor.id,
                  label: doctorOptionLabel(doctor, doctorName(doctor.user.name), t),
                }))}
              />
            </FormField>

            {canAddVisitingDoctor(can) && (
              <Button
                icon={<Icon name="user-plus" />}
                variant="quiet"
                size="sm"
                className="self-start"
                data-testid="treatment-add-visitor"
                onClick={() => setAddingVisitor(true)}
              >
                {t("doctors.visiting.create")}
              </Button>
            )}
          </div>

          <FormField label="treatments.plan" htmlFor={`${fieldId}-plan`} optional>
            <Select
              id={`${fieldId}-plan`}
              data-testid="treatment-field-plan"
              value={planId}
              onChange={(event) => setPlanId(event.target.value)}
              options={[
                { value: NO_PLAN_VALUE, label: t("treatments.noPlan") },
                ...plans.map((plan) => ({ value: plan.id, label: plan.title })),
              ]}
            />
          </FormField>
        </div>

        {showPrices && (
          <div className="grid gap-4 @lg:grid-cols-2">
            <FormField label="chart.panel.price" htmlFor={`${fieldId}-price`}>
              <MoneyInput
                id={`${fieldId}-price`}
                data-testid="treatment-field-price"
                currency={currency}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </FormField>

            <FormField label="chart.panel.discount" htmlFor={`${fieldId}-discount`} optional>
              <MoneyInput
                id={`${fieldId}-discount`}
                data-testid="treatment-field-discount"
                currency={currency}
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
              />
            </FormField>
          </div>
        )}

        {showPrices && hasDiscount && (
          <div className="max-w-(--field-max)">
            <FormField label="chart.panel.discountReason" htmlFor={`${fieldId}-reason`}>
              <Input
                id={`${fieldId}-reason`}
                data-testid="treatment-field-discount-reason"
                value={discountReason}
                onChange={(event) => setDiscountReason(event.target.value)}
              />
            </FormField>
          </div>
        )}

        {fixedTooth === undefined && (
          <div className="max-w-(--field-max)">
            <FormField label="visits.teeth" htmlFor={`${fieldId}-teeth`} optional>
              <TeethField id={`${fieldId}-teeth`} value={teeth} onChange={setTeeth} />
            </FormField>
          </div>
        )}

        {teeth.length === 1 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-value font-medium text-ink">{t("chart.panel.surfaces")}</span>
            <SurfaceSelector value={surfaces} onChange={setSurfaces} />
          </div>
        )}

        <FormField label="visits.notes" htmlFor={`${fieldId}-notes`} optional>
          <Textarea
            id={`${fieldId}-notes`}
            data-testid="treatment-field-notes"
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </FormField>

        {error && (
          <p role="alert" data-testid="treatment-form-error" className="text-label text-danger-600">
            {t(error)}
          </p>
        )}
      </form>

      <VisitingDoctorModal
        open={addingVisitor}
        onOpenChange={setAddingVisitor}
        onCreated={setAdded}
      />
    </>
  );
}

export function TreatmentFormActions({
  submitting,
  onCancel,
  formId,
}: {
  readonly submitting: boolean;
  readonly onCancel: () => void;
  readonly formId: string;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <>
      <Button
        icon={<Icon name="x" />}
        type="button"
        variant="secondary"
        data-testid="treatment-form-cancel"
        onClick={onCancel}
      >
        {t("common.cancel")}
      </Button>
      <Button
        icon={<Icon name="check" />}
        type="submit"
        form={formId}
        data-testid="treatment-form-save"
        isLoading={submitting}
      >
        {submitting ? ellipsis(t("common.saving")) : t("common.save")}
      </Button>
    </>
  );
}

const whole = (amount: string): string => String(Math.round(Number(amount)));

function selectable(surfaces: readonly string[]): SelectableSurface[] {
  return surfaces.filter((surface): surface is SelectableSurface =>
    (SELECTABLE_SURFACES as readonly string[]).includes(surface),
  );
}
