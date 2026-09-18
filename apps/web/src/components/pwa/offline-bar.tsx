import { Icon } from "@clinic/ui";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";

/** Nothing is cached but the shell, so offline means the screen cannot answer — say so once, in
 *  one place, rather than letting every panel fail on its own. */
export function OfflineBar(): JSX.Element | null {
  const { t } = useTranslation();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = (): void => setOffline(!navigator.onLine);

    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);

    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) {
    return null;
  }

  return (
    <div
      role="status"
      data-testid="offline-bar"
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-2 bg-warning-100 px-4 py-2 text-label text-warning-800"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <Icon name="alert" />
      {t("pwa.offline")}
    </div>
  );
}
