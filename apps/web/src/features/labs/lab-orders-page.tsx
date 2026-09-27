import { LAB_ORDER_STAGES, type LabOrderStage } from "@clinic/shared";
import { useMemo, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  Button,
  Chip,
  EmptyState,
  Icon,
  PageHeader,
  SegmentedControl,
  Select,
  Table,
  TotalBadge,
  usePageParams,
} from "@clinic/ui";
import { useSession } from "@web/features/auth/session";
import {
  OrderDetails,
  LabFilter,
  OrderSearch,
  SortSelect,
  useListParams,
  useOrderColumns,
} from "@web/features/labs/lab-order-list";
import { OrderFormModal } from "@web/features/labs/order-form-modal";
import { canCreateLabOrder } from "@web/features/labs/permissions";
import { useLabOrders, useLabOrderStages } from "@web/features/labs/queries";
import { isRefetching } from "@clinic/ui/lib/use-delayed-loading";
import { useIsMobile } from "@clinic/ui/lib/use-media-query";

type StageFilter = LabOrderStage | "all";

export function LabOrdersPage(): JSX.Element {
  const { t } = useTranslation();
  const { can } = useSession();
  const isMobile = useIsMobile();
  const { page, perPage, setPage, setPerPage, resetPage } = usePageParams();
  const list = useListParams("open", resetPage);
  const [params] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  const rawStage = params.get("stage");
  const stage = LAB_ORDER_STAGES.find((value) => value === rawStage);
  const overdueOnly = params.get("overdue") === "1";

  const shared = useMemo(
    () => ({
      ...(list.debouncedSearch !== "" && { search: list.debouncedSearch }),
      ...(list.labId !== "" && { labId: list.labId }),
    }),
    [list.debouncedSearch, list.labId],
  );

  const orders = useLabOrders({
    ...shared,
    view: "open",
    page,
    limit: perPage,
    ...(stage && { stage }),
    ...(overdueOnly && { overdue: true }),
    ...(!list.isDefaultSort && { sort: list.sort.sort, dir: list.sort.dir }),
  });
  const counts = useLabOrderStages(shared);
  const columns = useOrderColumns("open");

  const rows = orders.data?.items ?? [];
  const openOrder = rows.find((row) => row.id === openOrderId);
  const stageCount = (value: LabOrderStage): number | undefined => counts.data?.stages[value];
  const allCount = counts.data
    ? LAB_ORDER_STAGES.reduce((sum, value) => sum + (counts.data?.stages[value] ?? 0), 0)
    : undefined;

  const empty = (
    <EmptyState
      icon="clipboard"
      data-testid="lab-orders-empty"
      title={
        stage || overdueOnly || shared.search || shared.labId
          ? "labs.orders.emptyFiltered"
          : "labs.orders.emptyOpen"
      }
      hint="labs.orders.emptyOpenHint"
    />
  );

  // A phone has no row wide enough for five chips; the same choice becomes one field.
  const stageOptions = [
    { value: "all" as StageFilter, label: t("labs.orders.stages.all"), count: allCount },
    ...LAB_ORDER_STAGES.map((value) => ({
      value: value as StageFilter,
      label: t(`labs.orders.stages.${value}`),
      count: stageCount(value),
    })),
  ];

  const setStage = (value: StageFilter): void =>
    list.write((next) => {
      if (value === "all") {
        next.delete("stage");
      } else {
        next.set("stage", value);
      }
    });

  return (
    <div data-testid="lab-orders-page" className="flex flex-col gap-5">
      <PageHeader
        data-testid="lab-orders-header"
        title="labs.orders.title"
        subtitle="labs.orders.subtitle"
        primaryAction={
          canCreateLabOrder(can) ? (
            <Button
              icon={<Icon name="plus" />}
              data-testid="lab-orders-add"
              onClick={() => setCreating(true)}
            >
              {t("labs.orders.add")}
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {isMobile ? (
          <Select
            data-testid="lab-orders-stage-select"
            className="min-w-0 flex-1"
            aria-label={t("labs.orders.stages.label")}
            value={stage ?? "all"}
            onChange={(event) => setStage(event.target.value as StageFilter)}
            options={stageOptions.map((option) => ({
              value: option.value,
              label:
                option.count === undefined
                  ? option.label
                  : t("labs.orders.stages.option", { stage: option.label, count: option.count }),
            }))}
          />
        ) : (
          <SegmentedControl<StageFilter>
            data-testid="lab-orders-stages"
            label={t("labs.orders.stages.label")}
            value={stage ?? "all"}
            onChange={setStage}
            options={stageOptions}
          />
        )}

        <Chip
          selected={overdueOnly}
          data-testid="lab-orders-filter-overdue"
          onClick={() =>
            list.write((next) => {
              if (overdueOnly) {
                next.delete("overdue");
              } else {
                next.set("overdue", "1");
              }
            })
          }
        >
          <Icon name="clock" className="size-3.5 shrink-0" />
          {t("labs.orders.overdueFilter", { count: counts.data?.overdue ?? 0 })}
        </Chip>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <OrderSearch list={list} />
        <div className="grid w-full gap-3 xs:grid-cols-2 sm:contents">
          <LabFilter list={list} className="min-w-0 sm:w-48" />
          <SortSelect view="open" list={list} className="min-w-0 sm:w-60" />
        </div>
        {orders.data !== undefined && (
          <TotalBadge
            data-testid="lab-orders-count"
            className="ms-auto"
            total={orders.data.total}
          />
        )}
      </div>

      <Table
        data-testid="lab-orders-table"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        isLoading={orders.isPending}
        isRefreshing={isRefetching(orders)}
        onRowClick={(row) => setOpenOrderId(row.id)}
        rowLabel={(row) => `${row.workTypeName ?? t("labs.orders.custom")} — ${row.patientName}`}
        empty={empty}
        pagination={{
          page,
          totalPages: orders.data?.totalPages ?? 0,
          onPageChange: setPage,
          perPage,
          onPerPageChange: setPerPage,
        }}
      />

      <OrderDetails order={openOrder} onClose={() => setOpenOrderId(null)} />

      <OrderFormModal
        data-testid="lab-order-create-modal"
        open={creating}
        onOpenChange={setCreating}
      />
    </div>
  );
}
