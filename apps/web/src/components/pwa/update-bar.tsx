import { Icon } from "@clinic/ui";
import { useSyncExternalStore, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { isUpdating, subscribeUpdating } from "@web/lib/service-worker";

/** The page reloads itself once a newer build takes over; this says why before it happens. */
export function UpdateBar(): JSX.Element | null {
  const { t } = useTranslation();
  const updating = useSyncExternalStore(subscribeUpdating, isUpdating, () => false);

  if (!updating) {
    return null;
  }

  return (
    <div
      role="status"
      data-testid="update-bar"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-primary-100 px-4 py-2 text-label text-primary-700"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
    >
      <Icon name="spinner" className="animate-spin" />
      {t("pwa.updating")}
    </div>
  );
}
