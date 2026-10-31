import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, Money } from "@clinic/ui";
import { cn } from "@clinic/ui/lib/cn";

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
      className={cn(
        "sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex flex-wrap items-center gap-2",
        "rounded-card border border-line bg-surface p-2 ps-4 shadow-card",
        "sm:flex-nowrap sm:rounded-pill sm:p-1.5 sm:ps-5",
      )}
    >
      <div className="flex flex-[1_1_auto] flex-wrap items-center gap-x-3 gap-y-1">
        {total !== null && (
          <>
            <span className="flex items-baseline gap-2 whitespace-nowrap">
              <span className="text-label text-ink-muted">{t("inventory.purchase.total")}</span>
              <span data-testid="purchase-bar-total" className="text-title font-semibold text-ink">
                <Money cents amount={total} currency={currency} />
              </span>
            </span>
            <span aria-hidden="true" className="h-4 w-px shrink-0 bg-line" />
          </>
        )}
        <span
          data-testid="purchase-bar-count"
          className="whitespace-nowrap text-label text-ink-muted"
        >
          {t("inventory.purchase.itemCount", { count: lines })}
        </span>
      </div>
      <div className="flex grow gap-2 sm:grow-0">
        <Button
          variant="secondary"
          data-testid="purchase-cancel"
          className="flex-1 rounded-pill sm:flex-none"
          onClick={onCancel}
        >
          {t("common.cancel")}
        </Button>
        <Button
          data-testid="purchase-review"
          className="flex-1 rounded-pill sm:flex-none"
          aria-disabled={!ready || undefined}
          onClick={onReview}
        >
          {reviewLabel}
        </Button>
      </div>
    </div>
  );
}
