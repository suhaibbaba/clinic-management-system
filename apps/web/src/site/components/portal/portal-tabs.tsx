import type { JSX, KeyboardEvent } from "react";
import { cx } from "@web/booking/ui";
import { PORTAL_TABS } from "@web/site/constants";
import { useSite } from "@web/site/hooks/use-site";
import type { PortalTab } from "@web/site/lib/portal";

export function PortalTabs({
  active,
  onSelect,
}: {
  readonly active: PortalTab;
  readonly onSelect: (tab: PortalTab) => void;
}): JSX.Element {
  const { language, t } = useSite();

  const focusTab = (tab: PortalTab): void => {
    onSelect(tab);
    requestAnimationFrame(() => document.getElementById(`portal-tab-${tab}`)?.focus());
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const index = PORTAL_TABS.indexOf(active);
    const forward = language === "ar" ? "ArrowLeft" : "ArrowRight";
    const backward = language === "ar" ? "ArrowRight" : "ArrowLeft";
    const last = PORTAL_TABS.length - 1;
    const target =
      event.key === forward
        ? (index + 1) % PORTAL_TABS.length
        : event.key === backward
          ? (index + last) % PORTAL_TABS.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : undefined;

    if (target !== undefined) {
      event.preventDefault();
      focusTab(PORTAL_TABS[target] ?? active);
    }
  };

  return (
    <div
      role="tablist"
      aria-label={t("portal.sections")}
      data-testid="site-portal-tabs"
      onKeyDown={onKeyDown}
      className="flex gap-1 overflow-x-auto rounded-pill border border-line bg-surface p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {PORTAL_TABS.map((tab) => {
        const selected = tab === active;

        return (
          <button
            key={tab}
            id={`portal-tab-${tab}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls="portal-panel"
            tabIndex={selected ? 0 : -1}
            data-testid={`site-portal-tab-${tab}`}
            onClick={() => onSelect(tab)}
            className={cx(
              "pill-text inline-flex min-h-(--control-h-sm) shrink-0 cursor-pointer items-center rounded-pill px-4 text-label font-medium whitespace-nowrap",
              selected
                ? "bg-primary-900 text-ink-inverse"
                : "text-ink-muted hover:bg-primary-50 hover:text-primary-800",
            )}
          >
            {t(`portal.tabs.${tab}`)}
          </button>
        );
      })}
    </div>
  );
}
