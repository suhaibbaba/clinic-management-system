import {
  CHART_TYPE,
  PERFORMED_PROCEDURE_STATUS,
  PERFORMED_PROCEDURE_STATUSES,
  type CreatePerformedProcedureInput,
  type Doctor,
  type PerformedProcedureStatus,
  type ProcedureCatalogItem,
  type UserRole,
} from '@clinic/shared';
import { useEffect, useId, useState, type FormEvent, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, FormField, Input, Select } from '@web/components/ui';
import {
  SurfaceSelector,
  type SelectableSurface,
} from '@web/features/patients/chart/surface-selector';
import { canSeePrices } from '@web/features/patients/permissions';

/** The form knows the tooth and the procedure; the panel supplies the patient. */
export type NewProcedureInput = Omit<CreatePerformedProcedureInput, 'patientId'>;

export interface AddProcedureFormProps {
  readonly tooth: number;
  readonly role: UserRole;
  readonly catalog: readonly ProcedureCatalogItem[];
  readonly doctors: readonly Doctor[];
  readonly submitting: boolean;
  readonly onSubmit: (input: NewProcedureInput) => void;
  readonly onCancel: () => void;
}

/**
 * Records a procedure on one tooth.
 *
 * The tooth is fixed by the chart, so the form only asks for what it cannot
 * know: which procedure, which surfaces, how far along it is, and what it costs.
 * The price is prefilled from the catalog but stays editable — the API
 * snapshots whatever is sent, so a one-off price never rewrites the catalog.
 *
 * A discount requires a reason. That is the shared Zod schema's rule; the form
 * enforces it up front rather than waiting for a 400.
 */
export function AddProcedureForm({
  tooth,
  role,
  catalog,
  doctors,
  submitting,
  onSubmit,
  onCancel,
}: AddProcedureFormProps): JSX.Element {
  const { t } = useTranslation();
  const fieldId = useId();

  const [procedureId, setProcedureId] = useState('');
  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? '');
  const [status, setStatus] = useState<PerformedProcedureStatus>(PERFORMED_PROCEDURE_STATUS.DONE);
  const [surfaces, setSurfaces] = useState<SelectableSurface[]>([]);
  const [price, setPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const showPrices = canSeePrices(role);
  const selected = catalog.find((item) => item.id === procedureId);

  // Prefill from the catalog on every change of procedure, so switching
  // procedures never leaves the previous one's price behind.
  useEffect(() => {
    setPrice(selected?.defaultPrice ?? '');
  }, [selected]);

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
      chartMarks: [{ chartType: CHART_TYPE.TOOTH_FDI, location: { tooth, surfaces } }],
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
          options={doctors.map((doctor) => ({ value: doctor.id, label: doctor.user.name }))}
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

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-gray-800">{t('chart.panel.surfaces')}</span>
        <SurfaceSelector value={surfaces} onChange={setSurfaces} />
      </div>

      {showPrices && (
        <>
          <FormField label="chart.panel.price" htmlFor={`${fieldId}-price`}>
            {/* Money is a string all the way through — never a number input. */}
            <Input
              id={`${fieldId}-price`}
              value={price}
              inputMode="decimal"
              dir="ltr"
              onChange={(event) => setPrice(event.target.value)}
            />
          </FormField>

          <FormField label="chart.panel.discount" htmlFor={`${fieldId}-discount`} optional>
            <Input
              id={`${fieldId}-discount`}
              value={discount}
              inputMode="decimal"
              dir="ltr"
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
        <p role="alert" className="text-xs text-red-600">
          {t(error)}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={submitting}>
          {t(submitting ? 'common.saving' : 'common.save')}
        </Button>
      </div>
    </form>
  );
}
