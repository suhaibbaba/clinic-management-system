import type { LabStatementEntry, LabWorkType } from '@clinic/shared';
import { useMemo, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import {
  Badge,
  Button,
  Card,
  type Column,
  DateRangePicker,
  EmptyState,
  Icon,
  Ltr,
  PhoneLink,
  SegmentedControl,
  StatCard,
  StatRow,
  Table,
} from '@web/components/ui';
import { useSession } from '@web/features/auth/session';
import { Money } from '@web/features/billing/money';
import { useClinic } from '@web/features/clinic/queries';
import { downloadLabStatement } from '@web/features/labs/documents';
import { LabFormModal } from '@web/features/labs/lab-form-modal';
import { LabOrdersTable } from '@web/features/labs/lab-orders-table';
import { LabPaymentModal } from '@web/features/labs/lab-payment-modal';
import { WorkTypeModal } from '@web/features/labs/work-type-modal';
import { canManageLabs, canPayLab } from '@web/features/labs/permissions';
import {
  useLab,
  useLabBalance,
  useLabOrders,
  useLabStatement,
  useLabWorkTypes,
} from '@web/features/labs/queries';
import { endOfNextDayIso, formatDate, startOfDayIso } from '@web/lib/format';

type Tab = 'orders' | 'prices' | 'statement';

/**
 * One lab: who they are, what they charge, what they are making, what we owe.
 *
 * Three tabs rather than one long page, because the three questions belong to
 * different people on different days — the technician keeps the price list,
 * the doctor watches the orders, and whoever settles up reads the statement.
 */
export function LabPage(): JSX.Element {
  const { t } = useTranslation();
  const { id = '' } = useParams<{ id: string }>();
  const { user } = useSession();

  const [tab, setTab] = useState<Tab>('orders');
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);

  const clinic = useClinic();
  const lab = useLab(id);
  const balance = useLabBalance(id);

  const currency = clinic.data?.currency;

  return (
    <div className="flex flex-col gap-5">
      {/* The lab's own name is data, not an i18n key, so this header is
          written here rather than through `PageHeader`. */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-[1.625rem] font-bold leading-[1.3] tracking-[-0.03em] text-ink sm:text-title">
            {lab.data?.name ?? '…'}
          </h1>
          {/*
            A contact and a phone number on one line, not a joined string.
            Joined, the `+` in front of the number is a neutral character and
            the bidi algorithm hands it to the Arabic around it: the lab's
            number was drawn as `963115556677+`, which is not a phone number
            anyone can dial.
          */}
          <p className="mt-1 flex flex-wrap items-baseline gap-1.5 text-value text-ink-muted">
            {lab.data?.contactPerson && <span>{lab.data.contactPerson}</span>}
            {lab.data?.contactPerson && lab.data?.phone && <span aria-hidden>—</span>}
            {lab.data?.phone && <PhoneLink value={lab.data.phone} />}
            {!lab.data?.contactPerson && !lab.data?.phone && t('labs.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManageLabs(user?.role) && (
            <Button
              variant="secondary"
              icon={<Icon name="edit" />}
              onClick={() => setEditing(true)}
            >
              {t('common.edit')}
            </Button>
          )}
          {canPayLab(user?.role) && (
            <Button icon={<Icon name="money" />} onClick={() => setPaying(true)}>
              {t('labs.payment.action')}
            </Button>
          )}
        </div>
      </header>

      <StatRow>
        <StatCard
          icon="money"
          tone={Number(balance.data?.balance ?? '0') > 0 ? 'warning' : 'success'}
          label={t('labs.kpi.balance')}
          value={<Money amount={balance.data?.balance ?? '0.00'} currency={currency} />}
          caption={t('labs.kpi.balanceCaption')}
        />
        <StatCard
          icon="clipboard"
          tone="primary"
          label={t('labs.kpi.owedTotal')}
          value={<Money amount={balance.data?.owed ?? '0.00'} currency={currency} />}
          caption={t('labs.kpi.owedTotalCaption')}
        />
        <StatCard
          icon="check"
          tone="success"
          label={t('labs.kpi.paid')}
          value={<Money amount={balance.data?.paid ?? '0.00'} currency={currency} />}
          {...(balance.data?.lastPaymentAt && {
            caption: formatDate(balance.data.lastPaymentAt),
          })}
        />
        <StatCard
          icon="clock"
          tone={(lab.data?.openOrders ?? 0) > 0 ? 'warning' : 'neutral'}
          label={t('labs.kpi.open')}
          value={lab.data?.openOrders ?? 0}
          caption={t('labs.kpi.openCaption')}
        />
      </StatRow>

      <SegmentedControl
        label={t('labs.tabs.label')}
        value={tab}
        onChange={(next) => setTab(next as Tab)}
        options={[
          { value: 'orders', label: t('labs.tabs.orders') },
          { value: 'prices', label: t('labs.tabs.prices') },
          { value: 'statement', label: t('labs.tabs.statement') },
        ]}
      />

      {tab === 'orders' && <LabOrdersTab labId={id} />}
      {tab === 'prices' && <PriceListTab labId={id} />}
      {tab === 'statement' && (
        <StatementTab labId={id} labName={lab.data?.name ?? ''} currency={currency} />
      )}

      {lab.data && (
        <>
          <LabFormModal open={editing} onOpenChange={setEditing} lab={lab.data} />
          <LabPaymentModal
            open={paying}
            onOpenChange={setPaying}
            labId={id}
            labName={lab.data.name}
            balance={balance.data}
            currency={currency}
          />
        </>
      )}
    </div>
  );
}

/** Everything this lab is making, or has made. */
function LabOrdersTab({ labId }: { readonly labId: string }): JSX.Element {
  const orders = useLabOrders({ labId, limit: 50 });

  return <LabOrdersTable orders={orders.data?.items ?? []} isLoading={orders.isPending} hideLab />;
}

/**
 * The price list.
 *
 * Editing a price here changes what the *next* order costs and nothing that is
 * already owed — every order carries the price it was placed at. The caption
 * says so, because it is exactly the kind of thing somebody assumes the other
 * way round.
 */
function PriceListTab({ labId }: { readonly labId: string }): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();
  const clinic = useClinic();
  const workTypes = useLabWorkTypes(labId, true);

  const [editing, setEditing] = useState<LabWorkType | undefined>();
  const [creating, setCreating] = useState(false);

  const mayEdit = canManageLabs(user?.role);

  const columns: readonly Column<LabWorkType>[] = [
    { key: 'name', header: 'labs.prices.name', primary: true, render: (row) => row.nameAr },
    {
      key: 'price',
      header: 'labs.prices.price',
      align: 'numeric',
      render: (row) => <Money amount={row.defaultPrice} currency={clinic.data?.currency} />,
    },
    {
      key: 'active',
      header: 'labs.prices.state',
      render: (row) =>
        row.isActive ? (
          <Badge tone="success">{t('labs.prices.active')}</Badge>
        ) : (
          <Badge tone="neutral">{t('labs.prices.inactive')}</Badge>
        ),
    },
    ...(mayEdit
      ? [
          {
            key: 'actions',
            header: 'labs.prices.actions',
            actions: true,
            render: (row: LabWorkType) => (
              <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>
                {t('common.edit')}
              </Button>
            ),
          } satisfies Column<LabWorkType>,
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      {mayEdit && (
        <div className="flex justify-end">
          <Button variant="secondary" icon={<Icon name="plus" />} onClick={() => setCreating(true)}>
            {t('labs.prices.add')}
          </Button>
        </div>
      )}

      <Table
        columns={columns}
        rows={workTypes.data ?? []}
        rowKey={(row) => row.id}
        isLoading={workTypes.isPending}
        empty={<EmptyState icon="money" title="labs.prices.empty" hint="labs.prices.emptyHint" />}
      />

      <p className="text-label text-ink-muted">{t('labs.prices.snapshotNote')}</p>

      <WorkTypeModal
        open={creating || editing !== undefined}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(undefined);
          }
        }}
        labId={labId}
        workType={editing}
      />
    </div>
  );
}

/**
 * The statement: every order and every payment, oldest first, with the balance
 * after each line — the same shape as a patient's account, because it answers
 * the same question from the other side.
 */
function StatementTab({
  labId,
  labName,
  currency,
}: {
  readonly labId: string;
  readonly labName: string;
  readonly currency: string | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const query = useMemo(
    () => ({
      ...(startOfDayIso(from) && { from: startOfDayIso(from) as string }),
      ...(endOfNextDayIso(to) && { to: endOfNextDayIso(to) as string }),
    }),
    [from, to],
  );

  const statement = useLabStatement(labId, query);

  const columns: readonly Column<LabStatementEntry>[] = [
    {
      key: 'date',
      header: 'labs.statement.date',
      render: (row) => <Ltr>{formatDate(row.occurredAt)}</Ltr>,
    },
    {
      key: 'description',
      header: 'labs.statement.description',
      primary: true,
      render: (row) => (
        <span className="flex flex-wrap items-center gap-2">
          <span>{row.description || t(`labs.statement.kind.${row.kind}`)}</span>
          {row.isReversal && <Badge tone="neutral">{t('labs.statement.reversal')}</Badge>}
        </span>
      ),
    },
    {
      key: 'owed',
      header: 'labs.statement.owed',
      align: 'numeric',
      render: (row) =>
        row.kind === 'order' ? <Money amount={row.amount} currency={currency} /> : null,
    },
    {
      key: 'paid',
      header: 'labs.statement.paid',
      align: 'numeric',
      render: (row) =>
        row.kind === 'payment' ? (
          <Money amount={row.amount.replace('-', '')} currency={currency} />
        ) : null,
    },
    {
      key: 'balance',
      header: 'labs.statement.balance',
      align: 'numeric',
      render: (row) => (
        <Money amount={row.runningBalance} currency={currency} className="font-medium" />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <DateRangePicker
          id="lab-statement-range"
          className="w-full sm:w-72"
          label={t('labs.statement.range')}
          value={{ from, to }}
          onChange={(range) => {
            setFrom(range.from);
            setTo(range.to);
          }}
        />

        <Button
          variant="secondary"
          className="ms-auto"
          icon={<Icon name="print" />}
          onClick={() => void downloadLabStatement(labId, labName, query)}
        >
          {t('labs.statement.print')}
        </Button>
      </div>

      <Card>
        <div className="flex items-baseline justify-between">
          <span className="text-label text-ink-muted">{t('labs.statement.opening')}</span>
          <Money amount={statement.data?.openingBalance ?? '0.00'} currency={currency} />
        </div>
      </Card>

      <Table
        columns={columns}
        rows={statement.data?.entries ?? []}
        rowKey={(row) => `${row.kind}-${row.id}`}
        isLoading={statement.isPending}
        empty={
          <EmptyState icon="money" title="labs.statement.empty" hint="labs.statement.emptyHint" />
        }
      />

      <Card>
        <div className="flex items-baseline justify-between">
          <span className="text-value font-semibold text-ink">{t('labs.statement.closing')}</span>
          <Money
            amount={statement.data?.closingBalance ?? '0.00'}
            currency={currency}
            className="text-value font-semibold"
          />
        </div>
      </Card>
    </div>
  );
}
