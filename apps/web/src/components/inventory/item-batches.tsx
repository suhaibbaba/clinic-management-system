import type { ItemBatch } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Badge, type Column, EmptyState, Ltr, Table } from "@clinic/ui";
import { UNBATCHED_ROW_KEY } from "@web/constants/inventory";
import { shelfRows, type ShelfRow } from "@web/lib/inventory/batches";
import { formatDate } from "@web/lib/format";

export function ItemBatches({
  batches,
  unbatched,
  unit,
  isLoading,
}: {
  readonly batches: readonly ItemBatch[];
  readonly unbatched: string;
  readonly unit: string;
  readonly isLoading: boolean;
}): JSX.Element {
  const { t } = useTranslation();

  const rows = shelfRows(batches, unbatched);

  const columns: readonly Column<ShelfRow>[] = [
    {
      key: "batch",
      header: "inventory.batches.columns.batch",
      primary: true,
      render: (row) =>
        row.batchNo ? (
          <Ltr className="font-medium text-ink">{row.batchNo}</Ltr>
        ) : (
          <span className="text-ink-muted">
            {t(
              row.key === UNBATCHED_ROW_KEY
                ? "inventory.batches.unbatched"
                : "inventory.batches.unlabelled",
            )}
          </span>
        ),
    },
    {
      key: "expiry",
      header: "inventory.batches.columns.expiry",
      render: (row) =>
        row.expiryDate ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <Ltr className={row.isExpired ? "text-danger-600" : undefined}>
              {formatDate(row.expiryDate)}
            </Ltr>
            {row.isExpired && <Badge tone="danger">{t("inventory.flags.expired")}</Badge>}
            {row.isExpiring && <Badge tone="warning">{t("inventory.flags.expiring")}</Badge>}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "received",
      header: "inventory.batches.columns.received",
      hideOnMobile: true,
      render: (row) => (row.receivedAt ? <Ltr>{formatDate(row.receivedAt)}</Ltr> : "—"),
    },
    {
      key: "left",
      header: "inventory.batches.columns.left",
      render: (row) => (
        <span className="flex flex-wrap items-baseline gap-x-1.5">
          <Ltr className="font-medium tabular-nums text-ink">{row.remaining}</Ltr>
          <span className="text-ink-muted">{unit}</span>
          {row.quantity !== null && (
            <span className="text-label text-ink-subtle">
              {t("inventory.batches.of", { quantity: row.quantity })}
            </span>
          )}
        </span>
      ),
    },
  ];

  return (
    <section data-testid="item-batches" className="flex flex-col gap-3">
      <div>
        <h2 className="text-value font-medium text-ink">{t("inventory.batches.title")}</h2>
        <p className="text-label text-ink-muted">{t("inventory.batches.hint")}</p>
      </div>

      <Table
        data-testid="item-batches-table"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.key}
        isLoading={isLoading}
        empty={
          <EmptyState
            icon="package"
            data-testid="item-batches-empty"
            title="inventory.batches.empty"
          />
        }
      />

      {rows.length > 0 && (
        <p className="text-label text-ink-subtle">{t("inventory.batches.assumption")}</p>
      )}
    </section>
  );
}
