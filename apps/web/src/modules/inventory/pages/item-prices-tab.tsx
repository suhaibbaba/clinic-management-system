import { LOOKUP_LIST, type ItemPrice } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { type Column, EmptyState, Ltr, Table } from "@clinic/ui";
import { formatDate } from "@web/shared/lib/format";
import { useCurrency } from "@web/shared/queries/clinic";
import { useLookupLabels } from "@web/shared/queries/lookups";
import { Money } from "@web/shared/components/money";
import { useItemPrices } from "@web/modules/inventory/queries";

export function ItemPricesTab({
  itemId,
  baseUnit,
}: {
  readonly itemId: string;
  readonly baseUnit: string;
}): JSX.Element {
  const { t } = useTranslation();
  const currency = useCurrency();
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);
  const prices = useItemPrices(itemId, true);

  const columns: readonly Column<ItemPrice>[] = [
    {
      key: "date",
      header: "inventory.prices.columns.date",
      primary: true,
      render: (row) => (
        <span className="flex flex-col items-start">
          <Ltr className="font-medium text-ink">
            {formatDate(`${row.receivedOn}T12:00:00.000Z`)}
          </Ltr>
          <Ltr className="text-label text-ink-muted">{row.receiptNumber}</Ltr>
        </span>
      ),
    },
    {
      key: "supplier",
      header: "inventory.prices.columns.supplier",
      render: (row) =>
        row.supplierName ? <bdi>{row.supplierName}</bdi> : t("inventory.purchase.noSupplier"),
    },
    {
      key: "quantity",
      header: "inventory.prices.columns.quantity",
      render: (row) => (
        <span>
          <Ltr>{row.quantity}</Ltr> {unitLabel(row.purchaseUnit ?? baseUnit)}
        </span>
      ),
    },
    {
      key: "price",
      header: "inventory.prices.columns.price",
      align: "numeric",
      render: (row) =>
        row.unitPrice ? <Money cents amount={row.unitPrice} currency={currency} /> : "—",
    },
    {
      key: "cost",
      header: "inventory.prices.columns.cost",
      align: "numeric",
      render: (row) => (row.unitCost ? <Ltr>{row.unitCost}</Ltr> : "—"),
    },
  ];

  return (
    <Table
      data-testid="item-prices-table"
      columns={columns}
      rows={prices.data ?? []}
      rowKey={(row) => row.receiptLineId}
      isLoading={prices.isPending}
      empty={
        <EmptyState icon="coins" data-testid="item-prices-empty" title="inventory.prices.empty" />
      }
    />
  );
}
