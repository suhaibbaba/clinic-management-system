import type { PortalRecord } from "@clinic/shared";
import type { JSX } from "react";
import { cx } from "@web/booking/ui";
import { PortalPanel } from "@web/site/components/portal/portal-panel";
import type { PortalFormat } from "@web/site/hooks/use-portal-format";
import { useSite } from "@web/site/hooks/use-site";

export function PortalBalance({
  balance,
  format,
}: {
  readonly balance: PortalRecord["balance"];
  readonly format: PortalFormat;
}): JSX.Element {
  const { t } = useSite();
  const owes = !balance.balance.startsWith("-") && balance.balance !== "0.00";
  const tiles = [
    { key: "charged", value: balance.charged },
    { key: "paid", value: balance.paid },
    { key: "balance", value: balance.balance },
  ] as const;

  return (
    <ul data-testid="site-portal-balance" className="grid grid-cols-3 gap-2 sm:gap-3">
      {tiles.map((tile) => (
        <li
          key={tile.key}
          className={cx(
            "flex min-w-0 flex-col gap-1 rounded-card border p-3 shadow-card sm:p-4",
            tile.key === "balance" && owes
              ? "border-warning-300 bg-warning-50"
              : "border-line bg-surface",
          )}
        >
          <span className="text-label text-ink-muted">{t(`portal.money.${tile.key}`)}</span>
          <bdi
            data-testid={`site-portal-balance-${tile.key}`}
            className="text-heading font-bold text-primary-900 sm:text-title"
          >
            {format.money(tile.value)}
          </bdi>
        </li>
      ))}
    </ul>
  );
}

export function PortalStatement({
  statement,
  format,
}: {
  readonly statement: PortalRecord["statement"];
  readonly format: PortalFormat;
}): JSX.Element {
  const { t } = useSite();

  return (
    <PortalPanel
      title={t("portal.statement")}
      empty={t("portal.empty.statement")}
      data-testid="site-portal-statement"
    >
      {statement.map((entry) => (
        <li
          key={entry.id}
          data-testid={`site-portal-statement-${entry.id}`}
          className="flex items-center gap-3 py-3"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span
              className={cx(
                "text-value font-bold text-primary-900",
                entry.isReversed && "line-through opacity-60",
              )}
            >
              {entry.description || t(`portal.entry.${entry.kind}`)}
              {entry.receiptNumber !== null &&
                ` · ${t("portal.receipt", { number: entry.receiptNumber })}`}
            </span>
            <span className="text-label text-ink-muted">
              {format.date(entry.occurredAt)}
              {entry.isReversal && ` · ${t("portal.reversal")}`}
            </span>
          </span>
          <span className="flex flex-col items-end">
            <bdi
              className={cx(
                "text-value font-bold",
                entry.amount.startsWith("-") ? "text-success-800" : "text-primary-900",
              )}
            >
              {format.money(entry.amount)}
            </bdi>
            <bdi className="text-meta text-ink-muted">
              {t("portal.runningBalance", { amount: format.money(entry.runningBalance) })}
            </bdi>
          </span>
        </li>
      ))}
    </PortalPanel>
  );
}
