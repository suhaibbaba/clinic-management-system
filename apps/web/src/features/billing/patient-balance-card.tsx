import { LEDGER_ENTRY_KIND } from "@clinic/shared";
import { type JSX } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@clinic/ui";
import { Skeleton } from "@clinic/ui/components/skeleton";
import { Money } from "@web/features/billing/money";
import { usePatientBalance, useStatement } from "@web/features/billing/queries";
import { useClinic } from "@web/features/clinic/queries";

// An aggregate over the ledgers on every read. "Due today" is what reception needs while the
// patient is still at the desk; the older total is a different conversation. Renders as one cell of
// the file header's list, so it reads in the run of what the patient is rather than as a figure.
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
    <div data-testid="patient-balance-card" className="min-w-0">
      <dt className="text-value text-ink-muted">{t("patients.balance")}</dt>
      <dd className="mt-0.5 flex min-w-0 flex-wrap items-center gap-2 text-value text-ink">
        {balance.isPending ? (
          <Skeleton className="h-5 w-20" />
        ) : (
          <Money
            amount={balance.data?.balance ?? "0.00"}
            currency={currency}
            signed
            data-testid="patient-balance"
            className="font-medium"
          />
        )}

        {dueToday > 0 && (
          <Badge tone="warning" data-testid="patient-due-today">
            <span className="inline-flex items-center gap-1">
              {t("billing.dueToday")}:
              <Money amount={(dueToday / 100).toFixed(2)} currency={currency} />
            </span>
          </Badge>
        )}
      </dd>
    </div>
  );
}

function startOfToday(): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);

  return date.toISOString();
}
