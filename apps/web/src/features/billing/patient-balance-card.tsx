import { LEDGER_ENTRY_KIND } from '@clinic/shared';
import { type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@web/components/ui';
import { Money } from '@web/features/billing/money';
import { usePatientBalance, useStatement } from '@web/features/billing/queries';
import { useClinic } from '@web/features/clinic/queries';

/**
 * What the patient owes, in the file header.
 *
 * The figure is a SQL aggregate over the ledgers on every read — there is no
 * stored balance to go stale, which is the whole reason CLAUDE.md forbids one.
 *
 * "Due today" is the work billed since midnight. It is what reception needs
 * the moment a doctor marks a procedure done: the patient is still at the
 * desk, and the outstanding total from previous visits is a different
 * conversation.
 */
export function PatientBalanceCard({ patientId }: { patientId: string }): JSX.Element {
  const { t } = useTranslation();
  const clinic = useClinic();
  const balance = usePatientBalance(patientId);

  const since = startOfToday();
  const today = useStatement(patientId, { from: since });

  const currency = clinic.data?.currency;
  const dueToday = (today.data?.entries ?? [])
    .filter((entry) => entry.kind === LEDGER_ENTRY_KIND.CHARGE)
    .reduce((sum, entry) => sum + Math.round(Number(entry.amount) * 100), 0);

  return (
    <div className="text-end">
      <span className="block text-xs text-gray-500">{t('patients.balance')}</span>

      {balance.isPending ? (
        <span className="block text-lg font-semibold text-gray-400">—</span>
      ) : (
        <Money
          amount={balance.data?.balance ?? '0.00'}
          currency={currency}
          signed
          className="text-lg font-semibold"
        />
      )}

      {dueToday > 0 && (
        <span className="mt-1 block">
          <Badge tone="warning">
            <span className="inline-flex items-center gap-1">
              {t('billing.dueToday')}:
              <Money amount={(dueToday / 100).toFixed(2)} currency={currency} />
            </span>
          </Badge>
        </span>
      )}
    </div>
  );
}

/** Midnight local time, as the ISO instant the statement filter expects. */
function startOfToday(): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);

  return date.toISOString();
}
