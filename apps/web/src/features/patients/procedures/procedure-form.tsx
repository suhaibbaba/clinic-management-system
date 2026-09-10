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
} from '@clinic/shared';
import { useEffect, useId, useState, type FormEvent, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  FormField,
  Icon,
  Input,
  MoneyInput,
  Select,
  usePersonName,
} from '@web/components/ui';
import {
  SurfaceSelector,
  type SelectableSurface,
} from '@web/features/patients/chart/surface-selector';
import { canSeePrices } from '@web/features/patients/permissions';
import { useCurrency } from '@web/features/clinic/queries';

export type ProcedureFormValues = Omit<CreatePerformedProcedureInput, 'patientId'>;

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
}

// One form wherever a procedure is recorded; the context arrives as props. The price is prefilled
// but editable, since the API snapshots what it is sent and must not rewrite the catalog.
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
}: ProcedureFormProps): JSX.Element {
  const { t } = useTranslation();
  const currency = useCurrency();
  const doctorName = usePersonName();
  const fieldId = useId();
  const isEdit = procedure !== undefined;

  const [procedureId, setProcedureId] = useState(procedure?.procedureId ?? '');
  const [doctorId, setDoctorId] = useState(procedure?.doctorId ?? doctors[0]?.id ?? '');
  const [status, setStatus] = useState<PerformedProcedureStatus>(
    procedure?.status ?? PERFORMED_PROCEDURE_STATUS.DONE,
  );
  const [surfaces, setSurfaces] = useState<SelectableSurface[]>(initialSurfaces(procedure, tooth));
  const [price, setPrice] = useState(procedure?.price ?? '');
  const [discount, setDiscount] = useState(procedure?.discount ?? '');
  const [discountReason, setDiscountReason] = useState(procedure?.discountReason ?? '');
  const [error, setError] = useState<string | null>(null);

  const showPrices = canSeePrices(role);
  const selected = catalog.find((item) => item.id === procedureId);

  // Prefill when the procedure changes, so switching leaves no stale price. An edit keeps its
  // snapshot: what was charged is history, not a default.
  useEffect(() => {
    if (!isEdit) {
      setPrice(selected?.defaultPrice ?? '');
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
      setError('chart.panel.selectProcedure');
      return;
    }

    const hasDiscount = discount !== '' && discount !== '0' && discount !== '0.00';
    if (hasDiscount && discountReason.trim() === '') {
      setError('chart.panel.discountNeedsReason');
      return;
    }

    setError(null);

    onSubmit({
      doctorId,
      procedureId,
      status,
      discount: hasDiscount ? discount : '0.00',
      ...(showPrices && price !== '' && { price }),
      ...(hasDiscount && { discountReason: discountReason.trim() }),
      ...(visitId !== undefined && { visitId }),
      chartMarks:
        tooth === undefined
          ? []
          : [{ chartType: CHART_TYPE.TOOTH_FDI, location: { tooth, surfaces } }],
    });
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <FormField label="chart.panel.procedure" htmlFor={`${fieldId}-procedure`}>
        <Select
          id={`${fieldId}-procedure`}
          value={procedureId}
          onChange={(event) => setProcedureId(event.target.value)}
          placeholder={t('chart.panel.selectProcedure')}
          options={catalog.map((item) => ({ value: item.id, label: item.nameAr }))}
        />
      </FormField>

      <FormField label="chart.panel.doctor" htmlFor={`${fieldId}-doctor`}>
        <Select
          id={`${fieldId}-doctor`}
          value={doctorId}
          onChange={(event) => setDoctorId(event.target.value)}
          options={doctors.map((doctor) => ({
            value: doctor.id,
            label: doctorName(doctor.user.name),
          }))}
        />
      </FormField>

      <FormField label="chart.panel.status" htmlFor={`${fieldId}-status`}>
        <Select
          id={`${fieldId}-status`}
          value={status}
          onChange={(event) => setStatus(event.target.value as PerformedProcedureStatus)}
          options={PERFORMED_PROCEDURE_STATUSES.map((value) => ({
            value,
            label: t(`chart.procedureStatus.${value}`),
          }))}
        />
      </FormField>

      {/* Surfaces only mean something once a tooth is in play. */}
      {tooth !== undefined && (
        <div className="flex flex-col gap-1.5">
          <span className="text-value font-medium text-ink">{t('chart.panel.surfaces')}</span>
          <SurfaceSelector value={surfaces} onChange={setSurfaces} />
        </div>
      )}

      {showPrices && (
        <>
          <FormField label="chart.panel.price" htmlFor={`${fieldId}-price`}>
            {/* Money is a string all the way through — never a number input. */}
            <MoneyInput
              id={`${fieldId}-price`}
              currency={currency}
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </FormField>

          <FormField label="chart.panel.discount" htmlFor={`${fieldId}-discount`} optional>
            <MoneyInput
              id={`${fieldId}-discount`}
              currency={currency}
              value={discount}
              onChange={(event) => setDiscount(event.target.value)}
            />
          </FormField>

          {discount !== '' && discount !== '0' && discount !== '0.00' && (
            <FormField label="chart.panel.discountReason" htmlFor={`${fieldId}-reason`}>
              <Input
                id={`${fieldId}-reason`}
                value={discountReason}
                onChange={(event) => setDiscountReason(event.target.value)}
              />
            </FormField>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="text-label text-danger-600">
          {t(error)}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          icon={<Icon name="x" />}
          type="button"
          variant="secondary"
          size="sm"
          onClick={onCancel}
        >
          {t('common.cancel')}
        </Button>
        <Button icon={<Icon name="check" />} type="submit" size="sm" disabled={submitting}>
          {t(submitting ? 'common.saving' : 'common.save')}
        </Button>
      </div>
    </form>
  );
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
