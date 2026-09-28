import { LOOKUP_LIST, type InventoryItemRow } from "@clinic/shared";
import { Badge, type Column } from "@clinic/ui";
import { ExpiryCell } from "@web/modules/inventory/components/expiry-cell";
import { StockCell } from "@web/modules/inventory/components/stock-cell";
import { categoryTone } from "@web/modules/inventory/lib/display";
import { useLookupLabels } from "@web/shared/queries/lookups";

export function useInventoryColumns(): readonly Column<InventoryItemRow>[] {
  const categoryLabel = useLookupLabels(LOOKUP_LIST.ITEM_CATEGORY);

  return [
    {
      key: "name",
      header: "inventory.columns.item",
      primary: true,
      render: (row) => (
        <span className="flex flex-col">
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
      render: (row) => (
        <Badge tone={categoryTone(row.category)} data-testid="inventory-category">
          {categoryLabel(row.category)}
        </Badge>
      ),
    },
    {
      key: "quantity",
      header: "inventory.columns.quantity",
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
