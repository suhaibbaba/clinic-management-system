import { subMonths } from "date-fns";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  DateRangePicker,
  EmptyState,
  PageHeader,
  Table,
  TotalBadge,
  usePageParams,
} from "@clinic/ui";
import { toIsoDate } from "@web/features/appointments/calendar-time";
import {
  OrderDetails,
  LabFilter,
  OrderSearch,
  SortSelect,
  useListParams,
  useOrderColumns,
} from "@web/features/labs/lab-order-list";
import { useLabOrders } from "@web/features/labs/queries";
import { endOfNextDayIso, startOfDayIso } from "@web/lib/format";
import { isRefetching } from "@clinic/ui/lib/use-delayed-loading";

const DEFAULT_MONTHS = 3;

// An absent `from` is the default window; a present but empty one is the reader asking for all of it.
export function LabOrdersDone(): JSX.Element {
  const { t } = useTranslation();
  const { page, perPage, setPage, setPerPage, resetPage } = usePageParams();
  const list = useListParams("done", resetPage);
  const [params] = useSearchParams();
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  const from = params.get("from") ?? toIsoDate(subMonths(new Date(), DEFAULT_MONTHS));
  const to = params.get("to") ?? "";

  const orders = useLabOrders({
    view: "done",
    page,
    limit: perPage,
    ...(list.debouncedSearch !== "" && { search: list.debouncedSearch }),
    ...(list.labId !== "" && { labId: list.labId }),
    ...(!list.isDefaultSort && { sort: list.sort.sort, dir: list.sort.dir }),
    ...(startOfDayIso(from) && { finishedFrom: startOfDayIso(from) as string }),
    ...(endOfNextDayIso(to) && { finishedTo: endOfNextDayIso(to) as string }),
  });
  const columns = useOrderColumns("done");
  const rows = orders.data?.items ?? [];

  return (
    <div data-testid="lab-orders-done" className="flex flex-col gap-5">
      <PageHeader
        data-testid="lab-orders-done-header"
        title="labs.orders.doneTitle"
        subtitle="labs.orders.doneSubtitle"
      />

      <div className="flex flex-wrap items-center gap-3">
        <OrderSearch list={list} />
        <div className="grid w-full gap-3 xs:grid-cols-2 sm:contents">
          <LabFilter list={list} className="min-w-0 sm:w-48" />
          <SortSelect view="done" list={list} className="min-w-0 sm:order-1 sm:w-60" />
        </div>
        <DateRangePicker
          id="lab-orders-period"
          data-testid="lab-orders-period"
          className="w-full sm:w-64"
          label={t("labs.orders.period")}
          value={{ from, to }}
          onChange={(range) =>
            list.write((next) => {
              next.set("from", range.from);
              next.set("to", range.to);
            })
          }
        />
        {orders.data !== undefined && (
          <TotalBadge
            data-testid="lab-orders-done-count"
            className="ms-auto sm:order-2"
            total={orders.data.total}
          />
        )}
      </div>

      <Table
        data-testid="lab-orders-done-table"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        isLoading={orders.isPending}
        isRefreshing={isRefetching(orders)}
        onRowClick={(row) => setOpenOrderId(row.id)}
        rowLabel={(row) => `${row.workTypeName ?? t("labs.orders.custom")} — ${row.patientName}`}
        empty={
          <EmptyState
            icon="clipboard"
            data-testid="lab-orders-done-empty"
            title="labs.orders.emptyDone"
          />
        }
        pagination={{
          page,
          totalPages: orders.data?.totalPages ?? 0,
          onPageChange: setPage,
          perPage,
          onPerPageChange: setPerPage,
        }}
      />

      <OrderDetails
        order={rows.find((row) => row.id === openOrderId)}
        onClose={() => setOpenOrderId(null)}
      />
    </div>
  );
}
