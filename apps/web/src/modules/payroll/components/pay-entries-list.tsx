import type { PayrollLine, SettlementPayout } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, ConfirmDialog, Icon, Money, useToast, type BadgeTone } from "@clinic/ui";
import { payoutSource } from "@web/modules/payroll/lib/documents";
import {
  isReversible,
  payEntries,
  type PayEntry,
  type PayEntryKind,
} from "@web/modules/payroll/lib/pay-entries";
import { useReverseAdjustment, useReversePayment } from "@web/modules/payroll/queries";
import { DocumentActions } from "@web/shared/components/document-actions";
import { errorToast } from "@web/shared/lib/api-error";
import { formatDate } from "@web/shared/lib/format";
import { useCurrency } from "@web/shared/queries/clinic";

const KIND_TONES: Record<PayEntryKind, BadgeTone> = {
  extra: "info",
  cut: "warning",
  salary: "success",
  share: "success",
};

export function PayEntriesList({
  line,
  payouts,
  closed,
}: {
  readonly line: PayrollLine;
  readonly payouts: readonly SettlementPayout[];
  readonly closed: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const currency = useCurrency();
  const reverseAdjustment = useReverseAdjustment();
  const reversePayment = useReversePayment();
  const [reversing, setReversing] = useState<PayEntry | null>(null);

  const entries = payEntries(line, payouts);

  return (
    <section data-testid="pay-entries" className="flex flex-col gap-3">
      <h2 className="text-value font-semibold text-ink">{t("payroll.entries")}</h2>

      {entries.length === 0 ? (
        <p data-testid="pay-entries-empty" className="text-meta text-ink-muted">
          {t("payroll.noEntries")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              data-testid={`pay-entry-${entry.id}`}
              className="flex flex-wrap items-center gap-3 rounded-panel border border-line bg-surface px-3 py-2"
            >
              <Badge tone={KIND_TONES[entry.kind]}>{t(`payroll.entryKinds.${entry.kind}`)}</Badge>
              <Money amount={entry.amount} currency={currency} className="font-medium" />
              <span className="text-meta text-ink-muted">{formatDate(entry.at)}</span>
              {entry.treatments > 0 && (
                <span className="text-meta text-ink-muted">
                  {t("doctors.settlement.coversTreatments", { count: entry.treatments })}
                </span>
              )}
              {entry.note && (
                <span className="min-w-0 truncate text-meta text-ink">{entry.note}</span>
              )}
              {(entry.reversed || entry.reversal) && (
                <Badge tone="danger">{t("payroll.reversed")}</Badge>
              )}
              <span className="ms-auto flex items-center gap-1">
                {entry.kind === "share" && !entry.reversal && line.doctorId && (
                  <DocumentActions
                    data-testid="pay-entry-print"
                    label={t("doctors.settlement.printPayout")}
                    source={payoutSource(line.doctorId, entry.id)}
                  />
                )}
                {isReversible(entry, closed) && (
                  <Button
                    size="sm"
                    variant="quiet"
                    icon={<Icon name="reset" />}
                    data-testid="pay-entry-reverse"
                    onClick={() => setReversing(entry)}
                  >
                    {t("payroll.reverse")}
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        data-testid="pay-entry-reverse-confirm"
        open={reversing !== null}
        onOpenChange={(open) => !open && setReversing(null)}
        title="payroll.reverseTitle"
        consequences={[
          reversing?.kind === "share" && reversing.treatments > 0
            ? t("doctors.settlement.reverseReleases", { count: reversing.treatments })
            : t("payroll.reverseConsequence"),
        ]}
        note={{ label: t("payroll.reverseReason") }}
        confirmLabel={t("payroll.reverse")}
        onConfirm={async ({ note }) => {
          if (!reversing) {
            return;
          }

          try {
            if (reversing.kind === "extra" || reversing.kind === "cut") {
              await reverseAdjustment.mutateAsync({ id: reversing.id, reason: note });
            } else {
              await reversePayment.mutateAsync({ id: reversing.id, reason: note });
            }
            toast.success("payroll.reversedDone");
          } catch (error) {
            toast.error(...errorToast(error));
            throw error;
          }
        }}
      />
    </section>
  );
}
