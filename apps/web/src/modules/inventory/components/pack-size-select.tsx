import { LOOKUP_LIST } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Select } from "@clinic/ui";
import { useLookupLabels } from "@web/shared/queries/lookups";
import { usePackSizes } from "@web/modules/inventory/queries";

export function PackSizeSelect({
  id,
  itemId,
  baseUnit,
  value,
  onChange,
}: {
  readonly id: string;
  readonly itemId: string;
  readonly baseUnit: string;
  readonly value: string;
  readonly onChange: (packSizeId: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);
  const packs = usePackSizes(itemId);

  if (!packs.data || packs.data.length === 0) {
    return (
      <Select
        disabled
        id={id}
        data-testid="purchase-line-pack"
        aria-label={t("inventory.packSizes.buyIn")}
        value={baseUnit === "" ? "" : "base"}
        placeholder="—"
        onChange={() => undefined}
        options={baseUnit === "" ? [] : [{ value: "base", label: unitLabel(baseUnit) }]}
      />
    );
  }

  return (
    <Select
      id={id}
      data-testid="purchase-line-pack"
      aria-label={t("inventory.packSizes.buyIn")}
      value={value === "" ? "base" : value}
      onChange={(event) => onChange(event.target.value === "base" ? "" : event.target.value)}
      options={[
        { value: "base", label: unitLabel(baseUnit) },
        ...packs.data.map((pack) => ({
          value: pack.id,
          label: t("inventory.packSizes.holdsShort", {
            pack: unitLabel(pack.unit),
            count: Number(pack.unitsPer),
            unit: unitLabel(baseUnit),
          }),
        })),
      ]}
    />
  );
}
