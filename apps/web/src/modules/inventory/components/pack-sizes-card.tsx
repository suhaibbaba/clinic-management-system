import { LOOKUP_LIST } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, FormField, Icon, QuantityInput, Select, useToast } from "@clinic/ui";
import { errorToast } from "@web/shared/lib/api-error";
import { useLookupLabels, useLookupOptions } from "@web/shared/queries/lookups";
import { useAddPackSize, useArchivePackSize, usePackSizes } from "@web/modules/inventory/queries";

export function PackSizesCard({
  itemId,
  baseUnit,
  mayManage,
}: {
  readonly itemId: string;
  readonly baseUnit: string;
  readonly mayManage: boolean;
}): JSX.Element | null {
  const { t } = useTranslation();
  const toast = useToast();
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);
  const unitOptions = useLookupOptions(LOOKUP_LIST.ITEM_UNIT).filter(
    (option) => option.value !== baseUnit,
  );
  const packs = usePackSizes(itemId);
  const add = useAddPackSize();
  const archive = useArchivePackSize();
  const [unit, setUnit] = useState("");
  const [unitsPer, setUnitsPer] = useState("");
  const chosen = unit || (unitOptions[0]?.value ?? "");
  const ready = chosen !== "" && Number(unitsPer || "0") > 1 && !add.isPending;
  const rows = packs.data ?? [];

  if (!mayManage && rows.length === 0) {
    return null;
  }

  const submit = async (): Promise<void> => {
    if (!ready) {
      return;
    }

    try {
      await add.mutateAsync({ itemId, body: { unit: chosen, unitsPer: unitsPer.trim() } });
      setUnitsPer("");
      toast.success("inventory.packSizes.added");
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  const remove = async (id: string): Promise<void> => {
    try {
      await archive.mutateAsync(id);
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <Card data-testid="pack-sizes">
      <h2 className="text-value font-medium text-ink">{t("inventory.packSizes.title")}</h2>
      <p className="text-label text-ink-muted">{t("inventory.packSizes.hint")}</p>

      {rows.length > 0 && (
        <ul className="mt-3 flex flex-col divide-y divide-line">
          {rows.map((pack) => (
            <li
              key={pack.id}
              data-testid="pack-size"
              data-id={pack.id}
              className="flex items-center justify-between gap-3 py-2"
            >
              <span className="text-value">
                {t("inventory.packSizes.holds", {
                  pack: unitLabel(pack.unit),
                  count: Number(pack.unitsPer),
                  unit: unitLabel(baseUnit),
                })}
                {pack.supplierName && (
                  <span className="text-label text-ink-muted">
                    {" · "}
                    <bdi>{pack.supplierName}</bdi>
                  </span>
                )}
              </span>
              {mayManage && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Icon name="trash" />}
                  data-testid="pack-size-remove"
                  aria-disabled={archive.isPending || undefined}
                  onClick={() => void remove(pack.id)}
                >
                  {t("common.delete")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {mayManage && (
        <div className="mt-3 grid items-end gap-3 sm:grid-cols-[1fr_8rem_auto]">
          <FormField label="inventory.packSizes.pack" htmlFor="pack-size-unit">
            <Select
              id="pack-size-unit"
              data-testid="pack-size-unit"
              value={chosen}
              onChange={(event) => setUnit(event.target.value)}
              options={unitOptions}
            />
          </FormField>
          <FormField label="inventory.packSizes.unitsPer" htmlFor="pack-size-units">
            <QuantityInput
              id="pack-size-units"
              data-testid="pack-size-units"
              placeholder="-"
              value={unitsPer}
              onChange={(event) => setUnitsPer(event.target.value)}
            />
          </FormField>
          <Button
            variant="secondary"
            icon={<Icon name="plus" />}
            data-testid="pack-size-add"
            isLoading={add.isPending}
            aria-disabled={!ready || undefined}
            onClick={() => void submit()}
          >
            {t("inventory.packSizes.add")}
          </Button>
        </div>
      )}
    </Card>
  );
}
