import { formatMinorUnits, toMinorUnits, type InvoiceResult } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, FormField, Ltr, Modal, Money, MoneyInput, Select } from "@clinic/ui";
import type { PurchaseCounts } from "@web/modules/inventory/lib/purchase-form";

export function PurchaseReviewModal({
  open,
  onOpenChange,
  withInvoice,
  counts,
  totals,
  currency,
  mayPay,
  paidNow,
  paidMinor,
  overpaid,
  method,
  methods,
  postLabel,
  posting,
  onPaidNowChange,
  onMethodChange,
  onPost,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly withInvoice: boolean;
  readonly counts: PurchaseCounts;
  readonly totals: InvoiceResult | null;
  readonly currency: string | undefined;
  readonly mayPay: boolean;
  readonly paidNow: string;
  readonly paidMinor: number;
  readonly overpaid: boolean;
  readonly method: string;
  readonly methods: readonly { readonly value: string; readonly label: string }[];
  readonly postLabel: string;
  readonly posting: boolean;
  readonly onPaidNowChange: (value: string) => void;
  readonly onMethodChange: (value: string) => void;
  readonly onPost: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const remaining = totals ? formatMinorUnits(toMinorUnits(totals.total) - paidMinor) : null;
  const stats = [
    ["inventory.purchase.lines", counts.lines, true],
    ["inventory.purchase.totalQuantity", counts.quantity, true],
    ["inventory.purchase.freeShort", counts.free, counts.free > 0],
    ["inventory.purchase.gifts", counts.gifts, counts.gifts > 0],
  ] as const;

  return (
    <Modal
      data-testid="purchase-review-modal"
      open={open}
      onOpenChange={onOpenChange}
      title="inventory.purchase.reviewTitle"
      footer={
        <>
          <Button
            variant="secondary"
            data-testid="purchase-review-back"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            data-testid="purchase-post"
            aria-disabled={overpaid || undefined}
            isLoading={posting}
            onClick={onPost}
          >
            {postLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <dl data-testid="purchase-review-counts" className="grid grid-cols-2 gap-3">
          {stats
            .filter(([, , shown]) => shown)
            .map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1 rounded-panel bg-inset p-3">
                <dt className="text-label text-ink-muted">{t(label)}</dt>
                <dd className="text-title font-semibold text-ink">
                  <Ltr>{value}</Ltr>
                </dd>
              </div>
            ))}
        </dl>

        {totals && (
          <dl data-testid="purchase-review-totals" className="flex flex-col gap-2">
            {(
              [
                ["inventory.purchase.subtotal", totals.subtotal, true],
                [
                  "inventory.purchase.invoiceDiscount",
                  `-${totals.invoiceDiscount}`,
                  Number(totals.invoiceDiscount) !== 0,
                ],
                ["inventory.purchase.charges", totals.charges, Number(totals.charges) !== 0],
              ] as const
            )
              .filter(([, , shown]) => shown)
              .map(([label, amount]) => (
                <div key={label} className="flex items-baseline justify-between gap-3 text-value">
                  <dt className="text-ink-muted">{t(label)}</dt>
                  <dd>
                    <Money cents amount={amount} currency={currency} />
                  </dd>
                </div>
              ))}
            <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
              <dt className="text-value font-semibold">{t("inventory.purchase.total")}</dt>
              <dd data-testid="purchase-review-total" className="text-title font-semibold">
                <Money cents amount={totals.total} currency={currency} />
              </dd>
            </div>
          </dl>
        )}

        {totals && mayPay && (
          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                label="inventory.movement.paidNow"
                htmlFor="purchase-paid"
                optional
                error={overpaid ? { type: "too_big" } : undefined}
                {...(overpaid && { errorKey: "inventory.movement.paidTooMuch" })}
              >
                <MoneyInput
                  cents
                  id="purchase-paid"
                  data-testid="purchase-field-paid"
                  currency={currency}
                  placeholder="0"
                  value={paidNow}
                  onChange={(event) => onPaidNowChange(event.target.value)}
                />
              </FormField>
              {paidMinor > 0 && (
                <FormField label="inventory.movement.paymentMethod" htmlFor="purchase-method">
                  <Select
                    id="purchase-method"
                    data-testid="purchase-field-method"
                    value={method}
                    onChange={(event) => onMethodChange(event.target.value)}
                    options={methods}
                  />
                </FormField>
              )}
            </div>
            {remaining !== null && !overpaid && (
              <div className="flex items-baseline justify-between gap-3 text-value">
                <span className="text-ink-muted">{t("inventory.purchase.remaining")}</span>
                <span data-testid="purchase-review-remaining" className="font-semibold">
                  <Money cents amount={remaining} currency={currency} />
                </span>
              </div>
            )}
          </div>
        )}

        <ul
          data-testid="purchase-review-consequences"
          className="flex list-disc flex-col gap-1 ps-5 text-label text-ink-muted"
        >
          <li>{t("inventory.purchase.consequenceStock")}</li>
          {withInvoice && <li>{t("inventory.purchase.consequenceOwed")}</li>}
        </ul>
      </div>
    </Modal>
  );
}
