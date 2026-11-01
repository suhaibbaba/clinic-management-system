import type { SubscriptionStatus } from "@clinic/shared";
import { Badge } from "@clinic/ui/components/badge";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { statusTone } from "@web/vendor/lib/subscription";

export function StatusBadge({
  status,
}: {
  readonly status: SubscriptionStatus | null;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <Badge tone={statusTone(status)} data-testid="vendor-status">
      {status === null ? t("vendor.clinics.noSubscription") : t(`vendor.status.${status}`)}
    </Badge>
  );
}
