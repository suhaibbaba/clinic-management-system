import { useDateRangeParam } from "@web/shared/hooks/use-date-range-param";
import { LAB_ORDER_DONE_STATUSES } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  DateRangePicker,
  EmptyState,
  PageHeader,
  Table,
  TotalBadge,
  usePageParams,
} from "@clinic/ui";
import { OrderDetails } from "@web/modules/labs/components/order-details";
import {
  DoneStatusFilter,
  LabFilter,
  OrderSearch,
  SortSelect,
} from "@web/modules/labs/components/order-filters";
import { useListParams } from "@web/modules/labs/hooks/use-list-params";
import { useOpenOrder } from "@web/modules/labs/hooks/use-open-order";
import { useOrderColumns } from "@web/modules/labs/hooks/use-order-columns";
import { useLabOrders } from "@web/modules/labs/queries";
import { endOfNextDayIso, startOfDayIso } from "@web/shared/lib/format";
import { isRefetching } from "@clinic/ui/lib/use-delayed-loading";

export function LabOrdersDone(): JSX.Element {
  const { t } = useTranslation();
  const { page, perPage, setPage, setPerPage, resetPage } = usePageParams();
  const list = useListParams("done", resetPage);
  const openOrder = useOpenOrder();

  const { from, to, setRange } = useDateRangeParam();
  const status = LAB_ORDER_DONE_STATUSES.find((value) => value === list.status);

  const orders = useLabOrders({
    view: "done",
    page,
    limit: perPage,
    ...(list.debouncedSearch !== "" && { search: list.debouncedSearch }),
    ...(list.labId !== "" && { labId: list.labId }),
    ...(status && { status }),
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
          <DoneStatusFilter list={list} className="min-w-0 sm:w-40" />
          <SortSelect view="done" list={list} className="min-w-0 sm:order-1 sm:w-60" />
        </div>
        <DateRangePicker
          id="lab-orders-period"
          data-testid="lab-orders-period"
          className="w-full sm:w-64"
          label={t("labs.orders.period")}
          value={{ from, to }}
          onChange={(range) => setRange(range.from, range.to)}
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
        onRowClick={(row) => openOrder(row.id)}
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

      <OrderDetails rows={rows} />
    </div>
  );
}
