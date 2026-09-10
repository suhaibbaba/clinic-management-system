import type { LabOrderRow } from '@clinic/shared';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, EmptyState, Ltr, Table, type Column } from '@web/components/ui';
import { Money } from '@web/features/billing/money';
import { useClinic } from '@web/features/clinic/queries';
import { LAB_ORDER_STATUS_STYLES } from '@web/features/labs/status';
import { formatDate } from '@web/lib/format';

// The same `Table` as the rest of the app, so it collapses to cards at the same breakpoint. A late
// order carries its own badge rather than a date the eye must compare.
export function LabOrdersTable({
  orders,
  isLoading,
  isRefreshing = false,
  onOpen,
  hideLab = false,
}: {
  readonly orders: readonly LabOrderRow[];
  readonly isLoading: boolean;
  readonly isRefreshing?: boolean | undefined;
  readonly onOpen?: ((order: LabOrderRow) => void) | undefined;
  /** Dropped on a lab's own page, where every row names the same lab. */
  readonly hideLab?: boolean | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const clinic = useClinic();

  const columns: readonly Column<LabOrderRow>[] = [
    {
      key: 'work',
      header: 'labs.orders.columns.work',
      primary: true,
      render: (row) => (
        <span className="flex flex-col">
          <span className="font-medium text-ink">
            {row.workTypeName ?? t('labs.orders.custom')}
          </span>
          {row.teeth.length > 0 && (
            <Ltr className="text-label text-ink-muted tabular-nums">{row.teeth.join(' · ')}</Ltr>
          )}
        </span>
      ),
    },
    {
      key: 'patient',
      header: 'labs.orders.columns.patient',
      render: (row) => (
        <span className="flex flex-col">
          <span>{row.patientName}</span>
          <Ltr className="text-label text-ink-muted">{row.patientFileNumber}</Ltr>
        </span>
      ),
    },
    ...(hideLab
      ? []
      : [
          {
            key: 'lab',
            header: 'labs.orders.columns.lab',
            render: (row: LabOrderRow) => row.labName,
          } satisfies Column<LabOrderRow>,
        ]),
    {
      key: 'status',
      header: 'labs.orders.columns.status',
      render: (row) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone={LAB_ORDER_STATUS_STYLES[row.status].tone}>
            {t(LAB_ORDER_STATUS_STYLES[row.status].label)}
          </Badge>
          {row.isOverdue && <Badge tone="danger">{t('labs.orders.overdue')}</Badge>}
        </span>
      ),
    },
    {
      key: 'expected',
      header: 'labs.orders.columns.expected',
      hideOnMobile: true,
      render: (row) => (row.expectedAt ? <Ltr>{formatDate(row.expectedAt)}</Ltr> : '—'),
    },
    {
      key: 'price',
      header: 'labs.orders.columns.price',
      align: 'numeric',
      render: (row) => <Money amount={row.price} currency={clinic.data?.currency} />,
    },
  ];

  return (
    <Table
      columns={columns}
      rows={orders}
      rowKey={(row) => row.id}
      isLoading={isLoading}
      isRefreshing={isRefreshing}
      {...(onOpen && { onRowClick: onOpen, rowLabel: (row: LabOrderRow) => row.patientName })}
      empty={<EmptyState icon="clipboard" title="labs.orders.empty" hint="labs.orders.emptyHint" />}
    />
  );
}
