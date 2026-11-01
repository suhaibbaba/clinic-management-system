import { localized, SUBSCRIPTION_STATUS, type VendorClinicSummary } from "@clinic/shared";
import { useConfirm } from "@clinic/ui/components/confirm-dialog";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { extendedByAMonth, suspended } from "@web/vendor/lib/clinic-actions";
import { useRemoveClinic, useRestoreClinic, useSaveSubscriptionFor } from "@web/vendor/queries";

export interface ClinicActions {
  readonly extend: (() => void) | null;
  readonly suspend: (() => void) | null;
  readonly remove: () => void;
  readonly restore: () => void;
}

export function useClinicActions(onRemoved?: () => void): {
  readonly actionsFor: (clinic: VendorClinicSummary) => ClinicActions;
  readonly dialog: JSX.Element;
} {
  const { t, i18n } = useTranslation();
  const { confirm, dialog } = useConfirm("vendor-confirm");
  const save = useSaveSubscriptionFor();
  const remove = useRemoveClinic();
  const restore = useRestoreClinic();

  const actionsFor = (clinic: VendorClinicSummary): ClinicActions => {
    const subscription = clinic.subscription;
    const name = localized(clinic.name, i18n.language);

    return {
      extend: subscription
        ? () => save.mutate({ clinicId: clinic.id, input: extendedByAMonth(subscription) })
        : null,
      suspend:
        subscription && subscription.status !== SUBSCRIPTION_STATUS.SUSPENDED
          ? () =>
              confirm({
                title: "vendor.actions.suspendTitle",
                titleValues: { name },
                tone: "danger",
                confirmLabel: "vendor.actions.suspend",
                consequences: [t("vendor.actions.suspendBody")],
                onConfirm: () =>
                  save.mutateAsync({ clinicId: clinic.id, input: suspended(subscription) }),
              })
          : null,
      remove: () =>
        confirm({
          title: "vendor.remove.title",
          titleValues: { name },
          tone: "danger",
          confirmLabel: "vendor.remove.confirm",
          consequences: [
            t("vendor.remove.signsOut", { count: clinic.users }),
            t("vendor.remove.stopsSite"),
            t("vendor.remove.keepsData"),
          ],
          onConfirm: async () => {
            await remove.mutateAsync(clinic.id);
            onRemoved?.();
          },
        }),
      restore: () => restore.mutate(clinic.id),
    };
  };

  return { actionsFor, dialog };
}
