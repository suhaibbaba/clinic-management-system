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
import { InventoryAlertCards } from "@web/modules/inventory/components/alert-cards";
import { ItemFormModal } from "@web/modules/inventory/components/item-form-modal";
import { useInventoryColumns } from "@web/modules/inventory/hooks/use-inventory-columns";
import { useInventoryFilters } from "@web/modules/inventory/hooks/use-inventory-filters";
import {
  canConsumeStock,
  canCountStock,
  canManageInventory,
  canPostPurchase,
  canWriteOff,
} from "@web/shared/permissions/inventory";
import { MovementModal } from "@web/modules/inventory/components/movement-modal";
import {
  WriteOffModal,
  type WriteOffTarget,
} from "@web/modules/inventory/components/write-off-modal";
import { STOCK_COUNT_PATH } from "@web/modules/inventory/constants";
import { errorToast } from "@web/shared/lib/api-error";
import { useSession } from "@web/shared/providers/session";
import {
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
            render: (row) => (
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
                  <MenuItem
                    icon="package"
                    data-testid="inventory-row-receive"
                    onSelect={() =>
                      void navigate(
                        `/inventory/purchases/new?item=${row.id}${row.defaultSupplierId ? `&supplier=${row.defaultSupplierId}` : ""}`,
                      )
                    }
                  >
                    {t("inventory.requests.receive")}
                  </MenuItem>
                )}
                {mayWriteOff && (
                  <MenuItem
                    icon="trash"
                    tone="danger"
                    data-testid="inventory-row-write-off"
                    onSelect={() =>
                      setWritingOff({ itemId: row.id, itemName: row.name, batchNo: null })
                    }
                  >
                    {t("inventory.writeOff.action")}
                  </MenuItem>
                )}
              </RowMenu>
            ),
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
            <Button
              variant="secondary"
              icon={<Icon name="clipboard" />}
              data-testid="inventory-shopping-list"
              onClick={() => void navigate("/inventory/shopping-list")}
            >
              {t("inventory.shoppingList.action")}
            </Button>
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
            {canPostPurchase(can) && (
              <Button
                variant="secondary"
                icon={<Icon name="package" />}
                data-testid="inventory-new-purchase"
                onClick={() => void navigate("/inventory/purchases/new")}
              >
                {t("inventory.purchase.action")}
              </Button>
            )}
            {mayManage && (
              <Button
                icon={<Icon name="plus" />}
                data-testid="inventory-add-item"
                onClick={() => setCreating(true)}
              >
                {t("inventory.addItem")}
              </Button>
            )}
          </div>
        }
      />

      <InventoryAlertCards
        onSelectItem={openItem}
        onShowLow={() => setFilters({ low: true, expiring: false })}
        onShowExpiring={() => setFilters({ expiring: true, low: false })}
      />

      <div className="flex flex-wrap items-end gap-3">
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

        <div className="min-w-44">
          <label htmlFor="inventory-category" className="mb-1 block text-label text-ink-muted">
            {t("inventory.filterCategory")}
          </label>
          <Select
            id="inventory-category"
            data-testid="inventory-filter-category"
            value={category}
            placeholder={t("common.all")}
            onChange={(event) => setFilters({ category: event.target.value })}
            options={categoryOptions}
          />
        </div>

        <Button
          variant={low ? "danger" : "secondary"}
          icon={<Icon name="alert" />}
          data-testid="inventory-filter-low"
          className="font-normal"
          onClick={() => setFilters({ low: !low })}
        >
          {t("inventory.filterLow")}
        </Button>

        <Button
          variant={expiring ? "danger" : "secondary"}
          icon={<Icon name="clock" />}
          data-testid="inventory-filter-expiring"
          className="font-normal"
          onClick={() => setFilters({ expiring: !expiring })}
        >
          {t("inventory.filterExpiring")}
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
