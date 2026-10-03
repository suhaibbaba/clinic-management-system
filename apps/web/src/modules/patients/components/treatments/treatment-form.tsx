import {
  CHART_TYPE,
  createPerformedProcedureSchema,
  updatePerformedProcedureSchema,
  type CreatePerformedProcedureInput,
  type Doctor,
  type PerformedProcedure,
  type PerformedProcedureStatus,
  type ProcedureCatalogItem,
} from "@clinic/shared";
import { useEffect, useId, useState, type FormEvent, type JSX } from "react";
import { schemaErrors, type FieldErrors } from "@web/shared/lib/form-errors";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
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
import {
  SurfaceSelector,
  type SelectableSurface,
} from "@web/modules/patients/components/chart/surface-selector";
import {
  statusChoices,
  treatmentSurfaces,
  treatmentTeeth,
} from "@web/modules/patients/lib/treatments/treatments";
import { SELECTABLE_SURFACES } from "@web/modules/patients/constants";
import { doctorOptionLabel } from "@web/shared/lib/doctor-label";
import { useCurrency } from "@web/shared/queries/clinic";
import { ellipsis } from "@web/i18n/ellipsis";

export type TreatmentFormValues = Omit<CreatePerformedProcedureInput, "patientId">;

export interface TreatmentDefaults {
  readonly tooth?: number | undefined;
  readonly visitId?: string | undefined;
  readonly status?: PerformedProcedureStatus | undefined;
  readonly doctorId?: string | undefined;
  readonly performedAt?: string | undefined;
}

export interface TreatmentFormProps {
  readonly patientId: string;
  readonly showPrices: boolean;
  readonly catalog: readonly ProcedureCatalogItem[];
  readonly doctors: readonly Doctor[];
  readonly defaults: TreatmentDefaults;
  readonly treatment?: PerformedProcedure | undefined;
  readonly formId: string;
  readonly onSubmit: (values: TreatmentFormValues) => void;
  readonly onValidityChange?: ((valid: boolean) => void) | undefined;
}

export function TreatmentForm({
  patientId,
  showPrices,
  catalog,
  doctors,
  defaults,
  treatment,
  formId,
  onSubmit,
  onValidityChange,
}: TreatmentFormProps): JSX.Element {
  const { t } = useTranslation();
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

  const selected = catalog.find((item) => item.id === procedureId);
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

  const values: TreatmentFormValues = {
    doctorId,
    procedureId,
    status,
    discount: hasDiscount ? discount : "0.00",
    notes: notes.trim() === "" ? null : notes.trim(),
    ...(showPrices && price !== "" && { price }),
    ...(hasDiscount && { discountReason: discountReason.trim() }),
    ...(!isEdit && defaults.visitId !== undefined && { visitId: defaults.visitId }),
    ...(!isEdit && defaults.performedAt !== undefined && { performedAt: defaults.performedAt }),
    chartMarks: teeth.map((at) => ({
      chartType: CHART_TYPE.TOOTH_FDI,
      location: { tooth: at, surfaces: teeth.length === 1 ? surfaces : [] },
    })),
  };

  const form = useFormErrors<HTMLFormElement>(
    isEdit
      ? schemaErrors(updatePerformedProcedureSchema, values)
      : schemaErrors(createPerformedProcedureSchema, { ...values, patientId }),
  );
  const { errors } = form;

  useEffect(() => {
    onValidityChange?.(form.isValid);
  }, [form.isValid, onValidityChange]);

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();

    if (!form.check()) {
      return;
    }

    onSubmit(values);
  };

  return (
    <>
      <form
        ref={form.formRef}
        id={formId}
        data-testid="treatment-form"
        className="@container flex max-w-(--form-max) flex-col gap-4"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="grid gap-4 @lg:grid-cols-2">
          <div onBlur={form.leave("procedureId")}>
            <FormField
              label="chart.panel.procedure"
              htmlFor={`${fieldId}-procedure`}
              error={errors["procedureId"]}
            >
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
          </div>

          <div onBlur={form.leave("status")}>
            <FormField
              label="chart.panel.status"
              htmlFor={`${fieldId}-status`}
              error={errors["status"]}
            >
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
          </div>

          <div className="flex flex-col gap-2">
            <div onBlur={form.leave("doctorId")}>
              <FormField
                label="chart.panel.doctor"
                htmlFor={`${fieldId}-doctor`}
                error={errors["doctorId"]}
              >
                <Select
                  id={`${fieldId}-doctor`}
                  data-testid="treatment-field-doctor"
                  value={doctorId}
                  onChange={(event) => setDoctorId(event.target.value)}
                  options={doctors.map((doctor) => ({
                    value: doctor.id,
                    label: doctorOptionLabel(doctor, doctorName(doctor.user.name), t),
                  }))}
                />
              </FormField>
            </div>
          </div>
        </div>

        {showPrices && (
          <div className="grid gap-4 @lg:grid-cols-2">
            <div onBlur={form.leave("price")}>
              <FormField
                label="chart.panel.price"
                htmlFor={`${fieldId}-price`}
                error={errors["price"]}
              >
                <MoneyInput
                  id={`${fieldId}-price`}
                  data-testid="treatment-field-price"
                  currency={currency}
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                />
              </FormField>
            </div>

            <div onBlur={form.leave("discount")}>
              <FormField
                label="chart.panel.discount"
                htmlFor={`${fieldId}-discount`}
                error={errors["discount"]}
                optional
              >
                <MoneyInput
                  id={`${fieldId}-discount`}
                  data-testid="treatment-field-discount"
                  currency={currency}
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                />
              </FormField>
            </div>
          </div>
        )}

        {showPrices && hasDiscount && (
          <div className="max-w-(--field-max)">
            <div onBlur={form.leave("discountReason")}>
              <FormField
                label="chart.panel.discountReason"
                htmlFor={`${fieldId}-reason`}
                error={errors["discountReason"]}
                errorKey="chart.panel.discountNeedsReason"
              >
                <Input
                  id={`${fieldId}-reason`}
                  data-testid="treatment-field-discount-reason"
                  value={discountReason}
                  onChange={(event) => setDiscountReason(event.target.value)}
                />
              </FormField>
            </div>
          </div>
        )}

        {fixedTooth === undefined && (
          <div className="max-w-(--field-max)">
            <div onBlur={form.leave("chartMarks")}>
              <FormField
                label="visits.teeth"
                htmlFor={`${fieldId}-teeth`}
                error={fieldError(errors, "chartMarks")}
                optional
              >
                <TeethField id={`${fieldId}-teeth`} value={teeth} onChange={setTeeth} />
              </FormField>
            </div>
          </div>
        )}

        {teeth.length === 1 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-value font-medium text-ink">{t("chart.panel.surfaces")}</span>
            <SurfaceSelector value={surfaces} onChange={setSurfaces} />
          </div>
        )}

        <div onBlur={form.leave("notes")}>
          <FormField
            label="visits.notes"
            htmlFor={`${fieldId}-notes`}
            error={errors["notes"]}
            optional
          >
            <Textarea
              id={`${fieldId}-notes`}
              data-testid="treatment-field-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </FormField>
        </div>
      </form>
    </>
  );
}

export function TreatmentFormActions({
  submitting,
  invalid,
  onCancel,
  formId,
}: {
  readonly submitting: boolean;
  readonly invalid: boolean;
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
        aria-disabled={invalid || undefined}
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

function fieldError(errors: FieldErrors, field: string): FieldErrors[string] | undefined {
  return Object.entries(errors).find(([key]) => key === field || key.startsWith(`${field}.`))?.[1];
}
