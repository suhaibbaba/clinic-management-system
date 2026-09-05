import type { OverduePatient } from '@clinic/shared';
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Badge, EmptyState, PageHeader, Table, type Column } from '@web/components/ui';
import { Money } from '@web/features/billing/money';
import { useOverduePatients } from '@web/features/billing/queries';
import { useClinic } from '@web/features/clinic/queries';
import { formatDate } from '@web/lib/format';

const PAGE_SIZE = 20;

/**
 * Patients who owe money and have not paid inside the clinic's window.
 *
 * The window is a clinic setting, not a constant here: the API decides what
 * counts as overdue, so this screen cannot drift from what the reports will
 * later say.
 */
export function OverduePage(): JSX.Element {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);

  const clinic = useClinic();
  const overdue = useOverduePatients({ page, limit: PAGE_SIZE });
  const currency = clinic.data?.currency;

  const columns: readonly Column<OverduePatient>[] = [
    {
      key: 'patient',
      header: 'billing.columns.patient',
      render: (row) => (
        <span className="flex flex-col">
          <Link to={`/patients/${row.patientId}`} className="font-medium text-primary-700">
            {row.fullName}
          </Link>
          <span className="text-xs text-ink-muted" dir="ltr">
            {row.fileNumber}
          </span>
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'billing.columns.balance',
      render: (row) => <Money amount={row.balance} currency={currency} className="font-medium" />,
    },
    {
      key: 'lastPayment',
      header: 'billing.columns.lastPayment',
      render: (row) =>
        row.lastPaymentAt ? (
          <span className="flex flex-wrap items-center gap-2">
            <span dir="ltr">{formatDate(row.lastPaymentAt)}</span>
            {row.daysSinceLastPayment !== null && (
              <Badge tone="warning">
                {t('billing.daysAgo', { count: row.daysSinceLastPayment })}
              </Badge>
            )}
          </span>
        ) : (
          <Badge tone="danger">{t('billing.neverPaid')}</Badge>
        ),
    },
    {
      key: 'phone',
      header: 'billing.columns.phone',
      render: (row) => (
        <a href={`tel:${row.phone}`} dir="ltr" className="text-primary-700">
          {row.phone}
        </a>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="billing.overdueTitle" subtitle="billing.overdueSubtitle" />

      <Table
        columns={columns}
        rows={overdue.data?.items ?? []}
        rowKey={(row) => row.patientId}
        isLoading={overdue.isPending}
        empty={<EmptyState title="billing.overdueEmpty" hint="billing.overdueEmptyHint" />}
        pagination={{
          page,
          totalPages: overdue.data?.totalPages ?? 0,
          total: overdue.data?.total ?? 0,
          onPageChange: setPage,
        }}
      />
    </div>
  );
}
