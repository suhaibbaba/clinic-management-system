import { LOOKUP_LIST, type InventoryItemRow } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Ltr, ProgressBar } from "@clinic/ui";
import { cn } from "@clinic/ui/lib/cn";
import { stockScale, stockTone } from "@web/modules/inventory/lib/display";
import { STOCK_DOT } from "@web/modules/inventory/constants";
import { useLookupLabels } from "@web/shared/queries/lookups";

export function StockCell({ item }: { readonly item: InventoryItemRow }): JSX.Element {
  const { t } = useTranslation();
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);
  const scale = stockScale(item);
  const tone = stockTone(item);

  return (
    <span data-testid="inventory-stock-cell" className="flex min-w-0 items-center gap-2">
      <span
        aria-hidden="true"
        data-part="stock-dot"
        className={cn("size-2 shrink-0 rounded-full", STOCK_DOT[tone])}
      />
      <Ltr className="font-semibold tabular-nums text-ink">{item.quantity}</Ltr>
      <span className="whitespace-nowrap text-label text-ink-muted">
        {t("inventory.ofMinimum", { minimum: item.minQuantity, unit: unitLabel(item.unit) })}
      </span>
      <ProgressBar
        data-testid="inventory-stock-bar"
        className="w-16 shrink-0"
        value={scale.value}
        total={scale.total}
        tone={tone}
        label={t("inventory.stockBar", {
          quantity: item.quantity,
          minimum: item.minQuantity,
        })}
      />
    </span>
  );
}
