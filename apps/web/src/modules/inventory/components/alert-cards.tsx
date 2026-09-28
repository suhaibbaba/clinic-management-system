import type { InventoryItemRow } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, Icon, Ltr, Modal } from "@clinic/ui";
import { useSession } from "@web/shared/providers/session";
import { seesInventory } from "@web/shared/permissions/inventory";
import { useInventoryAlerts } from "@web/modules/inventory/queries";
import { cn } from "@clinic/ui/lib/cn";
import { formatDate } from "@web/shared/lib/format";
import { ALERT_PREVIEW_COUNT } from "@web/modules/inventory/constants";

export function InventoryAlertCards({
  onSelectItem,
  onShowLow,
  onShowExpiring,
}: {
  readonly onSelectItem: (id: string) => void;
  readonly onShowLow: () => void;
  readonly onShowExpiring: () => void;
}): JSX.Element | null {
  const { t } = useTranslation();
  const { user } = useSession();
  const alerts = useInventoryAlerts(seesInventory(user?.role));

  if (!alerts.data) {
    return null;
  }

  const { low, expiring, expired } = alerts.data;
  const going = [...expired, ...expiring];

  if (low.length === 0 && going.length === 0) {
    return null;
  }

  return (
    <div data-testid="inventory-alerts" className="grid gap-3 lg:grid-cols-2">
      {low.length > 0 && (
        <AlertCard
          data-testid="inventory-alert-low"
          tone="danger"
          icon="alert"
          titleKey="inventory.alerts.low"
          hint={t("inventory.alerts.lowHint")}
          items={low}
          onShowAll={onShowLow}
          onSelectItem={onSelectItem}
          describe={(item) => `${item.quantity} / ${item.minQuantity}`}
        />
      )}

      {going.length > 0 && (
        <AlertCard
          data-testid="inventory-alert-expiring"
          tone="warning"
          icon="clock"
          titleKey="inventory.alerts.expiring"
          hint={t("inventory.alerts.expiringHint", { days: alerts.data.expiryWarningDays })}
          items={going}
          onShowAll={onShowExpiring}
          onSelectItem={onSelectItem}
          describe={(item) => (item.nearestExpiry ? formatDate(item.nearestExpiry) : "")}
        />
      )}
    </div>
  );
}

function AlertCard({
  tone,
  icon,
  titleKey,
  hint,
  items,
  describe,
  onShowAll,
  onSelectItem,
  "data-testid": testId,
}: {
  readonly "data-testid": string;
  readonly tone: "danger" | "warning";
  readonly icon: "alert" | "clock";
  readonly titleKey: string;
  readonly hint: string;
  readonly items: readonly InventoryItemRow[];
  readonly describe: (item: InventoryItemRow) => string;
  readonly onShowAll: () => void;
  readonly onSelectItem: (id: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const row = (item: InventoryItemRow, onClick: () => void): JSX.Element => (
    <li key={item.id}>
      <button
        type="button"
        data-testid={`${testId}-item-${item.id}`}
        onClick={onClick}
        className="flex min-h-(--control-h) w-full cursor-pointer items-baseline justify-between gap-2 rounded-control px-1 py-0.5 text-start transition-colors duration-150 hover:bg-row-hover lg:min-h-(--control-h-sm)"
      >
        <span className="truncate text-label text-ink">
          <bdi>{item.name}</bdi>
        </span>
        <Ltr className="shrink-0 text-label tabular-nums text-ink-muted">{describe(item)}</Ltr>
      </button>
    </li>
  );

  return (
    <Card data-testid={testId}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-panel",
            tone === "danger" ? "bg-danger-50 text-danger-600" : "bg-warning-50 text-warning-700",
          )}
        >
          <Icon name={icon} className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-value font-medium text-ink">{t(titleKey, { count: items.length })}</p>
          <p className="text-label text-ink-muted">{hint}</p>
          <ul className="mt-2 flex flex-col gap-1">
            {items
              .slice(0, ALERT_PREVIEW_COUNT)
              .map((item) => row(item, () => onSelectItem(item.id)))}
          </ul>

          {items.length > ALERT_PREVIEW_COUNT && (
            <button
              type="button"
              data-testid={`${testId}-show-more`}
              onClick={() => setExpanded(true)}
              className="mt-2 cursor-pointer text-label font-medium text-primary-700 hover:underline"
            >
              {t("inventory.alerts.showMore", { count: items.length })}
            </button>
          )}
        </div>

        <Badge tone={tone} data-testid={`${testId}-count`}>
          {items.length}
        </Badge>
      </div>

      <Modal
        data-testid={`${testId}-modal`}
        open={expanded}
        onOpenChange={setExpanded}
        title={titleKey}
        titleValues={{ count: items.length }}
        footer={
          <>
            <Button
              variant="secondary"
              data-testid={`${testId}-modal-close`}
              onClick={() => setExpanded(false)}
            >
              {t("common.close")}
            </Button>
            <Button
              data-testid={`${testId}-modal-filter`}
              onClick={() => {
                setExpanded(false);
                onShowAll();
              }}
            >
              {t("inventory.alerts.showInTable")}
            </Button>
          </>
        }
      >
        <p className="text-label text-ink-muted">{hint}</p>
        <ul className="mt-3 flex flex-col gap-1">
          {items.map((item) =>
            row(item, () => {
              setExpanded(false);
              onSelectItem(item.id);
            }),
          )}
        </ul>
      </Modal>
    </Card>
  );
}
