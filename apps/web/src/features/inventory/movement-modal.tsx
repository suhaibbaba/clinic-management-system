import {
  MOVEMENT_TYPE,
  type InventoryItemRow,
  type MovementType,
  type UserRole,
} from '@clinic/shared';
import { useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  DatePicker,
  FormField,
  Input,
  Modal,
  Select,
  Textarea,
  useToast,
} from '@web/components/ui';
import { PatientPicker, type PickedPatient } from '@web/features/appointments/patient-picker';
import { useSession } from '@web/features/auth/session';
import { unitLabel } from '@web/features/inventory/display';
import {
  canAdjustStock,
  canConsumeStock,
  canPurchaseStock,
} from '@web/features/inventory/permissions';
import {
  useAdjustStock,
  useConsumeStock,
  usePurchaseStock,
  useSuppliers,
} from '@web/features/inventory/queries';
import { errorMessageKey } from '@web/lib/api-error';

/** Which roles may open which form — the ROLES.md split, as a lookup. */
export const mayRecord = (type: MovementType, role: UserRole | undefined): boolean =>
  ({
    [MOVEMENT_TYPE.PURCHASE]: canPurchaseStock,
    [MOVEMENT_TYPE.CONSUME]: canConsumeStock,
    [MOVEMENT_TYPE.ADJUST]: canAdjustStock,
  })[type](role);

export interface MovementModalProps {
  readonly type: MovementType | null;
  readonly item: InventoryItemRow | undefined;
  readonly onClose: () => void;
  /** Pre-links a consumption to a patient, from the visit screen. */
  readonly patient?: PickedPatient | undefined;
  readonly performedProcedureId?: string | undefined;
}

/**
 * شراء / صرف / تسوية — one form, three shapes.
 *
 * The three share a quantity field and nothing else, which is exactly why the
 * fields are switched on the type rather than all shown and half disabled: a
 * purchase has a price, a supplier and a batch; a consumption may name a
 * patient; an adjustment must say why, and is the only one that may go
 * negative. A form that showed all of them at once would be asking a
 * technician to know which half to ignore.
 *
 * The sign is never a field. "How many did you use" is answered with a
 * positive number and stored negative, because nobody types a minus sign to
 * mean "used" — the exception is the adjustment, where the direction *is* the
 * information.
 */
export function MovementModal({
  type,
  item,
  onClose,
  patient,
  performedProcedureId,
}: MovementModalProps): JSX.Element | null {
  const { t } = useTranslation();
  const toast = useToast();
  const { user } = useSession();

  const purchase = usePurchaseStock();
  const consume = useConsumeStock();
  const adjust = useAdjustStock();

  const suppliers = useSuppliers({ limit: 100 });

  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [reason, setReason] = useState('');
  const [direction, setDirection] = useState<'add' | 'remove'>('remove');
  const [linkedPatient, setLinkedPatient] = useState<PickedPatient | null>(null);

  useEffect(() => {
    if (type === null) {
      return;
    }

    setQuantity('');
    setUnitPrice('');
    setSupplierId(item?.defaultSupplierId ?? '');
    setBatchNo('');
    setExpiryDate('');
    setReason('');
    setDirection('remove');
    setLinkedPatient(patient ?? null);
  }, [type, item, patient]);

  if (type === null || !item) {
    return null;
  }

  const busy = purchase.isPending || consume.isPending || adjust.isPending;
  const canSubmit =
    quantity.trim() !== '' && (type !== MOVEMENT_TYPE.ADJUST || reason.trim().length >= 3);

  const submit = async (): Promise<void> => {
    try {
      if (type === MOVEMENT_TYPE.PURCHASE) {
        await purchase.mutateAsync({
          itemId: item.id,
          quantity: quantity.trim(),
          ...(unitPrice.trim() !== '' && { unitPrice: unitPrice.trim() }),
          ...(supplierId !== '' && { supplierId }),
          ...(batchNo.trim() !== '' && { batchNo: batchNo.trim() }),
          ...(expiryDate !== '' && { expiryDate }),
        });
      } else if (type === MOVEMENT_TYPE.CONSUME) {
        await consume.mutateAsync({
          itemId: item.id,
          quantity: quantity.trim(),
          ...(linkedPatient && { patientId: linkedPatient.id }),
          ...(performedProcedureId && { performedProcedureId }),
          ...(batchNo.trim() !== '' && { batchNo: batchNo.trim() }),
          ...(reason.trim() !== '' && { reason: reason.trim() }),
        });
      } else {
        await adjust.mutateAsync({
          itemId: item.id,
          // The one place a sign is chosen rather than implied.
          quantity: `${direction === 'remove' ? '-' : ''}${quantity.trim()}`,
          reason: reason.trim(),
          ...(batchNo.trim() !== '' && { batchNo: batchNo.trim() }),
        });
      }

      toast.success(`inventory.movement.recorded.${type}`);
      onClose();
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={t(`inventory.movement.title.${type}`, { item: item.nameAr })}
      description={t(`inventory.movement.description.${type}`)}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!canSubmit} isLoading={busy} onClick={() => void submit()}>
            {t(`inventory.movement.submit.${type}`)}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* What is on the shelf right now, so the number being typed has
            something to be judged against. */}
        <div className="flex items-baseline justify-between rounded-panel bg-inset px-3 py-2">
          <span className="text-label text-ink-muted">{t('inventory.movement.onHand')}</span>
          <span className="flex items-baseline gap-1.5">
            <span dir="ltr" className="font-semibold tabular-nums text-ink">
              {item.quantity}
            </span>
            <span className="text-label text-ink-muted">{t(unitLabel(item.unit))}</span>
          </span>
        </div>

        {type === MOVEMENT_TYPE.ADJUST && (
          <FormField label="inventory.movement.direction" htmlFor="movement-direction">
            <Select
              id="movement-direction"
              value={direction}
              onChange={(event) => setDirection(event.target.value as 'add' | 'remove')}
              options={[
                { value: 'remove', label: t('inventory.movement.directions.remove') },
                { value: 'add', label: t('inventory.movement.directions.add') },
              ]}
            />
          </FormField>
        )}

        <FormField
          label="inventory.movement.quantity"
          htmlFor="movement-quantity"
          hint={t(unitLabel(item.unit))}
          required
        >
          <Input
            id="movement-quantity"
            dir="ltr"
            inputMode="decimal"
            placeholder="0"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </FormField>

        {type === MOVEMENT_TYPE.PURCHASE && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="inventory.movement.unitPrice" htmlFor="movement-price" optional>
                <Input
                  id="movement-price"
                  dir="ltr"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={unitPrice}
                  onChange={(event) => setUnitPrice(event.target.value)}
                />
              </FormField>

              <FormField label="inventory.movement.supplier" htmlFor="movement-supplier" optional>
                <Select
                  id="movement-supplier"
                  value={supplierId}
                  placeholder={t('inventory.movement.selectSupplier')}
                  onChange={(event) => setSupplierId(event.target.value)}
                  options={(suppliers.data?.items ?? []).map((supplier) => ({
                    value: supplier.id,
                    label: supplier.name,
                  }))}
                />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="inventory.movement.batchNo" htmlFor="movement-batch" optional>
                <Input
                  id="movement-batch"
                  dir="ltr"
                  placeholder="LX-2451"
                  value={batchNo}
                  onChange={(event) => setBatchNo(event.target.value)}
                />
              </FormField>

              <FormField label="inventory.movement.expiry" htmlFor="movement-expiry" optional>
                <DatePicker
                  id="movement-expiry"
                  label={t('inventory.movement.expiry')}
                  value={expiryDate}
                  onChange={setExpiryDate}
                />
              </FormField>
            </div>
          </>
        )}

        {type === MOVEMENT_TYPE.CONSUME && !performedProcedureId && (
          <FormField label="inventory.movement.patient" htmlFor="movement-patient" optional>
            <PatientPicker
              id="movement-patient"
              value={linkedPatient}
              onChange={setLinkedPatient}
            />
          </FormField>
        )}

        {type === MOVEMENT_TYPE.CONSUME && performedProcedureId && (
          <p className="rounded-panel bg-inset px-3 py-2 text-label text-ink-muted">
            {t('inventory.movement.linkedToProcedure')}
          </p>
        )}

        <FormField
          label={
            type === MOVEMENT_TYPE.ADJUST ? 'inventory.movement.reason' : 'inventory.movement.note'
          }
          htmlFor="movement-reason"
          {...(type === MOVEMENT_TYPE.ADJUST
            ? { required: true, hint: t('inventory.movement.reasonHint') }
            : { optional: true })}
        >
          <Textarea
            id="movement-reason"
            rows={2}
            placeholder={
              type === MOVEMENT_TYPE.ADJUST ? t('inventory.movement.reasonPlaceholder') : ''
            }
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </FormField>

        {/* Cosmetic only: the API refuses the same thing, and says so. */}
        {!mayRecord(type, user?.role) && (
          <p role="alert" className="text-label text-danger-600">
            {t('inventory.movement.notAllowed')}
          </p>
        )}
      </div>
    </Modal>
  );
}
