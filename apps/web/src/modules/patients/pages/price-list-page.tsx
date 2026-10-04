import { LOOKUP_LIST, type ProcedureCatalogItem } from "@clinic/shared";
import { useMemo, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  Badge,
  Button,
  EmptyState,
  Icon,
  Ltr,
  MenuItem,
  Money,
  PageHeader,
  RowMenu,
  SearchField,
  Switch,
  Table,
  TotalBadge,
  useConfirm,
  useToast,
  type Column,
} from "@clinic/ui";
import { isRefetching } from "@clinic/ui/lib/use-delayed-loading";
import { ProcedurePriceModal } from "@web/modules/patients/components/price-list/procedure-price-modal";
import { searchPriceList } from "@web/modules/patients/lib/price-list";
import {
  usePriceList,
  useRemoveCatalogItem,
  useUpdateCatalogItem,
} from "@web/modules/patients/queries";
import { errorToast } from "@web/shared/lib/api-error";
import { useSession } from "@web/shared/providers/session";
import { useCurrency } from "@web/shared/queries/clinic";
import { useLookupLabels } from "@web/shared/queries/lookups";

export function PriceListPage(): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const { can } = useSession();
  const currency = useCurrency();
  const outcomeLabel = useLookupLabels(LOOKUP_LIST.TOOTH_STATE);

  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const setSearch = (value: string): void =>
    setParams(value === "" ? {} : { q: value }, { replace: true });

  const query = usePriceList();
  const update = useUpdateCatalogItem();
  const remove = useRemoveCatalogItem();
  const { confirm, dialog } = useConfirm("price-list-confirm-delete");

  const [editing, setEditing] = useState<ProcedureCatalogItem | null>(null);
  const [adding, setAdding] = useState(false);

  const mayCreate = can("procedure-catalog.create");
  const mayUpdate = can("procedure-catalog.update");
  const mayRemove = can("procedure-catalog.remove");

  const rows = useMemo(() => searchPriceList(query.data ?? [], search), [query.data, search]);

  const fail = (error: unknown): void => toast.error(...errorToast(error));

  const toggle = async (item: ProcedureCatalogItem): Promise<void> => {
    try {
      await update.mutateAsync({ id: item.id, body: { isActive: !item.isActive } });
    } catch (error) {
      fail(error);
    }
  };

  const destroy = (item: ProcedureCatalogItem): void => {
    confirm({
      title: "priceList.confirmDelete.title",
      titleValues: { name: item.name },
      consequences: [t("priceList.confirmDelete.consequence")],
      onConfirm: async () => {
        try {
          await remove.mutateAsync(item.id);
          toast.success("priceList.deleted");
        } catch (error) {
          fail(error);
          throw error;
        }
      },
    });
  };

  const addButton = (testId: string): JSX.Element => (
    <Button icon={<Icon name="plus" />} data-testid={testId} onClick={() => setAdding(true)}>
      {t("priceList.add")}
    </Button>
  );

  const columns: Column<ProcedureCatalogItem>[] = [
    {
      key: "name",
      header: "priceList.name",
      primary: true,
      render: (item) => (
        <span className="flex min-w-0 flex-col leading-label">
          <Ltr data-testid="price-row-name" className="break-words font-medium text-ink">
            {item.name}
          </Ltr>
          <Ltr data-testid="price-row-code" className="text-label text-ink-subtle">
            {item.code}
          </Ltr>
        </span>
      ),
    },
    {
      key: "price",
      header: "priceList.price",
      align: "numeric",
      render: (item) => (
        <Money data-testid="price-row-amount" amount={item.defaultPrice} currency={currency} />
      ),
    },
    {
      key: "outcome",
      header: "priceList.outcome",
      hideOnMobile: true,
      render: (item) =>
        item.chartOutcome ? (
          <span data-testid="price-row-outcome">{outcomeLabel(item.chartOutcome)}</span>
        ) : (
          <span className="text-ink-subtle">{t("priceList.noOutcome")}</span>
        ),
    },
    {
      key: "status",
      header: "priceList.status",
      render: (item) =>
        mayUpdate ? (
          <div className="flex items-center gap-2">
            <Switch
              data-testid="price-row-active"
              checked={item.isActive}
              label={t(item.isActive ? "priceList.deactivate" : "priceList.activate")}
              hideLabel
              onCheckedChange={() => void toggle(item)}
            />
            <span className="text-label text-ink-muted">
              {t(item.isActive ? "priceList.active" : "priceList.inactive")}
            </span>
          </div>
        ) : (
          <Badge tone={item.isActive ? "success" : "neutral"} data-testid="price-row-status">
            {t(item.isActive ? "priceList.active" : "priceList.inactive")}
          </Badge>
        ),
    },
    ...(mayUpdate || mayRemove
      ? [
          {
            key: "actions",
            header: "common.actions",
            actions: true,
            besideTitleOnMobile: true,
            render: (item: ProcedureCatalogItem) => (
              <RowMenu label={t("priceList.rowMenu")} data-testid="price-row-menu">
                {mayUpdate && (
                  <MenuItem
                    icon="edit"
                    data-testid="price-row-edit"
                    onSelect={() => setEditing(item)}
                  >
                    {t("common.edit")}
                  </MenuItem>
                )}
                {mayRemove && (
                  <MenuItem
                    icon="trash"
                    tone="danger"
                    data-testid="price-row-delete"
                    onSelect={() => destroy(item)}
                  >
                    {t("common.delete")}
                  </MenuItem>
                )}
              </RowMenu>
            ),
          },
        ]
      : []),
  ];

  return (
    <div data-testid="price-list-page" className="flex flex-col gap-5">
      {dialog}
      <PageHeader
        data-testid="price-list-header"
        title="priceList.title"
        subtitle="priceList.subtitle"
        primaryAction={mayCreate ? addButton("price-list-add") : undefined}
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchField
          data-testid="price-list-search"
          className="w-full min-w-0 sm:max-w-md sm:flex-1"
          label={t("common.search")}
          shortcut="/"
          placeholder={t("priceList.searchPlaceholder")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          clearLabel={t("common.clear")}
          onClear={() => setSearch("")}
        />

        {query.data !== undefined && (
          <TotalBadge data-testid="price-list-count" className="ms-auto" total={rows.length} />
        )}
      </div>

      <Table
        data-testid="price-list-table"
        columns={columns}
        rows={rows}
        rowKey={(item) => item.id}
        isLoading={query.isPending}
        isRefreshing={isRefetching(query)}
        empty={
          <EmptyState
            data-testid="price-list-empty"
            icon="list"
            title={search === "" ? "priceList.empty" : "priceList.noMatch"}
            hint={search === "" ? "priceList.emptyHint" : undefined}
            action={search === "" && mayCreate ? addButton("price-list-empty-add") : undefined}
          />
        }
      />

      <ProcedurePriceModal
        open={adding || editing !== null}
        item={editing}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
      />
    </div>
  );
}
