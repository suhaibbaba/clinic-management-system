import { LOOKUP_LIST, createInventoryItemSchema, type InventoryItemRow } from "@clinic/shared";
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
import { useLookupLabels, useLookupOptions } from "@web/shared/queries/lookups";
import { useCreateItem, useSuppliers, useUpdateItem } from "@web/modules/inventory/queries";
import { errorToast } from "@web/shared/lib/api-error";
import { schemaErrors } from "@web/shared/lib/form-errors";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";

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

  const shared = {
    name: name.trim(),
    category,
    minQuantity: minQuantity.trim() === "" ? "0" : minQuantity.trim(),
    defaultSupplierId: supplierId === "" ? null : supplierId,
    notes: notes.trim() === "" ? null : notes.trim(),
    isActive,
  };

  const form = useFormErrors(schemaErrors(createInventoryItemSchema, { ...shared, unit }));
  const { reset } = form;
  const isPending = create.isPending || update.isPending;

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
    reset();
  }, [open, item, categoryOptions, unitOptions, reset]);

  const submit = async (): Promise<void> => {
    if (!form.check()) {
      return;
    }

    try {
      if (item) {
        await update.mutateAsync({ id: item.id, body: shared });
      } else {
        await create.mutateAsync({ ...shared, unit });
      }

      toast.success(item ? "inventory.item.updated" : "inventory.item.created");
      onOpenChange(false);
    } catch (error) {
      toast.error(...errorToast(error));
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
            aria-disabled={!form.isValid || isPending || undefined}
            isLoading={isPending}
            onClick={() => void submit()}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div ref={form.formRef} data-testid={`${testId}-form`} className="flex flex-col gap-4">
        <div onBlur={form.leave("name")}>
          <FormField
            error={form.errors["name"]}
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
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div onBlur={form.leave("category")}>
            <FormField
              error={form.errors["category"]}
              label="inventory.item.category"
              htmlFor="item-category"
              required
            >
              <Select
                id="item-category"
                data-testid="item-field-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                options={categoryOptions}
              />
            </FormField>
          </div>
          <div onBlur={form.leave("unit")}>
            <FormField
              error={form.errors["unit"]}
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
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div onBlur={form.leave("minQuantity")}>
            <FormField
              error={form.errors["minQuantity"]}
              label="inventory.item.minQuantity"
              htmlFor="item-min"
              hint={t("inventory.item.minHint")}
            >
              <QuantityInput
                id="item-min"
                data-testid="item-field-min"
                placeholder="0"
                value={minQuantity}
                {...(unit && { suffix: unitLabel(unit) })}
                onChange={(event) => setMinQuantity(event.target.value)}
              />
            </FormField>
          </div>
          <div onBlur={form.leave("defaultSupplierId")}>
            <FormField
              error={form.errors["defaultSupplierId"]}
              label="inventory.item.supplier"
              htmlFor="item-supplier"
              optional
            >
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
        </div>
        <div onBlur={form.leave("notes")}>
          <FormField
            error={form.errors["notes"]}
            label="inventory.notes"
            htmlFor="item-notes"
            optional
          >
            <Textarea
              id="item-notes"
              data-testid="item-field-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </FormField>
        </div>
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
