import { WAITING_LIST_SOURCE } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { Icon, Menu, MenuContent, MenuItem, MenuTrigger, type IconName } from "@clinic/ui";
import { useWaitingList } from "@web/features/appointments/queries";
import { useSession } from "@web/features/auth/session";
import { canSeeBilling } from "@web/features/billing/permissions";
import { usePendingBookingsCount, seesPendingBookings } from "@web/features/booking/queries";
import { useInventoryAlerts } from "@web/features/inventory/queries";
import { useLabOrders } from "@web/features/labs/queries";
import { usePatients } from "@web/features/patients/queries";
import { cn } from "@clinic/ui/lib/cn";

interface Waiting {
  readonly key: string;
  readonly icon: IconName;
  readonly count: number;
  readonly to: string;
}

/**
 * What is waiting, drawn from the counts the screens behind it already ask for. Every line is
 * gated by the permission that opens the screen it leads to, so nobody is told about a room they
 * cannot enter.
 */
export function NotificationBell(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, can } = useSession();

  const frontDesk = seesPendingBookings(can);
  const pending = usePendingBookingsCount(frontDesk);

  const mayQueue = can("waiting-list.list");
  const urgent = useWaitingList({ limit: 1, source: WAITING_LIST_SOURCE.ONLINE }, mayQueue);

  const mayLabs = can("lab-orders.list");
  const overdueLabs = useLabOrders({ limit: 1, overdue: true }, mayLabs);

  const mayStock = can("inventory.alerts");
  const alerts = useInventoryAlerts(mayStock);

  const seesMoney = user !== null && canSeeBilling(user.role);
  const owing = usePatients({ page: 1, limit: 1, hasBalance: true }, { enabled: seesMoney });

  const stock = alerts.data
    ? alerts.data.low.length + alerts.data.expiring.length + alerts.data.expired.length
    : 0;

  const waiting: Waiting[] = (
    [
      {
        key: "pendingBookings",
        icon: "globe",
        count: frontDesk ? pending : 0,
        to: "/appointments?status=pending",
      },
      {
        key: "urgentRequests",
        icon: "alert",
        count: mayQueue ? (urgent.data?.total ?? 0) : 0,
        to: "/appointments",
      },
      {
        key: "overdueLabs",
        icon: "clipboard",
        count: mayLabs ? (overdueLabs.data?.total ?? 0) : 0,
        to: "/labs?tab=orders",
      },
      { key: "inventoryAlerts", icon: "package", count: mayStock ? stock : 0, to: "/inventory" },
      {
        key: "overdueBalances",
        icon: "money",
        count: seesMoney ? (owing.data?.total ?? 0) : 0,
        to: "/patients?filter=balance",
      },
    ] satisfies Waiting[]
  ).filter((entry) => entry.count > 0);

  const total = waiting.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <Menu>
      <MenuTrigger
        data-testid="notification-bell"
        aria-label={
          total > 0 ? t("nav.notifications", { count: total }) : t("nav.notificationsEmpty")
        }
        className={cn(
          "relative inline-flex size-(--control-h) cursor-pointer items-center justify-center lg:size-(--control-h-sm)",
          "rounded-control border border-line bg-surface text-ink-muted",
          "transition-colors duration-[250ms] ease-in-out hover:bg-primary-100 hover:text-primary-700",
          "data-[state=open]:border-primary-600 data-[state=open]:text-primary-700",
        )}
      >
        <Icon name="bell" />

        {total > 0 && (
          <span
            data-part="notification-count"
            data-testid="notification-count"
            aria-hidden="true"
            className={cn(
              "absolute -top-1 -end-1 inline-flex min-w-4 items-center justify-center rounded-pill",
              "bg-danger-600 px-1 text-[11px] font-medium text-ink-inverse tabular-nums",
            )}
          >
            {total}
          </span>
        )}
      </MenuTrigger>

      <MenuContent data-testid="notification-menu" className="min-w-72">
        {waiting.length === 0 ? (
          <p data-testid="notification-empty" className="px-3 py-2 text-label text-ink-muted">
            {t("nav.notificationsEmpty")}
          </p>
        ) : (
          waiting.map((entry) => (
            <MenuItem
              key={entry.key}
              data-testid={`notification-${entry.key}`}
              icon={entry.icon}
              onSelect={() => void navigate(entry.to)}
              trailing={
                <span className="text-label tabular-nums text-ink-muted">{entry.count}</span>
              }
            >
              {t(`notifications.${entry.key}`)}
            </MenuItem>
          ))
        )}
      </MenuContent>
    </Menu>
  );
}
