import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@ui/components/button";
import { Icon } from "@ui/components/icon";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface SaveBarProps extends TestIdProps {
  readonly visible: boolean;
  readonly saving?: boolean | undefined;
  readonly invalid?: boolean | undefined;
  readonly onSave: () => void;
  readonly onDiscard: () => void;
}

export function SaveBar({
  visible,
  saving = false,
  invalid = false,
  onSave,
  onDiscard,
  "data-testid": testId,
}: SaveBarProps): JSX.Element {
  const { t } = useTranslation();
  const part = parts("save-bar", testId);

  return (
    <>
      {visible && <div {...part("spacer")} aria-hidden="true" className="h-24 md:hidden" />}
      <div
        {...part()}
        role="region"
        aria-label={t("common.unsavedChanges")}
        data-state={visible ? "open" : "closed"}
        inert={!visible}
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center md:hidden",
          "px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        )}
      >
        <div
          {...part("glass")}
          className={cn(
            "pointer-events-auto flex w-full max-w-(--form-max) items-center gap-2 rounded-pill p-1.5 ps-4",
            "border border-surface/70 bg-surface/90 shadow-glass",
            "supports-[backdrop-filter]:bg-surface/60",
            "supports-[backdrop-filter]:backdrop-blur-xl supports-[backdrop-filter]:backdrop-saturate-150",
            "transition-[translate,opacity,scale] duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
            visible
              ? "translate-y-0 scale-100 opacity-100"
              : "translate-y-[calc(100%+1.5rem)] scale-95 opacity-0",
          )}
        >
          <p {...part("message")} className="flex min-w-0 flex-1 items-center gap-2.5 text-label">
            <span aria-hidden="true" className="relative flex size-2 shrink-0">
              <span className="absolute inset-0 rounded-pill bg-warning-500 opacity-60 motion-safe:animate-ping" />
              <span className="relative size-2 rounded-pill bg-warning-500" />
            </span>
            <span className="truncate font-medium text-ink">{t("common.unsavedChanges")}</span>
          </p>
          <Button {...part("discard")} variant="quiet" className="rounded-pill" onClick={onDiscard}>
            {t("common.discard")}
          </Button>
          <Button
            {...part("save")}
            icon={<Icon name="check" />}
            className="rounded-pill px-4"
            isLoading={saving}
            {...(invalid && { "aria-disabled": true })}
            onClick={onSave}
          >
            {t("common.save")}
          </Button>
        </div>
      </div>
    </>
  );
}
