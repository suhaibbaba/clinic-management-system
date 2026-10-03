import { useEffect, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useBlocker } from "react-router-dom";
import { ConfirmDialog } from "@clinic/ui";

export function useLeaveGuard(
  dirty: boolean,
  testId = "leave-unsaved",
  watchParams: readonly string[] = [],
): JSX.Element {
  const { t } = useTranslation();
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (!dirty) {
      return false;
    }

    const before = new URLSearchParams(currentLocation.search);
    const after = new URLSearchParams(nextLocation.search);

    return (
      currentLocation.pathname !== nextLocation.pathname ||
      watchParams.some((param) => before.get(param) !== after.get(param))
    );
  });

  useEffect(() => {
    if (!dirty) {
      return;
    }

    const warn = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };

    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <ConfirmDialog
      data-testid={testId}
      open={blocker.state === "blocked"}
      onOpenChange={(open) => {
        if (!open && blocker.state === "blocked") {
          blocker.reset();
        }
      }}
      title="common.leaveUnsavedTitle"
      consequences={[t("common.leaveUnsavedBody")]}
      confirmLabel="common.leave"
      tone="primary"
      onConfirm={async () => {
        if (blocker.state === "blocked") {
          blocker.proceed();
        }
      }}
    />
  );
}
