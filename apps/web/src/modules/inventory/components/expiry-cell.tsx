import type { InventoryItemRow } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Ltr } from "@clinic/ui";
import { formatDate } from "@web/shared/lib/format";

export function ExpiryCell({ item }: { readonly item: InventoryItemRow }): JSX.Element | string {
  const { t } = useTranslation();

  if (!item.nearestExpiry) {
    return "—";
  }

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Ltr className={item.isExpired ? "text-danger-600" : undefined}>
        {formatDate(item.nearestExpiry)}
      </Ltr>
      {item.isExpired && (
        <Badge tone="danger" data-testid="inventory-flag-expired">
          {t("inventory.flags.expired")}
        </Badge>
      )}
      {item.isExpiring && (
        <Badge tone="warning" data-testid="inventory-flag-expiring">
          {t("inventory.flags.expiring")}
        </Badge>
      )}
    </span>
  );
}
