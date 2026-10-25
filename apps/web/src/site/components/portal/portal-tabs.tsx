import { useRef, type ComponentProps, type JSX, type KeyboardEvent } from "react";
import { cx } from "@web/booking/ui";
import { SiteIcon } from "@web/site/components/site-icon";
import { PORTAL_TABS } from "@web/site/constants";
import { useSegmentThumb } from "@web/site/hooks/use-segment-thumb";
import { useSite } from "@web/site/hooks/use-site";
import type { PortalTab } from "@web/site/lib/portal";

const TAB_ICONS: Record<PortalTab, ComponentProps<typeof SiteIcon>["name"]> = {
  overview: "dashboard",
  appointments: "calendar-clock",
  treatments: "tooth",
  billing: "wallet",
  prescriptions: "pill",
  files: "files",
};

export function PortalTabs({
  active,
  onSelect,
}: {
  readonly active: PortalTab;
  readonly onSelect: (tab: PortalTab) => void;
}): JSX.Element {
  const { language, t } = useSite();
  const track = useRef<HTMLDivElement>(null);
  const thumb = useSegmentThumb(track, '[role="tab"][aria-selected="true"]', active);

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
      ref={track}
      role="tablist"
      aria-label={t("portal.sections")}
      data-testid="site-portal-tabs"
      onKeyDown={onKeyDown}
      className="relative isolate flex gap-1 overflow-x-auto rounded-pill border border-line bg-surface p-1 shadow-card [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <span
        aria-hidden
        data-part="thumb"
        style={thumb.style}
        className={cx(
          "pointer-events-none absolute top-0 left-0 rounded-pill bg-primary-600 shadow-nav-active",
          thumb.animate
            ? "transition-[transform,width] duration-300 ease-out motion-reduce:transition-none"
            : "transition-none",
          !thumb.style && "hidden",
        )}
      />
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
            className="pill-text relative z-10 inline-flex min-h-(--control-h) shrink-0 cursor-pointer items-center gap-2 rounded-pill px-4 text-label font-medium whitespace-nowrap text-ink-muted transition-colors duration-200 not-aria-selected:hover:bg-success-50 not-aria-selected:hover:text-success-800 aria-selected:text-ink-inverse motion-reduce:transition-none"
          >
            <SiteIcon name={TAB_ICONS[tab]} className="size-4" />
            {t(`portal.tabs.${tab}`)}
          </button>
        );
      })}
    </div>
  );
}
