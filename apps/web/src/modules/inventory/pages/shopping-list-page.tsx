import { LOOKUP_LIST, type ShoppingListLine } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  Icon,
  Ltr,
  Money,
  PageHeader,
  Table,
  type Column,
} from "@clinic/ui";
import { shoppingListSource } from "@web/modules/inventory/lib/documents";
import { purchaseLink } from "@web/modules/inventory/lib/shopping-list";
import { DocumentActions } from "@web/shared/components/document-actions";
import { canPostPurchase, canSeeCosts } from "@web/shared/permissions/inventory";
import { useSession } from "@web/shared/providers/session";
import { useCurrency } from "@web/shared/queries/clinic";
import { useLookupLabels } from "@web/shared/queries/lookups";
import { categoryTone } from "@web/modules/inventory/lib/display";
import { useShoppingList } from "@web/modules/inventory/queries";
import { formatDate } from "@web/shared/lib/format";
import { isRefetching } from "@clinic/ui/lib/use-delayed-loading";

export function ShoppingListPage(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useSession();
  const currency = useCurrency();
  const categoryLabel = useLookupLabels(LOOKUP_LIST.ITEM_CATEGORY);
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);
  const list = useShoppingList();
  const mayBuy = canPostPurchase(can);
  const seesCosts = canSeeCosts(can);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());

  const lines = list.data?.lines ?? [];
  const chosen = lines.filter((line) => picked.has(line.itemId));
  const allPicked = lines.length > 0 && chosen.length === lines.length;

  const toggle = (itemId: string, on: boolean): void =>
    setPicked((current) => {
      const next = new Set(current);

      if (on) {
        next.add(itemId);
      } else {
        next.delete(itemId);
      }

      return next;
    });

  const columns: readonly Column<ShoppingListLine>[] = [
    {
      key: "item",
      header: "inventory.columns.item",
      primary: true,
      render: (row) =>
        mayBuy ? (
          <Checkbox
            data-testid="shopping-list-pick"
            checked={picked.has(row.itemId)}
            onCheckedChange={(on) => toggle(row.itemId, on)}
            label={row.name}
          />
        ) : (
          <bdi className="font-medium text-ink">{row.name}</bdi>
        ),
    },
    {
      key: "supplier",
      header: "inventory.movement.supplier",
      render: (row) =>
        row.supplierName ? (
          <bdi className="text-ink">{row.supplierName}</bdi>
        ) : (
          <span className="text-ink-subtle">—</span>
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
    ...(seesCosts
      ? [
          {
            key: "lastPrice",
            header: "inventory.shoppingList.lastPrice",
            align: "numeric",
            render: (row) =>
              row.lastPrice ? (
                <Money cents amount={row.lastPrice} currency={currency} />
              ) : (
                <span className="text-ink-subtle">—</span>
              ),
          } satisfies Column<ShoppingListLine>,
        ]
      : []),
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
            variant={mayBuy ? "secondary" : "primary"}
            label={t("inventory.shoppingList.print")}
            source={
              lines.length > 0 ? shoppingListSource(can("inventory.sendShoppingList")) : undefined
            }
          />
        }
      />

      <Table
        data-testid="shopping-list-table"
        columns={columns}
        rows={lines}
        rowKey={(row) => row.itemId}
        isLoading={list.isPending}
        isRefreshing={isRefetching(list)}
        header={
          mayBuy && lines.length > 0 ? (
            <div
              data-testid="shopping-list-selection"
              className="flex w-full flex-wrap items-center justify-between gap-3"
            >
              <Checkbox
                data-testid="shopping-list-pick-all"
                checked={allPicked}
                indeterminate={chosen.length > 0 && !allPicked}
                onCheckedChange={(on) =>
                  setPicked(on ? new Set(lines.map((line) => line.itemId)) : new Set())
                }
                label={
                  chosen.length > 0
                    ? t("inventory.shoppingList.picked", { count: chosen.length })
                    : t("inventory.shoppingList.pickAll")
                }
              />
              <Button
                data-testid="shopping-list-buy"
                icon={<Icon name="package" />}
                aria-disabled={chosen.length === 0 || undefined}
                onClick={() => {
                  if (chosen.length > 0) {
                    void navigate(purchaseLink(chosen));
                  }
                }}
              >
                {t("inventory.shoppingList.buy")}
              </Button>
            </div>
          ) : undefined
        }
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
