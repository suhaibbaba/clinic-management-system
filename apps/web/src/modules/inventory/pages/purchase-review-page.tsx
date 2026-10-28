import { PURCHASE_DOCUMENT_STATUS, type PurchaseReviewEntry } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Badge,
  Button,
  type Column,
  EmptyState,
  Icon,
  Ltr,
  PageHeader,
  PersonName,
  Table,
  useToast,
} from "@clinic/ui";
import { isRefetching } from "@clinic/ui/lib/use-delayed-loading";
import { errorToast } from "@web/shared/lib/api-error";
import { formatDate, formatDateTime } from "@web/shared/lib/format";
import { useCurrency } from "@web/shared/queries/clinic";
import { Money } from "@web/shared/components/money";
import { useMarkReviewed, usePurchaseReview } from "@web/modules/inventory/queries";
import { reviewSelection } from "@web/modules/inventory/lib/purchase-review";

export function PurchaseReviewPage(): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const currency = useCurrency();
  const review = usePurchaseReview();
  const mark = useMarkReviewed();
  const entries = review.data ?? [];

  const markReviewed = async (selected: readonly PurchaseReviewEntry[]): Promise<void> => {
    if (selected.length === 0 || mark.isPending) {
      return;
    }

    try {
      await mark.mutateAsync(reviewSelection(selected));
      toast.success("inventory.review.done");
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  const columns: readonly Column<PurchaseReviewEntry>[] = [
    {
      key: "document",
      header: "inventory.review.columns.document",
      primary: true,
      render: (row) => (
        <span className="flex flex-col items-start">
          <span className="flex items-center gap-1.5">
            <Ltr className="font-medium text-ink">{row.number}</Ltr>
            {row.status === PURCHASE_DOCUMENT_STATUS.VOID && (
              <Badge tone="neutral">{t("inventory.review.void")}</Badge>
            )}
          </span>
          <span className="text-label text-ink-muted">
            {row.supplierName ? <bdi>{row.supplierName}</bdi> : t("inventory.purchase.noSupplier")}
            {row.supplierRef && (
              <>
                {" · "}
                <Ltr>{row.supplierRef}</Ltr>
              </>
            )}
          </span>
        </span>
      ),
    },
    {
      key: "kind",
      header: "inventory.review.columns.kind",
      render: (row) => t(`inventory.review.kinds.${row.kind}`),
    },
    {
      key: "amount",
      header: "inventory.review.columns.amount",
      align: "numeric",
      render: (row) =>
        row.total ? (
          <Money cents amount={row.total} currency={currency} />
        ) : (
          t("inventory.review.lines", { count: row.lines })
        ),
    },
    {
      key: "by",
      header: "inventory.review.columns.by",
      render: (row) => (
        <span className="flex flex-col items-start">
          {row.createdByName ? <PersonName name={row.createdByName} /> : "—"}
          <span className="text-label text-ink-muted">
            {formatDate(`${row.date}T12:00:00.000Z`)} · {formatDateTime(row.createdAt)}
          </span>
        </span>
      ),
    },
    {
      key: "actions",
      header: "common.actions",
      actions: true,
      render: (row) => (
        <Button
          size="sm"
          variant="ghost"
          icon={<Icon name="check" />}
          data-testid="review-mark"
          aria-disabled={mark.isPending || undefined}
          onClick={() => void markReviewed([row])}
        >
          {t("inventory.review.mark")}
        </Button>
      ),
    },
  ];

  return (
    <div data-testid="purchase-review-page" className="flex flex-col gap-5">
      <PageHeader
        data-testid="purchase-review-header"
        title="inventory.review.title"
        subtitle="inventory.review.subtitle"
        primaryAction={
          entries.length > 0 ? (
            <Button
              icon={<Icon name="check" />}
              data-testid="review-mark-all"
              isLoading={mark.isPending}
              onClick={() => void markReviewed(entries)}
            >
              {t("inventory.review.markAll")}
            </Button>
          ) : undefined
        }
      />

      <Table
        data-testid="purchase-review-table"
        columns={columns}
        rows={entries}
        rowKey={(row) => `${row.kind}-${row.id}`}
        isLoading={review.isPending}
        isRefreshing={isRefetching(review)}
        empty={
          <EmptyState
            icon="check"
            data-testid="purchase-review-empty"
            title="inventory.review.empty"
          />
        }
      />
    </div>
  );
}
