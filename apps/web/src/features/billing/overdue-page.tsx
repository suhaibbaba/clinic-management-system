import { addMoney, type Money as MoneyAmount, type OverduePatient } from '@clinic/shared';
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import {
  Badge,
  EmptyState,
  PageHeader,
  StatCard,
  StatRow,
  Table,
  type Column,
} from '@web/components/ui';
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

  /*
   * The KPI row is computed from the page in hand, and says so.
   *
   * The API paginates this list and returns no aggregate, so a total across
   * every overdue patient is not available here. Summing one page and calling
   * it "the clinic's outstanding debt" would be a wrong number on a financial
   * screen, which is worse than no number — so the caption states the scope
   * and the count comes from the server's `total`, which is exact.
   */
  const rows = overdue.data?.items ?? [];
  const pageTotal = rows.reduce<MoneyAmount>((sum, row) => addMoney(sum, row.balance), '0.00');
  const worst = rows.reduce<OverduePatient | undefined>(
    (top, row) => (top === undefined || Number(row.balance) > Number(top.balance) ? row : top),
    undefined,
  );
  const neverPaid = rows.filter((row) => row.lastPaymentAt === null).length;

  const columns: readonly Column<OverduePatient>[] = [
    {
      key: 'patient',
      header: 'billing.columns.patient',
      render: (row) => (
        <span className="flex flex-col">
          <Link to={`/patients/${row.patientId}`} className="font-medium text-primary-700">
            {row.fullName}
          </Link>
          <span className="text-label text-ink-muted" dir="ltr">
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

      {rows.length > 0 && (
        <StatRow>
          <StatCard
            icon="users"
            tone="primary"
            label={t('billing.kpi.patients')}
            value={overdue.data?.total ?? 0}
            caption={t('billing.kpi.patientsCaption')}
          />
          <StatCard
            icon="money"
            tone="danger"
            label={t('billing.kpi.outstanding')}
            value={<Money amount={pageTotal} currency={currency} />}
            caption={t('billing.kpi.thisPage')}
          />
          <StatCard
            icon="trend-up"
            tone="warning"
            label={t('billing.kpi.largest')}
            value={<Money amount={worst?.balance ?? '0.00'} currency={currency} />}
            caption={worst?.fullName ?? ''}
          />
          <StatCard
            icon="alert"
            tone={neverPaid > 0 ? 'danger' : 'success'}
            label={t('billing.kpi.neverPaid')}
            value={neverPaid}
            caption={t('billing.kpi.thisPage')}
          />
        </StatRow>
      )}

      <Table
        columns={columns}
        rows={overdue.data?.items ?? []}
        rowKey={(row) => row.patientId}
        isLoading={overdue.isPending}
        empty={
          <EmptyState icon="money" title="billing.overdueEmpty" hint="billing.overdueEmptyHint" />
        }
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
