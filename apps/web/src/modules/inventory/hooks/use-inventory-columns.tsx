import { LOOKUP_LIST, type InventoryItemRow } from "@clinic/shared";
import { type Column } from "@clinic/ui";
import { ExpiryCell } from "@web/modules/inventory/components/expiry-cell";
import { StockCell } from "@web/modules/inventory/components/stock-cell";
import { useLookupLabels } from "@web/shared/queries/lookups";

export function useInventoryColumns(): readonly Column<InventoryItemRow>[] {
  const categoryLabel = useLookupLabels(LOOKUP_LIST.ITEM_CATEGORY);

  return [
    {
      key: "name",
      header: "inventory.columns.item",
      primary: true,
      render: (row) => (
        <span className="flex flex-col items-start">
          <bdi className="font-medium text-ink">{row.name}</bdi>
          {row.supplierName && (
            <span className="text-label text-ink-muted">{row.supplierName}</span>
          )}
        </span>
      ),
    },
    {
      key: "category",
      header: "inventory.columns.category",
      hideOnMobile: true,
      render: (row) => (
        <span data-testid="inventory-category" className="text-ink-muted">
          {categoryLabel(row.category)}
        </span>
      ),
    },
    {
      key: "quantity",
      header: "inventory.columns.stockOfMinimum",
      render: (row) => <StockCell item={row} />,
    },
    {
      key: "expiry",
      header: "inventory.columns.expiry",
      hideOnMobile: true,
      render: (row) => <ExpiryCell item={row} />,
    },
  ];
}
