import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, Money } from "@clinic/ui";

export function PurchaseTotalBar({
  lines,
  total,
  currency,
  reviewLabel,
  ready,
  onReview,
  onCancel,
}: {
  readonly lines: number;
  readonly total: string | null;
  readonly currency: string | undefined;
  readonly reviewLabel: string;
  readonly ready: boolean;
  readonly onReview: () => void;
  readonly onCancel: () => void;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <div
      data-testid="purchase-bar"
      role="region"
      aria-label={t("inventory.purchase.reviewTitle")}
      className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex items-center gap-2 rounded-pill border border-line bg-surface p-1.5 ps-5 shadow-card"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden whitespace-nowrap">
        {total !== null && (
          <>
            <span className="flex items-baseline gap-2">
              <span className="text-label text-ink-muted">{t("inventory.purchase.total")}</span>
              <span data-testid="purchase-bar-total" className="text-title font-semibold text-ink">
                <Money cents amount={total} currency={currency} />
              </span>
            </span>
            <span aria-hidden="true" className="h-4 w-px shrink-0 bg-line" />
          </>
        )}
        <span data-testid="purchase-bar-count" className="truncate text-label text-ink-muted">
          {t("inventory.purchase.itemCount", { count: lines })}
        </span>
      </div>
      <Button
        variant="secondary"
        data-testid="purchase-cancel"
        className="shrink-0 rounded-pill"
        onClick={onCancel}
      >
        {t("common.cancel")}
      </Button>
      <Button
        data-testid="purchase-review"
        className="shrink-0 rounded-pill"
        aria-disabled={!ready || undefined}
        onClick={onReview}
      >
        {reviewLabel}
      </Button>
    </div>
  );
}
