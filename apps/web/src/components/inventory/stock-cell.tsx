import { LOOKUP_LIST, type InventoryItemRow } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Ltr, ProgressBar } from "@clinic/ui";
import { stockScale, stockTone } from "@web/lib/inventory/display";
import { useLookupLabels } from "@web/queries/lookups";

export function StockCell({ item }: { readonly item: InventoryItemRow }): JSX.Element {
  const { t } = useTranslation();
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);
  const scale = stockScale(item);

  return (
    <span data-testid="inventory-stock-cell" className="flex min-w-28 flex-col gap-1">
      <span className="flex items-baseline gap-1.5">
        <Ltr className="font-medium tabular-nums text-ink">{item.quantity}</Ltr>
        <span className="text-label text-ink-muted">{unitLabel(item.unit)}</span>
        {item.isLow && (
          <Badge tone="danger" className="ms-auto" data-testid="inventory-flag-low">
            {t("inventory.flags.low")}
          </Badge>
        )}
      </span>

      <ProgressBar
        data-testid="inventory-stock-bar"
        value={scale.value}
        total={scale.total}
        tone={stockTone(item)}
        label={t("inventory.stockBar", {
          quantity: item.quantity,
          minimum: item.minQuantity,
        })}
      />

      <span className="text-label text-ink-subtle">
        {t("inventory.minimum")}: <Ltr>{item.minQuantity}</Ltr> {unitLabel(item.unit)}
      </span>
    </span>
  );
}
