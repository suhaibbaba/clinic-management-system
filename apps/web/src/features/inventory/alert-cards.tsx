import type { InventoryItemRow } from '@clinic/shared';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, Card, Icon, Ltr } from '@web/components/ui';
import { useSession } from '@web/features/auth/session';
import { seesInventory } from '@web/features/inventory/permissions';
import { useInventoryAlerts } from '@web/features/inventory/queries';
import { cn } from '@web/lib/cn';
import { formatDate } from '@web/lib/format';

// A card with nothing in it is not drawn: an alert panel that says "0 items low" every day is one
// people stop reading.
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
    // Side by side only once there is room: at 768px each card had about 60px for an item's name
    // and ellipsed every one to three letters.
    <div className="grid gap-3 lg:grid-cols-2">
      {low.length > 0 && (
        <AlertCard
          tone="danger"
          icon="alert"
          title={t('inventory.alerts.low', { count: low.length })}
          hint={t('inventory.alerts.lowHint')}
          items={low}
          onShowAll={onShowLow}
          onSelectItem={onSelectItem}
          describe={(item) => `${item.quantity} / ${item.minQuantity}`}
        />
      )}

      {going.length > 0 && (
        <AlertCard
          tone="warning"
          icon="clock"
          title={t('inventory.alerts.expiring', { count: going.length })}
          hint={t('inventory.alerts.expiringHint', { days: alerts.data.expiryWarningDays })}
          items={going}
          onShowAll={onShowExpiring}
          onSelectItem={onSelectItem}
          describe={(item) => (item.nearestExpiry ? formatDate(item.nearestExpiry) : '')}
        />
      )}
    </div>
  );
}

function AlertCard({
  tone,
  icon,
  title,
  hint,
  items,
  describe,
  onShowAll,
  onSelectItem,
}: {
  readonly tone: 'danger' | 'warning';
  readonly icon: 'alert' | 'clock';
  readonly title: string;
  readonly hint: string;
  readonly items: readonly InventoryItemRow[];
  readonly describe: (item: InventoryItemRow) => string;
  readonly onShowAll: () => void;
  readonly onSelectItem: (id: string) => void;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-panel',
            tone === 'danger' ? 'bg-danger-50 text-danger-600' : 'bg-warning-50 text-warning-700',
          )}
        >
          <Icon name={icon} className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-value font-semibold text-ink">{title}</p>
          <p className="text-label text-ink-muted">{hint}</p>

          {/* The first three by name — enough to recognise the problem without
              turning an alert into a second copy of the table below it. */}
          <ul className="mt-2 flex flex-col gap-1">
            {items.slice(0, 3).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelectItem(item.id)}
                  className="flex min-h-11 w-full cursor-pointer items-baseline justify-between gap-2 rounded-control px-1 py-0.5 text-start transition-colors duration-150 hover:bg-row-hover lg:min-h-0"
                >
                  <span className="truncate text-label text-ink">{item.nameAr}</span>
                  <Ltr className="shrink-0 text-label tabular-nums text-ink-muted">
                    {describe(item)}
                  </Ltr>
                </button>
              </li>
            ))}
          </ul>

          {items.length > 3 && (
            <button
              type="button"
              onClick={onShowAll}
              className="mt-2 cursor-pointer text-label font-medium text-primary-700 hover:underline"
            >
              {t('inventory.alerts.showAll', { count: items.length })}
            </button>
          )}
        </div>

        <Badge tone={tone}>{items.length}</Badge>
      </div>
    </Card>
  );
}
