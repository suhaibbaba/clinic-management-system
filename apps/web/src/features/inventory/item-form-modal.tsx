import { LOOKUP_LIST, type InventoryItemRow } from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  FormField,
  Input,
  Modal,
  QuantityInput,
  Select,
  Switch,
  Textarea,
  useToast,
} from "@clinic/ui";
import { useLookupLabels, useLookupOptions } from "@web/features/lookups/queries";
import { useCreateItem, useSuppliers, useUpdateItem } from "@web/features/inventory/queries";
import { errorMessageKey } from "@web/lib/api-error";

export function ItemFormModal({
  open,
  onOpenChange,
  item,
  "data-testid": testId = "item-form-modal",
}: {
  readonly "data-testid"?: string | undefined;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly item?: InventoryItemRow | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const categoryOptions = useLookupOptions(LOOKUP_LIST.ITEM_CATEGORY);
  const unitOptions = useLookupOptions(LOOKUP_LIST.ITEM_UNIT);
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);
  const toast = useToast();

  const create = useCreateItem();
  const update = useUpdateItem();
  const suppliers = useSuppliers({ limit: 100 });

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("");
  const [minQuantity, setMinQuantity] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) {
      return;
    }

    setName(item?.name ?? "");
    setCategory(item?.category ?? categoryOptions[0]?.value ?? "");
    setUnit(item?.unit ?? unitOptions[0]?.value ?? "");
    setMinQuantity(item?.minQuantity ?? "");
    setSupplierId(item?.defaultSupplierId ?? "");
    setNotes(item?.notes ?? "");
    setIsActive(item?.isActive ?? true);
  }, [open, item, categoryOptions, unitOptions]);

  const submit = async (): Promise<void> => {
    try {
      const shared = {
        name: name.trim(),
        category,
        minQuantity: minQuantity.trim() === "" ? "0" : minQuantity.trim(),
        defaultSupplierId: supplierId === "" ? null : supplierId,
        notes: notes.trim() === "" ? null : notes.trim(),
        isActive,
      };

      if (item) {
        await update.mutateAsync({ id: item.id, body: shared });
      } else {
        await create.mutateAsync({ ...shared, unit });
      }

      toast.success(item ? "inventory.item.updated" : "inventory.item.created");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <Modal
      data-testid={testId}
      open={open}
      onOpenChange={onOpenChange}
      title={t(item ? "inventory.item.editTitle" : "inventory.item.newTitle")}
      footer={
        <>
          <Button
            variant="secondary"
            data-testid={`${testId}-cancel`}
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            data-testid={`${testId}-save`}
            disabled={name.trim().length < 2}
            isLoading={create.isPending || update.isPending}
            onClick={() => void submit()}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div data-testid={`${testId}-form`} className="flex flex-col gap-4">
        <FormField
          label="inventory.item.name"
          htmlFor="item-name"
          hint="inventory.item.nameHint"
          required
        >
          <Input
            id="item-name"
            data-testid="item-field-name"
            dir="ltr"
            placeholder="Composite A2"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="inventory.item.category" htmlFor="item-category" required>
            <Select
              id="item-category"
              data-testid="item-field-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              options={categoryOptions}
            />
          </FormField>
          <FormField
            label="inventory.item.unit"
            htmlFor="item-unit"
            {...(item ? { hint: t("inventory.item.unitLocked") } : { required: true })}
          >
            <Select
              id="item-unit"
              data-testid="item-field-unit"
              value={unit}
              disabled={Boolean(item)}
              onChange={(event) => setUnit(event.target.value)}
              options={unitOptions}
            />
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="inventory.item.minQuantity"
            htmlFor="item-min"
            hint={t("inventory.item.minHint")}
          >
            <QuantityInput
              id="item-min"
              data-testid="item-field-min"
              placeholder="0"
              value={minQuantity}
              // The unit the minimum is counted in: "5" alone does not say five of what.
              {...(unit && { suffix: unitLabel(unit) })}
              onChange={(event) => setMinQuantity(event.target.value)}
            />
          </FormField>
          <FormField label="inventory.item.supplier" htmlFor="item-supplier" optional>
            <Select
              id="item-supplier"
              data-testid="item-field-supplier"
              value={supplierId}
              placeholder={t("inventory.movement.selectSupplier")}
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
            data-testid="item-field-notes"
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </FormField>
        <Switch
          data-testid="item-field-active"
          checked={isActive}
          onCheckedChange={setIsActive}
          label={t("inventory.item.active")}
        />
      </div>
    </Modal>
  );
}
