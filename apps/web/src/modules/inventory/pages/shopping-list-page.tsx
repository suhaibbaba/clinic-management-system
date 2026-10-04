import { LOOKUP_LIST, type ShoppingListLine } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Badge, EmptyState, Ltr, PageHeader, Table, type Column } from "@clinic/ui";
import { shoppingListSource } from "@web/modules/inventory/lib/documents";
import { DocumentActions } from "@web/shared/components/document-actions";
import { useSession } from "@web/shared/providers/session";
import { useLookupLabels } from "@web/shared/queries/lookups";
import { categoryTone } from "@web/modules/inventory/lib/display";
import { useShoppingList } from "@web/modules/inventory/queries";
import { formatDate } from "@web/shared/lib/format";
import { isRefetching } from "@clinic/ui/lib/use-delayed-loading";

export function ShoppingListPage(): JSX.Element {
  const { t } = useTranslation();
  const { can } = useSession();
  const categoryLabel = useLookupLabels(LOOKUP_LIST.ITEM_CATEGORY);
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);
  const list = useShoppingList();

  const columns: readonly Column<ShoppingListLine>[] = [
    {
      key: "item",
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
      hideOnMobile: true,
      render: (row) => (
        <Badge tone={categoryTone(row.category)} data-testid="shopping-list-category">
          {categoryLabel(row.category)}
        </Badge>
      ),
    },
    {
      key: "current",
      header: "inventory.shoppingList.current",
      align: "numeric",
      render: (row) => <Ltr className="text-danger-600">{row.quantity}</Ltr>,
    },
    {
      key: "minimum",
      header: "inventory.minimum",
      align: "numeric",
      hideOnMobile: true,
      render: (row) => <Ltr>{row.minQuantity}</Ltr>,
    },
    {
      key: "suggested",
      header: "inventory.shoppingList.suggested",
      align: "numeric",
      render: (row) => (
        <span className="flex items-baseline justify-end gap-1.5">
          <Ltr className="font-medium text-ink">{row.suggested}</Ltr>
          <span className="text-label text-ink-muted">{unitLabel(row.unit)}</span>
        </span>
      ),
    },
  ];

  return (
    <div data-testid="shopping-list-page" className="flex flex-col gap-5">
      <PageHeader
        data-testid="shopping-list-header"
        title="inventory.shoppingList.title"
        subtitle="inventory.shoppingList.subtitle"
        actions={
          <DocumentActions
            data-testid="shopping-list-print"
            variant="primary"
            label={t("inventory.shoppingList.print")}
            source={
              (list.data?.lines.length ?? 0) > 0
                ? shoppingListSource(can("inventory.sendShoppingList"))
                : undefined
            }
          />
        }
      />

      <Table
        data-testid="shopping-list-table"
        columns={columns}
        rows={list.data?.lines ?? []}
        rowKey={(row) => row.itemId}
        isLoading={list.isPending}
        isRefreshing={isRefetching(list)}
        empty={
          <EmptyState
            icon="check"
            data-testid="shopping-list-empty"
            title="inventory.shoppingList.empty"
            hint="inventory.shoppingList.emptyHint"
          />
        }
      />

      {list.data && list.data.lines.length > 0 && (
        <p data-testid="shopping-list-note" className="text-label text-ink-muted">
          {t("inventory.shoppingList.note")} — <Ltr>{formatDate(list.data.generatedAt)}</Ltr>
        </p>
      )}
    </div>
  );
}
