import {
  LOOKUP_LIST,
  type SupplierStatement,
  type SupplierStatementLine,
  type SupplierSummary,
} from '@clinic/shared';
import { useMemo, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Badge,
  Button,
  Card,
  type Column,
  DateRangePicker,
  EmptyState,
  Icon,
  Ltr,
  PageHeader,
  PhoneLink,
  SearchField,
  Table,
} from '@web/components/ui';
import { useSession } from '@web/features/auth/session';
import { useLookupLabels } from '@web/features/lookups/queries';
import { Money } from '@web/features/billing/money';
import { useClinic } from '@web/features/clinic/queries';
import { canManageInventory } from '@web/features/inventory/permissions';
import { useSuppliers, useSupplierStatement } from '@web/features/inventory/queries';
import { SupplierFormModal } from '@web/features/inventory/supplier-form-modal';
import { endOfNextDayIso, formatDate, startOfDayIso } from '@web/lib/format';
import { useDebounced } from '@web/lib/use-debounced';
import { isRefetching } from '@web/lib/use-delayed-loading';

export function SuppliersPage(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();
  const clinic = useClinic();

  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SupplierSummary | undefined>();
  const [selected, setSelected] = useState<SupplierSummary | null>(null);

  const debounced = useDebounced(search);
  const suppliers = useSuppliers({
    limit: 50,
    includeInactive: true,
    ...(debounced.trim() !== '' && { search: debounced.trim() }),
  });

  const mayManage = canManageInventory(user?.role);

  const columns: readonly Column<SupplierSummary>[] = [
    {
      key: 'name',
      header: 'inventory.suppliers.name',
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
      key: 'phone',
      header: 'inventory.suppliers.phone',
      hideOnMobile: true,
      render: (row) => <PhoneLink value={row.phone} />,
    },
    {
      key: 'items',
      header: 'inventory.suppliers.items',
      align: 'numeric',
      render: (row) => row.itemCount,
    },
    {
      key: 'purchased',
      header: 'inventory.suppliers.purchased',
      align: 'numeric',
      render: (row) => <Money amount={row.purchased} currency={clinic.data?.currency} />,
    },
    {
      key: 'state',
      header: 'inventory.suppliers.state',
      render: (row) =>
        row.isActive ? null : <Badge tone="neutral">{t('inventory.suppliers.inactive')}</Badge>,
    },
    ...(mayManage
      ? [
          {
            key: 'actions',
            header: 'inventory.suppliers.actions',
            actions: true,
            render: (row: SupplierSummary) => (
              <Button
                size="sm"
                variant="ghost"
                onClick={(event) => {
                  event.stopPropagation();
                  setEditing(row);
                }}
              >
                {t('common.edit')}
              </Button>
            ),
          } satisfies Column<SupplierSummary>,
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="inventory.suppliers.title"
        subtitle="inventory.suppliers.subtitle"
        actions={
          mayManage ? (
            <Button icon={<Icon name="plus" />} onClick={() => setCreating(true)}>
              {t('inventory.suppliers.add')}
            </Button>
          ) : undefined
        }
      />

      <SearchField
        className="w-full min-w-0 sm:max-w-md"
        label={t('inventory.suppliers.search')}
        shortcut="/"
        placeholder={t('inventory.suppliers.searchPlaceholder')}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <Table
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
            title="inventory.suppliers.empty"
            hint="inventory.suppliers.emptyHint"
          />
        }
      />

      {selected && <Statement supplier={selected} onClose={() => setSelected(null)} />}

      <SupplierFormModal open={creating} onOpenChange={setCreating} />

      <SupplierFormModal
        open={editing !== undefined}
        onOpenChange={(open) => !open && setEditing(undefined)}
        supplier={editing}
      />
    </div>
  );
}

function Statement({
  supplier,
  onClose,
}: {
  readonly supplier: SupplierSummary;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);
  const clinic = useClinic();

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const query = useMemo(
    () => ({
      ...(startOfDayIso(from) && { from: startOfDayIso(from) as string }),
      ...(endOfNextDayIso(to) && { to: endOfNextDayIso(to) as string }),
    }),
    [from, to],
  );

  const statement = useSupplierStatement(supplier.id, query);

  const columns: readonly Column<SupplierStatementLine>[] = [
    {
      key: 'date',
      header: 'inventory.suppliers.statement.date',
      render: (row) => <Ltr>{formatDate(row.occurredAt)}</Ltr>,
    },
    {
      key: 'item',
      header: 'inventory.suppliers.statement.item',
      primary: true,
      render: (row) => (
        <span className="flex flex-wrap items-center gap-2">
          <span>{row.itemName}</span>
          {row.batchNo && <Ltr className="text-label text-ink-muted">{row.batchNo}</Ltr>}
          {row.isReversal && <Badge tone="neutral">{t('inventory.history.reversal')}</Badge>}
        </span>
      ),
    },
    {
      key: 'quantity',
      header: 'inventory.suppliers.statement.quantity',
      align: 'numeric',
      render: (row) => (
        <span className="flex items-baseline justify-end gap-1.5">
          <Ltr>{row.quantity}</Ltr>
          <span className="text-label text-ink-muted">{unitLabel(row.unit)}</span>
        </span>
      ),
    },
    {
      key: 'unitPrice',
      header: 'inventory.suppliers.statement.unitPrice',
      align: 'numeric',
      render: (row) =>
        row.unitPrice ? <Money amount={row.unitPrice} currency={clinic.data?.currency} /> : '—',
    },
    {
      key: 'total',
      header: 'inventory.suppliers.statement.total',
      align: 'numeric',
      render: (row) =>
        row.total ? (
          <Money amount={row.total} currency={clinic.data?.currency} className="font-medium" />
        ) : (
          '—'
        ),
    },
  ];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-value font-medium text-ink">
          {t('inventory.suppliers.statement.title', { supplier: supplier.name })}
        </h2>

        <Button variant="ghost" size="sm" icon={<Icon name="x" />} onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>

      <DateRangePicker
        id="supplier-statement-range"
        className="w-full sm:w-72"
        label={t('inventory.suppliers.statement.range')}
        value={{ from, to }}
        onChange={(range) => {
          setFrom(range.from);
          setTo(range.to);
        }}
      />

      <Table
        columns={columns}
        rows={statement.data?.lines ?? []}
        rowKey={(row) => row.movementId}
        isLoading={statement.isPending}
        isRefreshing={isRefetching(statement)}
        empty={
          <EmptyState
            icon="clipboard"
            title="inventory.suppliers.statement.empty"
            hint="inventory.suppliers.statement.emptyHint"
          />
        }
      />

      <Card>
        <div className="flex items-baseline justify-between">
          <span className="text-value font-medium text-ink">
            {t('inventory.suppliers.statement.periodTotal')}
          </span>
          <Money
            amount={(statement.data as SupplierStatement | undefined)?.total ?? '0.00'}
            currency={clinic.data?.currency}
            className="text-value font-medium"
          />
        </div>
      </Card>
    </section>
  );
}
