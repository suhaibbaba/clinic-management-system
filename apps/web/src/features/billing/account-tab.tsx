import { LEDGER_ENTRY_KIND, type PatientView, type StatementEntry } from '@clinic/shared';
import { useMemo, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, Button, EmptyState, Input, Table, useToast, type Column } from '@web/components/ui';
import { useSession } from '@web/features/auth/session';
import { downloadStatement, openReceipt } from '@web/features/billing/documents';
import { Money } from '@web/features/billing/money';
import { canRecordPayment, canReversePayment } from '@web/features/billing/permissions';
import { PaymentModal } from '@web/features/billing/payment-modal';
import { ReversePaymentModal } from '@web/features/billing/reverse-payment-modal';
import { usePatientBalance, useStatement } from '@web/features/billing/queries';
import { useClinic } from '@web/features/clinic/queries';
import { errorMessageKey } from '@web/lib/api-error';
import { endOfNextDayIso, formatDate, startOfDayIso } from '@web/lib/format';

interface AccountTabProps {
  patientId: string;
  patient: PatientView | undefined;
}

/**
 * The patient's account: every charge and payment, oldest first, with the
 * balance after each line.
 *
 * A line describes itself with the procedure's catalog name and nothing else.
 * That is not a rendering choice — the API sends no more than that, because a
 * receptionist reads this screen and ROLES.md keeps diagnoses and visit notes
 * away from them.
 */
export function AccountTab({ patientId, patient }: AccountTabProps): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();
  const toast = useToast();
  const clinic = useClinic();

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [paying, setPaying] = useState(false);
  const [reversing, setReversing] = useState<StatementEntry | null>(null);

  const query = useMemo(
    () => ({
      ...(startOfDayIso(from) && { from: startOfDayIso(from) as string }),
      ...(endOfNextDayIso(to) && { to: endOfNextDayIso(to) as string }),
    }),
    [from, to],
  );

  const balance = usePatientBalance(patientId);
  const statement = useStatement(patientId, query);

  const currency = clinic.data?.currency;
  const role = user?.role;

  const print = async (action: () => Promise<void>): Promise<void> => {
    try {
      await action();
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const columns: readonly Column<StatementEntry>[] = [
    {
      key: 'date',
      header: 'billing.columns.date',
      render: (entry) => <span dir="ltr">{formatDate(entry.occurredAt)}</span>,
    },
    {
      key: 'description',
      header: 'billing.columns.description',
      render: (entry) => (
        <span className="flex flex-wrap items-center gap-2">
          {entry.description || t(`billing.kinds.${entry.kind}`)}
          {entry.isReversal && <Badge tone="warning">{t('billing.reversal')}</Badge>}
          {entry.receiptNumber !== null && (
            <span className="text-xs text-gray-500" dir="ltr">
              #{String(entry.receiptNumber).padStart(6, '0')}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'charge',
      header: 'billing.columns.charge',
      render: (entry) =>
        entry.kind === LEDGER_ENTRY_KIND.CHARGE ? <Money amount={entry.amount} /> : null,
    },
    {
      key: 'payment',
      header: 'billing.columns.payment',
      render: (entry) =>
        entry.kind === LEDGER_ENTRY_KIND.PAYMENT ? (
          <Money amount={entry.amount.replace('-', '')} />
        ) : null,
    },
    {
      key: 'balance',
      header: 'billing.columns.balance',
      render: (entry) => <Money amount={entry.runningBalance} className="font-medium" />,
    },
    {
      key: 'actions',
      header: 'common.actions',
      render: (entry) =>
        entry.kind === LEDGER_ENTRY_KIND.PAYMENT && !entry.isReversal ? (
          <span className="flex gap-2">
            <Button variant="ghost" onClick={() => void print(() => openReceipt(entry.id))}>
              {t('billing.receipt')}
            </Button>
            {role && canReversePayment(role) && (
              <Button variant="ghost" onClick={() => setReversing(entry)}>
                {t('billing.reverse')}
              </Button>
            )}
          </span>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <div>
          <span className="block text-xs text-gray-500">{t('billing.outstanding')}</span>
          <Money
            amount={balance.data?.balance ?? '0.00'}
            currency={currency}
            signed
            className="text-2xl font-semibold"
          />
          {balance.data?.lastPaymentAt && (
            <span className="mt-1 block text-xs text-gray-500">
              {t('billing.lastPayment')}:{' '}
              <span dir="ltr">{formatDate(balance.data.lastPaymentAt)}</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {role && canRecordPayment(role) && (
            <Button onClick={() => setPaying(true)}>{t('billing.recordPayment')}</Button>
          )}
          <Button
            variant="secondary"
            onClick={() =>
              void print(() => downloadStatement(patientId, patient?.fileNumber ?? '', query))
            }
          >
            {t('billing.downloadStatement')}
          </Button>
        </div>
      </section>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-gray-600">
          {t('billing.from')}
          <Input type="date" dir="ltr" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-600">
          {t('billing.to')}
          <Input type="date" dir="ltr" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        {(from || to) && (
          <Button
            variant="ghost"
            onClick={() => {
              setFrom('');
              setTo('');
            }}
          >
            {t('common.reset')}
          </Button>
        )}
      </div>

      {statement.data && Number(statement.data.openingBalance) !== 0 && (
        <p className="text-sm text-gray-600">
          {t('billing.openingBalance')}:{' '}
          <Money amount={statement.data.openingBalance} currency={currency} />
        </p>
      )}

      <Table
        columns={columns}
        rows={statement.data?.entries ?? []}
        rowKey={(entry) => entry.id}
        isLoading={statement.isPending}
        empty={<EmptyState title="billing.empty" hint="billing.emptyHint" />}
      />

      <PaymentModal
        open={paying}
        onOpenChange={setPaying}
        patientId={patientId}
        suggestedAmount={balance.data?.balance}
        currency={currency}
      />

      <ReversePaymentModal
        payment={reversing}
        onOpenChange={(open) => !open && setReversing(null)}
        currency={currency}
      />
    </div>
  );
}
