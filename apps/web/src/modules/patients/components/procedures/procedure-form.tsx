import {
  CHART_TYPE,
  PERFORMED_PROCEDURE_STATUS,
  PERFORMED_PROCEDURE_STATUSES,
  type CreatePerformedProcedureInput,
  type Doctor,
  type PerformedProcedure,
  type PerformedProcedureStatus,
  type ProcedureCatalogItem,
  type UserRole,
} from "@clinic/shared";
import { useEffect, useId, useState, type FormEvent, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, FormField, Icon, Input, MoneyInput, Select, usePersonName } from "@clinic/ui";
import { TeethField } from "@web/modules/labs/components/teeth-field";
import {
  SurfaceSelector,
  type SelectableSurface,
} from "@web/modules/patients/components/chart/surface-selector";
import { canSeePrices } from "@web/modules/patients/permissions";
import { useCurrency } from "@web/modules/clinic/queries";
import { ellipsis } from "@web/i18n/ellipsis";

export type ProcedureFormValues = Omit<CreatePerformedProcedureInput, "patientId">;

export interface ProcedureFormProps {
  readonly role: UserRole;
  readonly catalog: readonly ProcedureCatalogItem[];
  readonly doctors: readonly Doctor[];
  readonly submitting: boolean;
  readonly onSubmit: (values: ProcedureFormValues) => void;
  readonly onCancel: () => void;
  readonly tooth?: number | undefined;
  readonly visitId?: string | undefined;
  readonly procedure?: PerformedProcedure | undefined;
  readonly defaultDoctorId?: string | undefined;
  readonly formId?: string | undefined;
}

export function ProcedureForm({
  role,
  catalog,
  doctors,
  submitting,
  onSubmit,
  onCancel,
  tooth,
  visitId,
  procedure,
  defaultDoctorId,
  formId,
}: ProcedureFormProps): JSX.Element {
  const { t } = useTranslation();
  const currency = useCurrency();
  const doctorName = usePersonName();
  const fieldId = useId();
  const isEdit = procedure !== undefined;

  const [procedureId, setProcedureId] = useState(procedure?.procedureId ?? "");
  const [doctorId, setDoctorId] = useState(
    procedure?.doctorId ?? defaultDoctorId ?? doctors[0]?.id ?? "",
  );
  const [status, setStatus] = useState<PerformedProcedureStatus>(
    procedure?.status ?? PERFORMED_PROCEDURE_STATUS.DONE,
  );
  const [teeth, setTeeth] = useState<number[]>(tooth !== undefined ? [tooth] : teethOf(procedure));
  const [surfaces, setSurfaces] = useState<SelectableSurface[]>(
    initialSurfaces(procedure, tooth ?? teethOf(procedure)[0]),
  );

  const [price, setPrice] = useState(procedure ? whole(procedure.price) : "");
  const [discount, setDiscount] = useState(
    procedure && Number(procedure.discount) !== 0 ? whole(procedure.discount) : "",
  );
  const [discountReason, setDiscountReason] = useState(procedure?.discountReason ?? "");
  const [error, setError] = useState<string | null>(null);

  const showPrices = canSeePrices(role);
  const selected = catalog.find((item) => item.id === procedureId);

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
      discount: hasDiscount ? discount : "0.00",
      ...(showPrices && price !== "" && { price }),
      ...(hasDiscount && { discountReason: discountReason.trim() }),
      ...(visitId !== undefined && { visitId }),
      chartMarks: teeth.map((at) => ({
        chartType: CHART_TYPE.TOOTH_FDI,
        location: { tooth: at, surfaces },
      })),
    });
  };

  const hasDiscount = discount !== "" && discount !== "0" && discount !== "0.00";

  return (
    <form
      {...(formId !== undefined && { id: formId })}
      data-testid="procedure-form"
      className="@container flex max-w-(--form-max) flex-col gap-4"
      onSubmit={handleSubmit}
      noValidate
    >
      <div className="grid gap-4 @lg:grid-cols-2">
        <FormField label="chart.panel.procedure" htmlFor={`${fieldId}-procedure`}>
          <Select
            searchable
            id={`${fieldId}-procedure`}
            data-testid="procedure-field-procedure"
            value={procedureId}
            onChange={(event) => setProcedureId(event.target.value)}
            placeholder={t("chart.panel.selectProcedure")}
            options={catalog.map((item) => ({
              value: item.id,
              label: item.name,
            }))}
          />
        </FormField>

        <FormField label="chart.panel.doctor" htmlFor={`${fieldId}-doctor`}>
          <Select
            id={`${fieldId}-doctor`}
            data-testid="procedure-field-doctor"
            value={doctorId}
            onChange={(event) => setDoctorId(event.target.value)}
            options={doctors.map((doctor) => ({
              value: doctor.id,
              label: doctorName(doctor.user.name),
            }))}
          />
        </FormField>
      </div>

      <div className="grid gap-4 @lg:grid-cols-[minmax(0,1fr)_12.5rem_12.5rem]">
        <FormField label="chart.panel.status" htmlFor={`${fieldId}-status`}>
          <Select
            id={`${fieldId}-status`}
            data-testid="procedure-field-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as PerformedProcedureStatus)}
            options={PERFORMED_PROCEDURE_STATUSES.map((value) => ({
              value,
              label: t(`chart.procedureStatus.${value}`),
            }))}
          />
        </FormField>

        {showPrices && (
          <>
            <FormField label="chart.panel.price" htmlFor={`${fieldId}-price`}>
              <MoneyInput
                id={`${fieldId}-price`}
                data-testid="procedure-field-price"
                currency={currency}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </FormField>

            <FormField label="chart.panel.discount" htmlFor={`${fieldId}-discount`} optional>
              <MoneyInput
                id={`${fieldId}-discount`}
                data-testid="procedure-field-discount"
                currency={currency}
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
              />
            </FormField>
          </>
        )}
      </div>

      {showPrices && hasDiscount && (
        <div className="max-w-(--field-max)">
          <FormField label="chart.panel.discountReason" htmlFor={`${fieldId}-reason`}>
            <Input
              id={`${fieldId}-reason`}
              data-testid="procedure-field-discount-reason"
              value={discountReason}
              onChange={(event) => setDiscountReason(event.target.value)}
            />
          </FormField>
        </div>
      )}

      {tooth === undefined && (
        <div className="max-w-(--field-max)">
          <FormField label="visits.tooth" htmlFor={`${fieldId}-teeth`} optional>
            <TeethField single id={`${fieldId}-teeth`} value={teeth} onChange={setTeeth} />
          </FormField>
        </div>
      )}

      {teeth.length === 1 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-value font-medium text-ink">{t("chart.panel.surfaces")}</span>
          <SurfaceSelector value={surfaces} onChange={setSurfaces} />
        </div>
      )}

      {error && (
        <p role="alert" data-testid="procedure-form-error" className="text-label text-danger-600">
          {t(error)}
        </p>
      )}

      {formId === undefined && <ProcedureFormActions submitting={submitting} onCancel={onCancel} />}
    </form>
  );
}

export function ProcedureFormActions({
  submitting,
  onCancel,
  formId,
}: {
  readonly submitting: boolean;
  readonly onCancel: () => void;
  readonly formId?: string | undefined;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        icon={<Icon name="x" />}
        type="button"
        variant="secondary"
        data-testid="procedure-form-cancel"
        onClick={onCancel}
      >
        {t("common.cancel")}
      </Button>
      <Button
        icon={<Icon name="check" />}
        type="submit"
        {...(formId !== undefined && { form: formId })}
        data-testid="procedure-form-save"
        isLoading={submitting}
      >
        {submitting ? ellipsis(t("common.saving")) : t("common.save")}
      </Button>
    </div>
  );
}

const whole = (amount: string): string => String(Math.round(Number(amount)));

function teethOf(procedure: PerformedProcedure | undefined): number[] {
  return (procedure?.chartMarks ?? [])
    .map((entry) => (entry.location as { tooth?: number }).tooth)
    .filter((at): at is number => typeof at === "number");
}

function initialSurfaces(
  procedure: PerformedProcedure | undefined,
  tooth: number | undefined,
): SelectableSurface[] {
  if (!procedure || tooth === undefined) {
    return [];
  }

  const mark = procedure.chartMarks?.find(
    (entry) => (entry.location as { tooth?: number }).tooth === tooth,
  );

  return ((mark?.location as { surfaces?: SelectableSurface[] })?.surfaces ?? []).slice();
}
