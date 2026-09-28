import { USER_ROLE, type SupplierSummary } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Badge,
  Button,
  type Column,
  EmptyState,
  Icon,
  MenuItem,
  PageHeader,
  PhoneLink,
  RowMenu,
  SearchField,
  Table,
  TotalBadge,
  useConfirm,
  useToast,
} from "@clinic/ui";
import { useSession } from "@web/shared/providers/session";
import { Money } from "@web/modules/billing/components/money";
import { useClinic } from "@web/modules/clinic/queries";
import { canManageSuppliers } from "@web/modules/inventory/permissions";
import { useDeleteSupplier, useSuppliers } from "@web/modules/inventory/queries";
import { SupplierFormModal } from "@web/modules/inventory/components/supplier-form-modal";
import { SupplierStatementPanel } from "@web/modules/inventory/components/supplier-statement";
import { errorMessageKey } from "@web/shared/lib/api-error";
import { useDebounced } from "@web/shared/hooks/use-debounced";
import { isRefetching } from "@clinic/ui/lib/use-delayed-loading";

export function SuppliersPage(): JSX.Element {
  const { t } = useTranslation();
  const { user, can } = useSession();
  const clinic = useClinic();
  const toast = useToast();
  const remove = useDeleteSupplier();
  const { confirm, dialog } = useConfirm("supplier-confirm-delete");

  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SupplierSummary | undefined>();
  const [selected, setSelected] = useState<SupplierSummary | null>(null);

  const debounced = useDebounced(search);
  const suppliers = useSuppliers({
    limit: 50,
    includeInactive: true,
    ...(debounced.trim() !== "" && { search: debounced.trim() }),
  });

  const mayManage = canManageSuppliers(can);
  const mayDelete = user?.role === USER_ROLE.ADMIN;

  const askDelete = (supplier: SupplierSummary): void =>
    confirm({
      title: "inventory.suppliers.confirmDelete.title",
      titleValues: { name: supplier.name },
      consequences: [
        t("inventory.suppliers.confirmDelete.history"),
        t("inventory.suppliers.confirmDelete.items"),
      ],
      onConfirm: async () => {
        try {
          await remove.mutateAsync(supplier.id);
          toast.success("inventory.suppliers.deleted");
          if (selected?.id === supplier.id) {
            setSelected(null);
          }
        } catch (error) {
          toast.error(errorMessageKey(error));
          throw error;
        }
      },
    });

  const columns: readonly Column<SupplierSummary>[] = [
    {
      key: "name",
      header: "inventory.suppliers.name",
      primary: true,
      render: (row) => (
        <span className="flex flex-col">
          <span className="font-medium text-ink">{row.name}</span>
          {row.contactPerson && (
            <span className="text-label text-ink-muted">{row.contactPerson}</span>
          )}
        </span>
      ),
    },
    {
      key: "phone",
      header: "inventory.suppliers.phone",
      hideOnMobile: true,
      render: (row) => <PhoneLink value={row.phone} />,
    },
    {
      key: "items",
      header: "inventory.suppliers.items",
      align: "numeric",
      render: (row) => row.itemCount,
    },
    {
      key: "purchased",
      header: "inventory.suppliers.purchased",
      align: "numeric",
      render: (row) => <Money amount={row.purchased} currency={clinic.data?.currency} />,
    },
    {
      key: "state",
      header: "inventory.suppliers.state",
      render: (row) =>
        row.isActive ? null : (
          <Badge tone="neutral" data-testid="supplier-inactive">
            {t("inventory.suppliers.inactive")}
          </Badge>
        ),
    },
    ...(mayManage || mayDelete
      ? [
          {
            key: "actions",
            header: "inventory.suppliers.actions",
            actions: true,
            besideTitleOnMobile: true,
            render: (row: SupplierSummary) => (
              <RowMenu
                label={t("inventory.suppliers.menu")}
                data-testid={`supplier-menu-${row.id}`}
              >
                {mayManage && (
                  <MenuItem
                    icon="edit"
                    data-testid="supplier-edit"
                    onSelect={() => setEditing(row)}
                  >
                    {t("common.edit")}
                  </MenuItem>
                )}
                {mayDelete && (
                  <MenuItem
                    icon="trash"
                    tone="danger"
                    data-testid="supplier-delete"
                    onSelect={() => askDelete(row)}
                  >
                    {t("common.delete")}
                  </MenuItem>
                )}
              </RowMenu>
            ),
          } satisfies Column<SupplierSummary>,
        ]
      : []),
  ];

  return (
    <div data-testid="suppliers-page" className="flex flex-col gap-5">
      <PageHeader
        data-testid="suppliers-header"
        title="inventory.suppliers.title"
        subtitle="inventory.suppliers.subtitle"
        primaryAction={
          mayManage ? (
            <Button
              icon={<Icon name="plus" />}
              data-testid="suppliers-add"
              onClick={() => setCreating(true)}
            >
              {t("inventory.suppliers.add")}
            </Button>
          ) : undefined
        }
      />

      {dialog}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchField
          data-testid="suppliers-search"
          className="w-full min-w-0 sm:max-w-md"
          label={t("inventory.suppliers.search")}
          shortcut="/"
          placeholder={t("inventory.suppliers.searchPlaceholder")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          clearLabel={t("common.clear")}
          onClear={() => setSearch("")}
        />
        {suppliers.data !== undefined && (
          <TotalBadge data-testid="suppliers-count" total={suppliers.data.total} />
        )}
      </div>

      <Table
        data-testid="suppliers-table"
        columns={columns}
        rows={suppliers.data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={suppliers.isPending}
        isRefreshing={isRefetching(suppliers)}
        onRowClick={setSelected}
        rowLabel={(row) => row.name}
        empty={
          <EmptyState
            icon="clipboard"
            data-testid="suppliers-empty"
            title="inventory.suppliers.empty"
            hint="inventory.suppliers.emptyHint"
          />
        }
      />

      {selected && <SupplierStatementPanel supplier={selected} onClose={() => setSelected(null)} />}

      <SupplierFormModal
        data-testid="supplier-create-modal"
        open={creating}
        onOpenChange={setCreating}
      />

      <SupplierFormModal
        data-testid="supplier-edit-modal"
        open={editing !== undefined}
        onOpenChange={(open) => !open && setEditing(undefined)}
        supplier={editing}
      />
    </div>
  );
}
