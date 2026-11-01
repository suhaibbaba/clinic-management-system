import { LOOKUP_LIST, type ProcedureCatalogItem } from "@clinic/shared";
import { useMemo, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  Badge,
  Button,
  Checkbox,
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
import { SpecialtiesModal } from "@web/modules/patients/components/price-list/specialties-modal";
import { searchPriceList } from "@web/modules/patients/lib/price-list";
import {
  usePriceList,
  useRemoveCatalogItem,
  useRemoveCatalogItems,
  useSetCatalogItemsActive,
  useUpdateCatalogItem,
} from "@web/modules/patients/queries";
import { errorToast } from "@web/shared/lib/api-error";
import { useLocalized } from "@web/shared/hooks/use-localized";
import { useSession } from "@web/shared/providers/session";
import { useCurrency } from "@web/shared/queries/clinic";
import { useLookupLabels } from "@web/shared/queries/lookups";

export function PriceListPage(): JSX.Element {
  const { t } = useTranslation();
  const text = useLocalized();
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
  const setActive = useSetCatalogItemsActive();
  const removeMany = useRemoveCatalogItems();
  const { confirm, dialog } = useConfirm("price-list-confirm-delete");

  const [editing, setEditing] = useState<ProcedureCatalogItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [managingSpecialties, setManagingSpecialties] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());

  const mayCreate = can("procedure-catalog.create");
  const mayUpdate = can("procedure-catalog.update");
  const mayRemove = can("procedure-catalog.remove");
  const maySeeSpecialties = can("specialties.list");
  const maySwitchMany = can("procedure-catalog.setActive");
  const mayRemoveMany = can("procedure-catalog.removeMany");
  const mayPick = maySwitchMany || mayRemoveMany;

  const rows = useMemo(() => searchPriceList(query.data ?? [], search), [query.data, search]);
  const chosen = rows.filter((item) => picked.has(item.id));
  const allPicked = rows.length > 0 && chosen.length === rows.length;
  const busy = setActive.isPending || removeMany.isPending;

  const fail = (error: unknown): void => toast.error(...errorToast(error));

  const toggle = async (item: ProcedureCatalogItem): Promise<void> => {
    try {
      await update.mutateAsync({ id: item.id, body: { isActive: !item.isActive } });
    } catch (error) {
      fail(error);
    }
  };

  const pick = (id: string, on: boolean): void =>
    setPicked((current) => {
      const next = new Set(current);

      if (on) {
        next.add(id);
      } else {
        next.delete(id);
      }

      return next;
    });

  const switchChosen = async (isActive: boolean): Promise<void> => {
    if (chosen.length === 0 || busy) {
      return;
    }

    try {
      await setActive.mutateAsync({ ids: chosen.map((item) => item.id), isActive });
      toast.success(isActive ? "priceList.enabledMany" : "priceList.disabledMany", {
        count: chosen.length,
      });
      setPicked(new Set());
    } catch (error) {
      fail(error);
    }
  };

  const destroyChosen = (): void => {
    if (chosen.length === 0 || busy) {
      return;
    }

    const ids = chosen.map((item) => item.id);

    confirm({
      title: "priceList.confirmDeleteMany.title",
      titleValues: { count: ids.length },
      consequences: [t("priceList.confirmDelete.consequence")],
      onConfirm: async () => {
        try {
          await removeMany.mutateAsync({ ids });
          toast.success("priceList.deletedMany", { count: ids.length });
          setPicked(new Set());
        } catch (error) {
          fail(error);
          throw error;
        }
      },
    });
  };

  const destroy = (item: ProcedureCatalogItem): void => {
    confirm({
      title: "priceList.confirmDelete.title",
      titleValues: { name: text(item.name) },
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
        <span className="flex min-w-0 items-center gap-3">
          {mayPick && (
            <Checkbox
              data-testid="price-row-pick"
              checked={picked.has(item.id)}
              onCheckedChange={(on) => pick(item.id, on)}
              label={t("priceList.selectOne", { name: text(item.name) })}
              hideLabel
            />
          )}
          <span className="flex min-w-0 flex-col leading-label">
            <span
              dir="auto"
              data-testid="price-row-name"
              className="break-words font-medium text-ink"
            >
              {text(item.name)}
            </span>
            <Ltr data-testid="price-row-code" className="text-label text-ink-subtle">
              {item.code}
            </Ltr>
          </span>
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
        actions={
          maySeeSpecialties ? (
            <Button
              variant="secondary"
              icon={<Icon name="stethoscope" />}
              data-testid="price-list-specialties"
              onClick={() => setManagingSpecialties(true)}
            >
              {t("specialties.manage")}
            </Button>
          ) : undefined
        }
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
        header={
          mayPick && rows.length > 0 ? (
            <div
              data-testid="price-list-selection"
              className="flex w-full flex-wrap items-center justify-between gap-3"
            >
              <Checkbox
                data-testid="price-list-pick-all"
                checked={allPicked}
                indeterminate={chosen.length > 0 && !allPicked}
                onCheckedChange={(on) => setPicked(new Set(on ? rows.map((item) => item.id) : []))}
                label={
                  chosen.length > 0
                    ? t("priceList.selected", { count: chosen.length })
                    : t("priceList.selectAll")
                }
              />
              {chosen.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {maySwitchMany && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        data-testid="price-list-enable-selected"
                        aria-disabled={busy || undefined}
                        onClick={() => void switchChosen(true)}
                      >
                        {t("priceList.enableSelected")}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        data-testid="price-list-disable-selected"
                        aria-disabled={busy || undefined}
                        onClick={() => void switchChosen(false)}
                      >
                        {t("priceList.disableSelected")}
                      </Button>
                    </>
                  )}
                  {mayRemoveMany && (
                    <Button
                      size="sm"
                      variant="danger"
                      icon={<Icon name="trash" />}
                      data-testid="price-list-delete-selected"
                      aria-disabled={busy || undefined}
                      onClick={destroyChosen}
                    >
                      {t("priceList.deleteSelected")}
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : undefined
        }
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

      <SpecialtiesModal open={managingSpecialties} onClose={() => setManagingSpecialties(false)} />

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
