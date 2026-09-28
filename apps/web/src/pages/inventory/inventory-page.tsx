import { LOOKUP_LIST } from "@clinic/shared";
import { useMemo, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Button,
  EmptyState,
  Icon,
  PageHeader,
  SearchField,
  Select,
  Table,
  TotalBadge,
  usePageParams,
} from "@clinic/ui";
import { isRefetching } from "@clinic/ui/lib/use-delayed-loading";
import { InventoryAlertCards } from "@web/components/inventory/alert-cards";
import { ItemFormModal } from "@web/components/inventory/item-form-modal";
import { useInventoryColumns } from "@web/hooks/inventory/use-inventory-columns";
import { useInventoryFilters } from "@web/hooks/inventory/use-inventory-filters";
import { canManageInventory } from "@web/permissions/inventory";
import { useSession } from "@web/providers/session";
import { useInventoryItems } from "@web/queries/inventory";
import { useLookupOptions } from "@web/queries/lookups";

export function InventoryPage(): JSX.Element {
  const { t } = useTranslation();
  const categoryOptions = useLookupOptions(LOOKUP_LIST.ITEM_CATEGORY);
  const { can } = useSession();
  const navigate = useNavigate();
  const { page, perPage, setPage, setPerPage, resetPage } = usePageParams();
  const filters = useInventoryFilters(resetPage);
  const { search, category, low, expiring, setSearch, setFilters } = filters;
  const columns = useInventoryColumns();
  const [creating, setCreating] = useState(false);

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

      <ItemFormModal
        data-testid="inventory-item-create-modal"
        open={creating}
        onOpenChange={setCreating}
      />
    </div>
  );
}
