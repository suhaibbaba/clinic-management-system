import { LAB_ORDER_STATUSES, type LabOrderRow, type LabOrderStatus } from "@clinic/shared";
import { useMemo, useState, type JSX, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Badge,
  Button,
  Chip,
  EmptyState,
  Icon,
  type IconName,
  Ltr,
  PageHeader,
  SearchField,
  Select,
  useToast,
} from "@clinic/ui";
import { RefreshBar, SkeletonCard, SkeletonStatus } from "@clinic/ui/components/skeleton";
import { useSession } from "@web/features/auth/session";
import { Money } from "@web/features/billing/money";
import { useClinic } from "@web/features/clinic/queries";
import { LAB_ORDER_FIELDS } from "@web/features/labs/fields";
import { LabOrdersTable } from "@web/features/labs/lab-orders-table";
import { OrderDrawer } from "@web/features/labs/order-drawer";
import { OrderFormModal } from "@web/features/labs/order-form-modal";
import { canCreateLabOrder } from "@web/features/labs/permissions";
import { useLabOrders, useLabOrderStep, useLabs } from "@web/features/labs/queries";
import { availableSteps, BOARD_COLUMNS, LAB_ORDER_STATUS_STYLES } from "@web/features/labs/status";
import { errorMessageKey } from "@web/lib/api-error";
import { cn } from "@clinic/ui/lib/cn";
import { formatDate } from "@web/lib/format";
import { useDebounced } from "@web/lib/use-debounced";
import { useQueryLoading } from "@clinic/ui/lib/use-delayed-loading";
import { useIsMobile } from "@clinic/ui/lib/use-media-query";

export function LabOrdersPage(): JSX.Element {
  const { t } = useTranslation();
  const { can } = useSession();
  const isMobile = useIsMobile();

  const [search, setSearch] = useState("");
  const [labId, setLabId] = useState("");
  const [status, setStatus] = useState<LabOrderStatus | "">("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<LabOrderRow | undefined>();
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  const debounced = useDebounced(search);
  const labs = useLabs({ limit: 100 });

  const query = useMemo(
    () => ({
      limit: 100,
      ...(debounced.trim() !== "" && { search: debounced.trim() }),
      ...(labId !== "" && { labId }),
      ...(status !== "" && { status }),
      ...(overdueOnly && { overdue: true }),
    }),
    [debounced, labId, status, overdueOnly],
  );

  const orders = useLabOrders(query);
  const { showSkeleton, isRefreshing } = useQueryLoading(orders);
  const rows = orders.data?.items ?? [];

  const openOrder = rows.find((row) => row.id === openOrderId);
  const overdueCount = rows.filter((row) => row.isOverdue).length;

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

      <div className="grid items-end gap-3 md:grid-cols-3 xl:grid-cols-5">
        <SearchField
          data-testid="lab-orders-search"
          className="w-full min-w-0 md:col-span-2"
          label={t("labs.orders.search")}
          shortcut="/"
          placeholder={t("labs.orders.searchPlaceholder")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          clearLabel={t("common.clear")}
          onClear={() => setSearch("")}
        />

        <div className="min-w-0">
          <label htmlFor="lab-orders-lab" className="mb-1 block text-label text-ink-muted">
            {t("labs.orders.filterLab")}
          </label>
          <Select
            id="lab-orders-lab"
            data-testid="lab-orders-filter-lab"
            value={labId}
            placeholder={t("common.all")}
            onChange={(event) => setLabId(event.target.value)}
            options={(labs.data?.items ?? []).map((lab) => ({ value: lab.id, label: lab.name }))}
          />
        </div>

        <div className="min-w-0">
          <label htmlFor="lab-orders-status" className="mb-1 block text-label text-ink-muted">
            {t("labs.orders.filterStatus")}
          </label>
          <Select
            id="lab-orders-status"
            data-testid="lab-orders-filter-status"
            value={status}
            placeholder={t("common.all")}
            onChange={(event) => setStatus(event.target.value as LabOrderStatus | "")}
            options={LAB_ORDER_STATUSES.map((value) => ({
              value,
              label: t(LAB_ORDER_STATUS_STYLES[value].label),
            }))}
          />
        </div>
        <div className="flex min-w-0 items-end">
          <Chip
            selected={overdueOnly}
            data-testid="lab-orders-filter-overdue"
            onClick={() => setOverdueOnly((previous) => !previous)}
          >
            <Icon name="clock" className="size-3.5 shrink-0" />
            {t("labs.orders.overdueFilter", { count: overdueCount })}
          </Chip>
        </div>
      </div>
      {isMobile || status !== "" || overdueOnly ? (
        <LabOrdersTable
          data-testid="lab-orders-table"
          orders={rows}
          isLoading={showSkeleton}
          isRefreshing={isRefreshing}
          onOpen={(row) => setOpenOrderId(row.id)}
        />
      ) : (
        <Board
          data-testid="lab-orders-board"
          rows={rows}
          isLoading={showSkeleton}
          isRefreshing={isRefreshing}
          onOpen={setOpenOrderId}
        />
      )}
      <OrderDrawer
        data-testid="lab-order-drawer"
        order={openOrder}
        onClose={() => setOpenOrderId(null)}
        onEdit={(row) => {
          setOpenOrderId(null);
          setEditing(row);
        }}
      />
      <OrderFormModal
        data-testid="lab-order-create-modal"
        open={creating}
        onOpenChange={setCreating}
      />
      <OrderFormModal
        data-testid="lab-order-edit-modal"
        open={editing !== undefined}
        onOpenChange={(open) => !open && setEditing(undefined)}
        order={editing}
      />
    </div>
  );
}

function Board({
  rows,
  isLoading,
  isRefreshing,
  onOpen,
  "data-testid": testId = "lab-orders-board",
}: {
  readonly rows: readonly LabOrderRow[];
  readonly isLoading: boolean;
  readonly isRefreshing: boolean;
  readonly onOpen: (id: string) => void;
  readonly "data-testid"?: string | undefined;
}): JSX.Element {
  const { t } = useTranslation();

  if (!isLoading && rows.length === 0) {
    return (
      <EmptyState
        icon="clipboard"
        data-testid={`${testId}-empty`}
        title="labs.orders.empty"
        hint="labs.orders.emptyHint"
      />
    );
  }

  return (
    <div data-testid={testId} className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
      <RefreshBar active={isRefreshing} />
      {isLoading && <SkeletonStatus />}

      {BOARD_COLUMNS.map((status) => {
        const column = rows.filter((row) => row.status === status);
        const style = LAB_ORDER_STATUS_STYLES[status];

        return (
          <section
            key={status}
            data-testid={`${testId}-column-${status}`}
            className="flex min-w-0 flex-col gap-2"
          >
            <header
              className={cn(
                "flex items-center justify-between gap-2 rounded-panel border px-3 py-2",
                style.column,
              )}
            >
              <h2 className="truncate text-label font-medium">{t(style.label)}</h2>
              <Ltr className="text-label tabular-nums">{column.length}</Ltr>
            </header>

            {isLoading && <SkeletonCard count={2} />}

            {!isLoading && column.length === 0 && (
              <p
                data-testid={`${testId}-column-${status}-empty`}
                className="rounded-panel border border-dashed border-line px-3 py-4 text-center text-label text-ink-muted"
              >
                {t("labs.orders.columnEmpty")}
              </p>
            )}

            {!isLoading && column.length > 0 && (
              <ul className="flex flex-col gap-2">
                {column.map((row) => (
                  <li key={row.id}>
                    <OrderCard order={row} onOpen={() => onOpen(row.id)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function CardMeta({
  icon,
  label,
  children,
  "data-testid": testId,
}: {
  readonly icon: IconName;
  readonly label: string;
  readonly children: ReactNode;
  readonly "data-testid"?: string | undefined;
}): JSX.Element {
  return (
    <span data-testid={testId} className="flex items-center gap-2">
      <span className="flex shrink-0 items-center gap-1.5 text-ink-subtle">
        <Icon name={icon} className="size-4 shrink-0" />
        {label}
      </span>
      <span className="ms-auto flex min-w-0 items-center justify-end gap-1.5 font-medium text-ink">
        {children}
      </span>
    </span>
  );
}

function OrderCard({
  order,
  onOpen,
}: {
  readonly order: LabOrderRow;
  readonly onOpen: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const { can } = useSession();
  const toast = useToast();
  const clinic = useClinic();
  const step = useLabOrderStep();

  const steps = availableSteps(order.status, can);

  const move = async (next: (typeof steps)[number]): Promise<void> => {
    try {
      await step.mutateAsync({ id: order.id, step: next.step });
      toast.success("labs.order.moved");
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <div
      data-testid={`lab-order-card-${order.id}`}
      className={cn(
        "border border-line rounded-card bg-surface p-3 shadow-card transition-shadow duration-150 hover:shadow-float",
        order.isOverdue && "border border-danger-200",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        data-lab-order={order.id}
        data-testid={`lab-order-open-${order.id}`}
        className="w-full cursor-pointer text-start"
      >
        <p className="truncate text-value font-medium text-ink">
          {order.workTypeName ?? t("labs.orders.custom")}
        </p>
        <div className="mt-2 flex flex-col gap-1 text-label">
          <CardMeta
            icon={LAB_ORDER_FIELDS.patient.icon}
            label={t(LAB_ORDER_FIELDS.patient.label)}
            data-testid={`lab-order-patient-${order.id}`}
          >
            <span className="truncate">{order.patientName}</span>
          </CardMeta>
          {order.teeth.length > 0 && (
            <CardMeta
              icon={LAB_ORDER_FIELDS.teeth.icon}
              label={t(LAB_ORDER_FIELDS.teeth.label)}
              data-testid={`lab-order-teeth-${order.id}`}
            >
              <Ltr className="truncate tabular-nums">{order.teeth.join(" · ")}</Ltr>
            </CardMeta>
          )}
          <CardMeta
            icon={LAB_ORDER_FIELDS.price.icon}
            label={t(LAB_ORDER_FIELDS.price.label)}
            data-testid={`lab-order-price-${order.id}`}
          >
            <Money amount={order.price} currency={clinic.data?.currency} />
          </CardMeta>
          {order.expectedAt && (
            <CardMeta
              icon={LAB_ORDER_FIELDS.expected.icon}
              label={t(LAB_ORDER_FIELDS.expected.label)}
              data-testid={`lab-order-expected-${order.id}`}
            >
              <Ltr className={cn("tabular-nums", order.isOverdue && "text-danger-600")}>
                {formatDate(order.expectedAt)}
              </Ltr>
            </CardMeta>
          )}
          {order.isOverdue && (
            <span className="mt-0.5 flex">
              <Badge tone="danger" data-testid="lab-order-overdue">
                {t("labs.orders.overdue")}
              </Badge>
            </span>
          )}
        </div>
      </button>
      {steps.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line pt-2">
          {steps
            .filter((next) => next.step !== "cancel")
            .map((next) => (
              <Button
                key={next.step}
                size="sm"
                variant="secondary"
                data-testid={`lab-order-step-${next.step}`}
                isLoading={step.isPending}
                onClick={() => void move(next)}
              >
                {t(next.label)}
              </Button>
            ))}
        </div>
      )}
    </div>
  );
}
