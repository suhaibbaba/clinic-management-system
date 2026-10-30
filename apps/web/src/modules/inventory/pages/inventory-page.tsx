import {
  LOOKUP_LIST,
  MOVEMENT_TYPE,
  STOCK_COUNT_STATUS,
  type InventoryItemRow,
} from "@clinic/shared";
import { useMemo, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Button,
  type Column,
  EmptyState,
  Icon,
  MenuItem,
  PageHeader,
  RowMenu,
  SearchField,
  Select,
  Table,
  TotalBadge,
  usePageParams,
  useToast,
} from "@clinic/ui";
import { isRefetching } from "@clinic/ui/lib/use-delayed-loading";
import { useIsMobile } from "@clinic/ui/lib/use-media-query";
import { ItemFormModal } from "@web/modules/inventory/components/item-form-modal";
import { useInventoryColumns } from "@web/modules/inventory/hooks/use-inventory-columns";
import { useInventoryFilters } from "@web/modules/inventory/hooks/use-inventory-filters";
import {
  canConsumeStock,
  canCountStock,
  canManageInventory,
  canPostPurchase,
  canWriteOff,
  seesInventory,
} from "@web/shared/permissions/inventory";
import { MovementModal } from "@web/modules/inventory/components/movement-modal";
import { itemPurchaseLink } from "@web/modules/inventory/lib/purchase-form";
import {
  WriteOffModal,
  type WriteOffTarget,
} from "@web/modules/inventory/components/write-off-modal";
import { STOCK_COUNT_PATH } from "@web/modules/inventory/constants";
import { errorToast } from "@web/shared/lib/api-error";
import { useSession } from "@web/shared/providers/session";
import {
  useInventoryAlerts,
  useInventoryItems,
  useStartStockCount,
  useStockCounts,
} from "@web/modules/inventory/queries";
import { useLookupOptions } from "@web/shared/queries/lookups";

export function InventoryPage(): JSX.Element {
  const { t } = useTranslation();
  const categoryOptions = useLookupOptions(LOOKUP_LIST.ITEM_CATEGORY);
  const { can } = useSession();
  const navigate = useNavigate();
  const { page, perPage, setPage, setPerPage, resetPage } = usePageParams();
  const filters = useInventoryFilters(resetPage);
  const { search, category, low, expiring, setSearch, setFilters } = filters;
  const baseColumns = useInventoryColumns();
  const [creating, setCreating] = useState(false);
  const [using, setUsing] = useState<InventoryItemRow | null>(null);
  const [writingOff, setWritingOff] = useState<WriteOffTarget | null>(null);
  const isMobile = useIsMobile();
  const mayUse = canConsumeStock(can);
  const mayReceive = canPostPurchase(can);
  const mayWriteOff = canWriteOff(can);
  const columns: readonly Column<InventoryItemRow>[] =
    mayUse || mayReceive || mayWriteOff
      ? [
          ...baseColumns,
          {
            key: "actions",
            header: "common.actions",
            actions: true,
            besideTitleOnMobile: true,
            render: (row) => {
              const receive = (): void =>
                void navigate(itemPurchaseLink(row.id, row.defaultSupplierId));
              const writeOff = (): void =>
                setWritingOff({ itemId: row.id, itemName: row.name, batchNo: null });

              return isMobile ? (
                <RowMenu label={t("inventory.rowMenu")} data-testid="inventory-row-actions">
                  {mayUse && (
                    <MenuItem
                      icon="trend-down"
                      data-testid="inventory-row-use"
                      onSelect={() => setUsing(row)}
                    >
                      {t(`inventory.movement.action.${MOVEMENT_TYPE.CONSUME}`)}
                    </MenuItem>
                  )}
                  {mayReceive && (
                    <MenuItem icon="package" data-testid="inventory-row-receive" onSelect={receive}>
                      {t("inventory.requests.receive")}
                    </MenuItem>
                  )}
                  {mayWriteOff && (
                    <MenuItem
                      icon="trash"
                      tone="danger"
                      data-testid="inventory-row-write-off"
                      onSelect={writeOff}
                    >
                      {t("inventory.writeOff.action")}
                    </MenuItem>
                  )}
                </RowMenu>
              ) : (
                <span className="flex items-center justify-end gap-1.5">
                  {mayUse && (
                    <Button
                      size="sm"
                      variant="secondary"
                      data-testid="inventory-row-use"
                      onClick={() => setUsing(row)}
                    >
                      {t(`inventory.movement.action.${MOVEMENT_TYPE.CONSUME}`)}
                    </Button>
                  )}
                  {mayReceive && (
                    <Button
                      size="sm"
                      variant="secondary"
                      data-testid="inventory-row-receive"
                      onClick={receive}
                    >
                      {t("inventory.requests.receive")}
                    </Button>
                  )}
                  {mayWriteOff && (
                    <RowMenu label={t("inventory.rowMenu")} data-testid="inventory-row-actions">
                      <MenuItem
                        icon="trash"
                        tone="danger"
                        data-testid="inventory-row-write-off"
                        onSelect={writeOff}
                      >
                        {t("inventory.writeOff.action")}
                      </MenuItem>
                    </RowMenu>
                  )}
                </span>
              );
            },
          } satisfies Column<InventoryItemRow>,
        ]
      : baseColumns;

  const openItem = (id: string): void => void navigate(`/inventory/items/${id}`);

  const query = useMemo(
    () => ({
      page,
      limit: perPage,
      ...(filters.debouncedSearch !== "" && { search: filters.debouncedSearch }),
      ...(category !== "" && { category }),
      ...(low && { low: true }),
      ...(expiring && { expiring: true }),
    }),
    [page, perPage, filters.debouncedSearch, category, low, expiring],
  );

  const items = useInventoryItems(query);
  const alerts = useInventoryAlerts(seesInventory(can));
  const lowCount = alerts.data?.low.length ?? 0;
  const expiringCount = (alerts.data?.expiring.length ?? 0) + (alerts.data?.expired.length ?? 0);
  const rows = items.data?.items ?? [];
  const mayManage = canManageInventory(can);
  const mayCount = canCountStock(can);
  const counts = useStockCounts(mayCount);
  const startCount = useStartStockCount();
  const toast = useToast();
  const openCount = counts.data?.find((count) => count.status === STOCK_COUNT_STATUS.OPEN);

  const countStock = async (): Promise<void> => {
    if (openCount) {
      void navigate(`${STOCK_COUNT_PATH}/${openCount.id}`);
      return;
    }

    try {
      const created = await startCount.mutateAsync({});
      void navigate(`${STOCK_COUNT_PATH}/${created.id}`);
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <div data-testid="inventory-page" className="flex flex-col gap-5">
      <PageHeader
        data-testid="inventory-header"
        title="inventory.title"
        subtitle="inventory.subtitle"
        primaryAction={
          <div className="flex flex-wrap items-center gap-2">
            {mayCount && (
              <Button
                variant="secondary"
                icon={<Icon name="list" />}
                data-testid="inventory-count-stock"
                isLoading={startCount.isPending}
                onClick={() => void countStock()}
              >
                {t(openCount ? "inventory.counts.resume" : "inventory.counts.start")}
              </Button>
            )}
            {mayManage && (
              <Button
                variant="secondary"
                icon={<Icon name="plus" />}
                data-testid="inventory-add-item"
                onClick={() => setCreating(true)}
              >
                {t("inventory.addItem")}
              </Button>
            )}
            {mayReceive && (
              <Button
                icon={<Icon name="package" />}
                data-testid="inventory-new-purchase"
                onClick={() => void navigate("/inventory/purchases/new")}
              >
                {t("inventory.purchase.action")}
              </Button>
            )}
            <RowMenu size="target" label={t("inventory.moreActions")} data-testid="inventory-more">
              <MenuItem
                icon="clipboard"
                data-testid="inventory-shopping-list"
                onSelect={() => void navigate("/inventory/shopping-list")}
              >
                {t("inventory.shoppingList.action")}
              </MenuItem>
            </RowMenu>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          data-testid="inventory-search"
          className="w-full min-w-0 sm:max-w-md"
          label={t("inventory.search")}
          shortcut="/"
          placeholder={t("inventory.searchPlaceholder")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          clearLabel={t("common.clear")}
          onClear={() => setSearch("")}
        />

        <Select
          id="inventory-category"
          data-testid="inventory-filter-category"
          className="w-auto min-w-44"
          aria-label={t("inventory.filterCategory")}
          value={category}
          placeholder={t("inventory.allCategories")}
          onChange={(event) => setFilters({ category: event.target.value })}
          options={categoryOptions}
        />

        <Button
          variant={low ? "danger" : "secondary"}
          icon={<Icon name="alert" />}
          data-testid="inventory-filter-low"
          aria-pressed={low}
          className="font-normal"
          onClick={() => setFilters({ low: !low })}
        >
          {t("inventory.filterLow")}
          {lowCount > 0 && (
            <span data-testid="inventory-filter-low-count" className="tabular-nums">
              ({lowCount})
            </span>
          )}
        </Button>

        <Button
          variant={expiring ? "danger" : "secondary"}
          icon={<Icon name="clock" />}
          data-testid="inventory-filter-expiring"
          aria-pressed={expiring}
          className="font-normal"
          onClick={() => setFilters({ expiring: !expiring })}
        >
          {t("inventory.filterExpiring")}
          {expiringCount > 0 && (
            <span data-testid="inventory-filter-expiring-count" className="tabular-nums">
              ({expiringCount})
            </span>
          )}
        </Button>

        {items.data !== undefined && (
          <span className="ms-auto flex h-(--control-h) items-center">
            <TotalBadge data-testid="inventory-count" total={items.data.total} />
          </span>
        )}
      </div>

      <Table
        data-testid="inventory-table"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        isLoading={items.isPending}
        isRefreshing={isRefetching(items)}
        onRowClick={(row) => openItem(row.id)}
        rowLabel={(row) => row.name}
        empty={
          <EmptyState
            icon="clipboard"
            data-testid="inventory-empty"
            title="inventory.empty"
            hint="inventory.emptyHint"
          />
        }
        pagination={{
          page,
          totalPages: items.data?.totalPages ?? 0,
          onPageChange: setPage,
          perPage,
          onPerPageChange: setPerPage,
        }}
      />

      <MovementModal
        data-testid="inventory-use-modal"
        type={using ? MOVEMENT_TYPE.CONSUME : null}
        item={using ?? undefined}
        onClose={() => setUsing(null)}
      />
      <WriteOffModal target={writingOff} onClose={() => setWritingOff(null)} />

      <ItemFormModal
        data-testid="inventory-item-create-modal"
        open={creating}
        onOpenChange={setCreating}
      />
    </div>
  );
}
