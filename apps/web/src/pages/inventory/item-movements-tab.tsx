import { MOVEMENT_TYPES, type StockMovementRow } from "@clinic/shared";
import { useMemo, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { DateRangePicker, EmptyState, Select, Table, TotalBadge, usePageParams } from "@clinic/ui";
import { isRefetching } from "@clinic/ui/lib/use-delayed-loading";
import { ReverseMovementModal } from "@web/components/inventory/reverse-movement-modal";
import { useMovementColumns } from "@web/hooks/inventory/use-movement-columns";
import { useMovementFilters } from "@web/hooks/inventory/use-movement-filters";
import { endOfNextDayIso, startOfDayIso } from "@web/lib/format";
import { movementLabel } from "@web/lib/inventory/display";
import { useItemMovements } from "@web/queries/inventory";

export function ItemMovementsTab({ itemId }: { readonly itemId: string }): JSX.Element {
  const { t } = useTranslation();
  const { page, perPage, setPage, setPerPage } = usePageParams();
  const { type, from, to, isNarrowed, setType, setRange } = useMovementFilters();
  const [reversing, setReversing] = useState<StockMovementRow | null>(null);
  const columns = useMovementColumns(setReversing);

  const query = useMemo(
    () => ({
      page,
      limit: perPage,
      ...(type && { type }),
      ...(startOfDayIso(from) && { from: startOfDayIso(from) as string }),
      ...(endOfNextDayIso(to) && { to: endOfNextDayIso(to) as string }),
    }),
    [page, perPage, type, from, to],
  );

  const movements = useItemMovements(itemId, query);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-48">
          <label htmlFor="item-movement-type" className="mb-1 block text-label text-ink-muted">
            {t("inventory.history.filterType")}
          </label>
          <Select
            id="item-movement-type"
            data-testid="item-movements-type"
            value={type ?? ""}
            placeholder={t("common.all")}
            onChange={(event) => setType(event.target.value)}
            options={MOVEMENT_TYPES.map((value) => ({
              value,
              label: t(movementLabel(value)),
            }))}
          />
        </div>

        <div className="w-full sm:w-72">
          <label htmlFor="item-movements-range" className="mb-1 block text-label text-ink-muted">
            {t("inventory.history.range")}
          </label>
          <DateRangePicker
            id="item-movements-range"
            data-testid="item-movements-range"
            className="w-full"
            label={t("inventory.history.range")}
            value={{ from, to }}
            onChange={(range) => setRange(range.from, range.to)}
          />
        </div>

        {movements.data !== undefined && (
          <span className="ms-auto flex h-(--control-h) items-center">
            <TotalBadge data-testid="item-movements-count" total={movements.data.total} />
          </span>
        )}
      </div>

      <Table
        data-testid="item-movements"
        columns={columns}
        rows={movements.data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={movements.isPending}
        isRefreshing={isRefetching(movements)}
        empty={
          <EmptyState
            icon="clipboard"
            data-testid="item-movements-empty"
            title={isNarrowed ? "inventory.history.emptyRange" : "inventory.history.empty"}
          />
        }
        pagination={{
          page,
          totalPages: movements.data?.totalPages ?? 0,
          onPageChange: setPage,
          perPage,
          onPerPageChange: setPerPage,
        }}
      />

      <ReverseMovementModal movement={reversing} onClose={() => setReversing(null)} />
    </div>
  );
}
