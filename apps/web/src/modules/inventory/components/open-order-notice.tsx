import { LOOKUP_LIST, type OpenOrderLine } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, Icon, usePersonName } from "@clinic/ui";
import { useLookupLabels } from "@web/shared/queries/lookups";

export function OpenOrderNotice({
  orders,
  onReceive,
}: {
  readonly orders: readonly OpenOrderLine[];
  readonly onReceive: ((requestId: string) => void) | undefined;
}): JSX.Element | null {
  const { t } = useTranslation();
  const nameOf = usePersonName();
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);

  if (orders.length === 0) {
    return null;
  }

  return (
    <ul
      data-testid="purchase-line-open-orders"
      role="status"
      className="mt-2 flex flex-col gap-1 text-label text-warning-800"
    >
      {orders.map((order) => (
        <li
          key={order.requestId}
          data-testid="purchase-line-open-order"
          data-request={order.requestId}
          className="flex flex-wrap items-center gap-x-2 gap-y-1"
        >
          <span className="flex min-w-0 items-start gap-1.5">
            <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0">
              {t("inventory.purchase.alreadyOrdered", {
                who: nameOf(order.createdByName) || t("inventory.purchase.someone"),
                number: order.number,
                status: t(`inventory.requests.status.${order.status}`),
                quantity: String(Number(order.quantity)),
                open: String(Number(order.open)),
                unit: unitLabel(order.unit),
              })}
            </span>
          </span>
          {onReceive && (
            <Button
              size="sm"
              variant="ghost"
              data-testid="purchase-line-receive-order"
              onClick={() => onReceive(order.requestId)}
            >
              {t("inventory.purchase.receiveAgainst", { number: order.number })}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
