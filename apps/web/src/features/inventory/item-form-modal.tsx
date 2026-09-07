import {
  ITEM_CATEGORIES,
  ITEM_UNITS,
  type InventoryItemRow,
  type ItemCategory,
  type ItemUnit,
} from '@clinic/shared';
import { useEffect, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  FormField,
  Input,
  Modal,
  Select,
  Switch,
  Textarea,
  useToast,
} from '@web/components/ui';
import { categoryLabel, unitLabel } from '@web/features/inventory/display';
import { useCreateItem, useSuppliers, useUpdateItem } from '@web/features/inventory/queries';
import { errorMessageKey } from '@web/lib/api-error';

/**
 * A line in the cupboard.
 *
 * Two things are deliberately absent. There is no quantity field — the only
 * way stock moves is a movement, which is the whole ledger rule (CLAUDE.md) —
 * and the **unit cannot be changed** once the item exists, because every
 * movement already recorded is a number in that unit and reinterpreting forty
 * boxes as forty millilitres is not an edit. The select says so rather than
 * silently vanishing.
 */
export function ItemFormModal({
  open,
  onOpenChange,
  item,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly item?: InventoryItemRow | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();

  const create = useCreateItem();
  const update = useUpdateItem();
  const suppliers = useSuppliers({ limit: 100 });

  const [nameAr, setNameAr] = useState('');
  const [category, setCategory] = useState<ItemCategory>(ITEM_CATEGORIES[0]);
  const [unit, setUnit] = useState<ItemUnit>(ITEM_UNITS[0]);
  const [minQuantity, setMinQuantity] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) {
      return;
    }

    setNameAr(item?.nameAr ?? '');
    setCategory(item?.category ?? ITEM_CATEGORIES[0]);
    setUnit(item?.unit ?? ITEM_UNITS[0]);
    setMinQuantity(item?.minQuantity ?? '');
    setSupplierId(item?.defaultSupplierId ?? '');
    setNotes(item?.notes ?? '');
    setIsActive(item?.isActive ?? true);
  }, [open, item]);

  const submit = async (): Promise<void> => {
    try {
      const shared = {
        nameAr: nameAr.trim(),
        category,
        minQuantity: minQuantity.trim() === '' ? '0' : minQuantity.trim(),
        defaultSupplierId: supplierId === '' ? null : supplierId,
        notes: notes.trim() === '' ? null : notes.trim(),
        isActive,
      };

      if (item) {
        await update.mutateAsync({ id: item.id, body: shared });
      } else {
        await create.mutateAsync({ ...shared, unit });
      }

      toast.success(item ? 'inventory.item.updated' : 'inventory.item.created');
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t(item ? 'inventory.item.editTitle' : 'inventory.item.newTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={nameAr.trim().length < 2}
            isLoading={create.isPending || update.isPending}
            onClick={() => void submit()}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="inventory.item.name" htmlFor="item-name" required>
          <Input
            id="item-name"
            value={nameAr}
            onChange={(event) => setNameAr(event.target.value)}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="inventory.item.category" htmlFor="item-category" required>
            <Select
              id="item-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as ItemCategory)}
              options={ITEM_CATEGORIES.map((value) => ({
                value,
                label: t(categoryLabel(value)),
              }))}
            />
          </FormField>

          <FormField
            label="inventory.item.unit"
            htmlFor="item-unit"
            {...(item ? { hint: t('inventory.item.unitLocked') } : { required: true })}
          >
            <Select
              id="item-unit"
              value={unit}
              disabled={Boolean(item)}
              onChange={(event) => setUnit(event.target.value as ItemUnit)}
              options={ITEM_UNITS.map((value) => ({ value, label: t(unitLabel(value)) }))}
            />
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="inventory.item.minQuantity"
            htmlFor="item-min"
            hint={t('inventory.item.minHint')}
          >
            <Input
              id="item-min"
              dir="ltr"
              inputMode="decimal"
              placeholder="0"
              value={minQuantity}
              onChange={(event) => setMinQuantity(event.target.value)}
            />
          </FormField>

          <FormField label="inventory.item.supplier" htmlFor="item-supplier" optional>
            <Select
              id="item-supplier"
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

        <FormField label="inventory.notes" htmlFor="item-notes" optional>
          <Textarea
            id="item-notes"
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </FormField>

        <Switch
          checked={isActive}
          onCheckedChange={setIsActive}
          label={t('inventory.item.active')}
        />
      </div>
    </Modal>
  );
}
