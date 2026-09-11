import { LAB_ORDER_STATUSES, type LabOrderRow, type LabOrderStatus } from '@clinic/shared';
import { useMemo, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Badge,
  Button,
  EmptyState,
  Icon,
  Ltr,
  PageHeader,
  SearchField,
  Select,
  useToast,
} from '@web/components/ui';
import { RefreshBar, SkeletonCard, SkeletonStatus } from '@web/components/ui/skeleton';
import { useSession } from '@web/features/auth/session';
import { Money } from '@web/features/billing/money';
import { useClinic } from '@web/features/clinic/queries';
import { LabOrdersTable } from '@web/features/labs/lab-orders-table';
import { OrderDrawer } from '@web/features/labs/order-drawer';
import { OrderFormModal } from '@web/features/labs/order-form-modal';
import { canCreateLabOrder } from '@web/features/labs/permissions';
import { useLabOrders, useLabOrderStep, useLabs } from '@web/features/labs/queries';
import { availableSteps, BOARD_COLUMNS, LAB_ORDER_STATUS_STYLES } from '@web/features/labs/status';
import { errorMessageKey } from '@web/lib/api-error';
import { cn } from '@web/lib/cn';
import { formatDate } from '@web/lib/format';
import { useDebounced } from '@web/lib/use-debounced';
import { useQueryLoading } from '@web/lib/use-delayed-loading';
import { useIsMobile } from '@web/lib/use-media-query';

// A board on a wide screen answers "what is at the lab right now" in one look; below `md` it is the
// shared `Table`, already a stack of cards there.
export function LabOrdersPage(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();
  const isMobile = useIsMobile();

  const [search, setSearch] = useState('');
  const [labId, setLabId] = useState('');
  const [status, setStatus] = useState<LabOrderStatus | ''>('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<LabOrderRow | undefined>();
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  const debounced = useDebounced(search);
  const labs = useLabs({ limit: 100 });

  const query = useMemo(
    () => ({
      limit: 100,
      ...(debounced.trim() !== '' && { search: debounced.trim() }),
      ...(labId !== '' && { labId }),
      ...(status !== '' && { status }),
      ...(overdueOnly && { overdue: true }),
    }),
    [debounced, labId, status, overdueOnly],
  );

  const orders = useLabOrders(query);
  const { showSkeleton, isRefreshing } = useQueryLoading(orders);
  const rows = orders.data?.items ?? [];

  // The drawer follows the list rather than holding its own copy, so a
  // transition made inside it redraws the drawer as well as the board.
  const openOrder = rows.find((row) => row.id === openOrderId);
  const overdueCount = rows.filter((row) => row.isOverdue).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="labs.orders.title"
        subtitle="labs.orders.subtitle"
        actions={
          canCreateLabOrder(user?.role) ? (
            <Button icon={<Icon name="plus" />} onClick={() => setCreating(true)}>
              {t('labs.orders.add')}
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <SearchField
          className="w-full min-w-0 sm:max-w-xs"
          label={t('labs.orders.search')}
          shortcut="/"
          placeholder={t('labs.orders.searchPlaceholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="min-w-44">
          <label htmlFor="lab-orders-lab" className="mb-1 block text-label text-ink-muted">
            {t('labs.orders.filterLab')}
          </label>
          <Select
            id="lab-orders-lab"
            value={labId}
            placeholder={t('common.all')}
            onChange={(event) => setLabId(event.target.value)}
            options={(labs.data?.items ?? []).map((lab) => ({ value: lab.id, label: lab.name }))}
          />
        </div>

        {/* On a phone the board is a table, so the status filter is the only
            way to narrow it — on a wide screen it is a shortcut, not the path. */}
        <div className="min-w-44">
          <label htmlFor="lab-orders-status" className="mb-1 block text-label text-ink-muted">
            {t('labs.orders.filterStatus')}
          </label>
          <Select
            id="lab-orders-status"
            value={status}
            placeholder={t('common.all')}
            onChange={(event) => setStatus(event.target.value as LabOrderStatus | '')}
            options={LAB_ORDER_STATUSES.map((value) => ({
              value,
              label: t(LAB_ORDER_STATUS_STYLES[value].label),
            }))}
          />
        </div>

        <Button
          variant={overdueOnly ? 'danger' : 'secondary'}
          icon={<Icon name="clock" />}
          onClick={() => setOverdueOnly((previous) => !previous)}
        >
          {t('labs.orders.overdueFilter', { count: overdueCount })}
        </Button>
      </div>

      {isMobile || status !== '' || overdueOnly ? (
        <LabOrdersTable
          orders={rows}
          isLoading={showSkeleton}
          isRefreshing={isRefreshing}
          onOpen={(row) => setOpenOrderId(row.id)}
        />
      ) : (
        <Board
          rows={rows}
          isLoading={showSkeleton}
          isRefreshing={isRefreshing}
          onOpen={setOpenOrderId}
        />
      )}

      <OrderDrawer
        order={openOrder}
        onClose={() => setOpenOrderId(null)}
        onEdit={(row) => {
          setOpenOrderId(null);
          setEditing(row);
        }}
      />

      <OrderFormModal open={creating} onOpenChange={setCreating} />

      <OrderFormModal
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
}: {
  readonly rows: readonly LabOrderRow[];
  readonly isLoading: boolean;
  readonly isRefreshing: boolean;
  readonly onOpen: (id: string) => void;
}): JSX.Element {
  const { t } = useTranslation();

  if (!isLoading && rows.length === 0) {
    return <EmptyState icon="clipboard" title="labs.orders.empty" hint="labs.orders.emptyHint" />;
  }

  return (
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
      <RefreshBar active={isRefreshing} />
      {isLoading && <SkeletonStatus />}

      {BOARD_COLUMNS.map((status) => {
        const column = rows.filter((row) => row.status === status);
        const style = LAB_ORDER_STATUS_STYLES[status];

        return (
          <section key={status} className="flex min-w-0 flex-col gap-2">
            <header
              className={cn(
                'flex items-center justify-between gap-2 rounded-panel border px-3 py-2',
                style.column,
              )}
            >
              <h2 className="truncate text-label font-medium">{t(style.label)}</h2>
              <Ltr className="text-label tabular-nums">{column.length}</Ltr>
            </header>

            {isLoading && <SkeletonCard count={2} />}

            {!isLoading && column.length === 0 && (
              <p className="rounded-panel border border-dashed border-line px-3 py-4 text-center text-label text-ink-subtle">
                {t('labs.orders.columnEmpty')}
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

// The buttons along the foot are the moves this person may make, so working through "what came back
// today" never opens anything.
function OrderCard({
  order,
  onOpen,
}: {
  readonly order: LabOrderRow;
  readonly onOpen: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();
  const toast = useToast();
  const clinic = useClinic();
  const step = useLabOrderStep();

  const steps = availableSteps(order.status, user?.role);

  const move = async (next: (typeof steps)[number]): Promise<void> => {
    try {
      await step.mutateAsync({ id: order.id, step: next.step });
      toast.success('labs.order.moved');
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <div
      className={cn(
        'border border-line rounded-card bg-surface p-3 shadow-card transition-shadow duration-150 hover:shadow-float',
        order.isOverdue && 'border border-danger-200',
      )}
    >
      {/* The card body is the button — the actions below it are their own
          buttons, and a button inside a button is not valid HTML. */}
      <button
        type="button"
        onClick={onOpen}
        data-lab-order={order.id}
        className="w-full cursor-pointer text-start"
      >
        <p className="truncate text-value font-medium text-ink">
          {order.workTypeName ?? t('labs.orders.custom')}
        </p>
        <p className="truncate text-label text-ink-muted">{order.patientName}</p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-label text-ink-muted">
          {order.teeth.length > 0 && <Ltr className="tabular-nums">{order.teeth.join(' · ')}</Ltr>}
          <Money
            amount={order.price}
            currency={clinic.data?.currency}
            className="ms-auto text-ink"
          />
        </div>

        {order.expectedAt && (
          <Ltr
            as="p"
            className={cn(
              'mt-1 text-label tabular-nums',
              order.isOverdue ? 'text-danger-600' : 'text-ink-subtle',
            )}
          >
            {formatDate(order.expectedAt)}
          </Ltr>
        )}

        {order.isOverdue && (
          <Badge tone="danger" className="mt-2">
            {t('labs.orders.overdue')}
          </Badge>
        )}
      </button>

      {steps.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line pt-2">
          {steps
            .filter((next) => next.step !== 'cancel')
            .map((next) => (
              <Button
                key={next.step}
                size="sm"
                variant="secondary"
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
