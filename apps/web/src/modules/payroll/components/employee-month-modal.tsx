import type { PayrollLine } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Badge, ConfirmDialog, Icon, Modal, Money, PersonName, useToast } from "@clinic/ui";
import { useReverseAdjustment, useReverseSalaryPayment } from "@web/modules/payroll/queries";
import { errorToast } from "@web/shared/lib/api-error";
import { formatDate } from "@web/shared/lib/format";
import { useCurrency } from "@web/shared/queries/clinic";

type Reversing = { readonly kind: "adjustment" | "payment"; readonly id: string };

export function EmployeeMonthModal({
  line,
  closed,
  onClose,
}: {
  readonly line: PayrollLine | null;
  readonly closed: boolean;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const currency = useCurrency();
  const reverseAdjustment = useReverseAdjustment();
  const reversePayment = useReverseSalaryPayment();
  const [reversing, setReversing] = useState<Reversing | null>(null);

  const entries = [
    ...(line?.adjustments ?? []).map((entry) => ({
      id: entry.id,
      kind: "adjustment" as const,
      label: t(`payroll.kind.${entry.kind}`),
      amount: entry.amount,
      note: entry.reason,
      at: entry.createdAt,
      reversible: !closed && entry.reversesId === null && entry.reversedAt === null,
      reversed: entry.reversedAt !== null || entry.reversesId !== null,
    })),
    ...(line?.payments ?? []).map((entry) => ({
      id: entry.id,
      kind: "payment" as const,
      label: t("payroll.payment"),
      amount: entry.amount,
      note: entry.note,
      at: entry.createdAt,
      reversible: entry.reversesId === null && entry.reversedAt === null,
      reversed: entry.reversedAt !== null || entry.reversesId !== null,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <Modal
      data-testid="payroll-employee-modal"
      open={line !== null}
      onOpenChange={(open) => !open && onClose()}
      title="payroll.entries"
      size="lg"
    >
      {line && (
        <div className="flex flex-col gap-3">
          <PersonName name={line.name} className="text-value font-medium text-ink" />

          {entries.length === 0 ? (
            <p className="text-meta text-ink-muted">{t("payroll.noEntries")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  data-testid={`payroll-entry-${entry.id}`}
                  className="flex items-center gap-3 rounded-panel border border-line bg-surface px-3 py-2"
                >
                  <Badge tone={entry.kind === "payment" ? "success" : "neutral"}>
                    {entry.label}
                  </Badge>
                  <Money amount={entry.amount} currency={currency} className="font-medium" />
                  <span className="text-meta text-ink-muted">{formatDate(entry.at)}</span>
                  {entry.note && <span className="truncate text-meta text-ink">{entry.note}</span>}
                  {entry.reversed && <Badge tone="danger">{t("payroll.reversed")}</Badge>}
                  {entry.reversible && (
                    <button
                      type="button"
                      data-testid="payroll-entry-reverse"
                      className="ms-auto inline-flex cursor-pointer items-center gap-1 text-meta text-danger-700 hover:underline"
                      onClick={() => setReversing({ kind: entry.kind, id: entry.id })}
                    >
                      <Icon name="reset" className="size-3.5" />
                      {t("payroll.reverse")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ConfirmDialog
        data-testid="payroll-reverse-confirm"
        open={reversing !== null}
        onOpenChange={(open) => !open && setReversing(null)}
        title="payroll.reverseTitle"
        consequences={[t("payroll.reverseConsequence")]}
        note={{ label: t("payroll.reverseReason") }}
        onConfirm={async ({ note }) => {
          if (!reversing) {
            return;
          }

          try {
            if (reversing.kind === "adjustment") {
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
    </Modal>
  );
}
