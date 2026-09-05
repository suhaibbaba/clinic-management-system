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

import { Button, FormField, Input, Select } from '@web/components/ui';
import {
  SurfaceSelector,
  type SelectableSurface,
} from '@web/features/patients/chart/surface-selector';
import { canSeePrices } from '@web/features/patients/permissions';

/** What the form emits; the caller supplies the patient it belongs to. */
export type ProcedureFormValues = Omit<CreatePerformedProcedureInput, 'patientId'>;

export interface ProcedureFormProps {
  readonly role: UserRole;
  readonly catalog: readonly ProcedureCatalogItem[];
  readonly doctors: readonly Doctor[];
  readonly submitting: boolean;
  readonly onSubmit: (values: ProcedureFormValues) => void;
  readonly onCancel: () => void;
  /**
   * Fixes the procedure to one tooth and shows the surface picker. Omitted
   * where the tooth is not the subject — a procedure recorded against a visit
   * may have no location at all.
   */
  readonly tooth?: number | undefined;
  /** Links the record to the visit it happened in. */
  readonly visitId?: string | undefined;
  /** Editing an existing procedure rather than recording a new one. */
  readonly procedure?: PerformedProcedure | undefined;
}

/**
 * The one form that records a procedure, wherever it is recorded from.
 *
 * It started life inside the tooth panel and is now shared with the visits tab,
 * because the questions are the same in both places: which procedure, who did
 * it, how far along it is, what it cost. What differs is the context the caller
 * already knows — a tooth, a visit, or neither — which arrives as props rather
 * than being asked for again.
 *
 * Money stays a string throughout; the price is prefilled from the catalog but
 * editable, since the API snapshots what it is sent and a one-off price must
 * never rewrite the catalog. A discount requires a reason — the shared Zod
 * schema's rule, enforced here rather than waiting for a 400.
 */
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

  // Prefill from the catalog when the procedure changes, so switching never
  // leaves the previous one's price behind. An edit keeps its snapshot: the
  // price that was charged is history, not a default to re-derive.
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

      {/* Surfaces only mean something once a tooth is in play. */}
      {tooth !== undefined && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">{t('chart.panel.surfaces')}</span>
          <SurfaceSelector value={surfaces} onChange={setSurfaces} />
        </div>
      )}

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
        <p role="alert" className="text-xs text-danger-600">
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

/** Surfaces already recorded on this tooth, when editing. */
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
