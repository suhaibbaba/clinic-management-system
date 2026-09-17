import { Button, Icon } from "@clinic/ui";
import { useSyncExternalStore, type JSX } from "react";
import { useTranslation } from "react-i18next";

import { applyUpdate, subscribeToUpdate, updateWaiting } from "@web/lib/service-worker";
import { useInstallPrompt } from "@web/lib/use-install-prompt";

/** Beside the version, because "which build am I on" and "put this on the home screen" are one
 *  question asked twice. */
export function InstallCard(): JSX.Element | null {
  const { t } = useTranslation();
  const { state, install } = useInstallPrompt();
  const waiting = useSyncExternalStore(subscribeToUpdate, updateWaiting, () => false);

  if (state === "unavailable" && !waiting) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-col items-start gap-2 border-t border-line pt-4">
      {state === "available" && (
        <>
          <p className="text-label text-ink-muted">{t("pwa.installHint")}</p>
          <Button icon={<Icon name="plus" />} variant="secondary" size="sm" onClick={install}>
            {t("pwa.install")}
          </Button>
        </>
      )}

      {/* Safari has no install event at all, so the only thing to offer is the recipe. */}
      {state === "manual" && <p className="text-label text-ink-muted">{t("pwa.installIos")}</p>}

      {state === "installed" && <p className="text-label text-ink-muted">{t("pwa.installed")}</p>}

      {waiting && (
        <Button
          icon={<Icon name="reset" />}
          variant="secondary"
          size="sm"
          onClick={() => void applyUpdate()}
        >
          {t("pwa.update")}
        </Button>
      )}
    </div>
  );
}
