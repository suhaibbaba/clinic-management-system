import { Children, useRef, useState, type ComponentProps, type JSX, type ReactNode } from "react";
import { cx } from "@web/booking/ui";
import { SiteIcon } from "@web/site/components/site-icon";
import {
  PORTAL_GRID_PAGE_SIZE,
  PORTAL_PAGE_SIZE,
  PORTAL_TILE_PAGE_SIZE,
} from "@web/site/constants";
import { useMeasuredHeight } from "@web/site/hooks/use-measured-height";
import { useSite } from "@web/site/hooks/use-site";
import { revealedCount } from "@web/site/lib/portal";

export function PortalPanel({
  title,
  empty,
  icon,
  action,
  paged = false,
  grid,
  children,
  "data-testid": testId,
}: {
  readonly title: string;
  readonly empty: string;
  readonly icon?: ComponentProps<typeof SiteIcon>["name"];
  readonly action?: ReactNode;
  readonly paged?: boolean;
  readonly grid?: "cards" | "tiles";
  readonly children: ReactNode;
  readonly "data-testid": string;
}): JSX.Element {
  const { t } = useSite();
  const items = Children.toArray(children);
  const pageSize =
    grid === "tiles" ? PORTAL_TILE_PAGE_SIZE : grid ? PORTAL_GRID_PAGE_SIZE : PORTAL_PAGE_SIZE;
  const [shown, setShown] = useState(pageSize);
  const revealed = paged ? revealedCount(shown, items.length) : items.length;
  const visible = items.slice(0, revealed);
  const hidden = items.length - revealed;
  const next = revealedCount(revealed + pageSize, items.length) - revealed;
  const collapsible = paged && hidden === 0 && items.length > revealedCount(pageSize, items.length);
  const list = useRef<HTMLUListElement>(null);
  const height = useMeasuredHeight(list);

  return (
    <section
      data-testid={testId}
      className="flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card"
    >
      <div
        data-part="head"
        className="flex items-center justify-between gap-3 border-b border-line px-5 py-4"
      >
        <h3 className="flex items-center gap-2 text-heading font-bold text-primary-900">
          {icon && <SiteIcon name={icon} className="size-5 text-primary-600" />}
          {title}
          {paged && items.length > 0 && (
            <span className="pill-text inline-flex min-h-(--control-h-sm) items-center rounded-pill bg-canvas px-2.5 text-meta font-medium text-ink-muted">
              {items.length}
            </span>
          )}
        </h3>
        {action}
      </div>
      {items.length > 0 ? (
        <div
          data-part="list"
          style={paged && height !== undefined ? { height } : undefined}
          className="overflow-hidden transition-[height] duration-300 ease-out motion-reduce:transition-none"
        >
          <ul
            ref={list}
            className={cx(
              "[&>li]:transition-[opacity,translate] [&>li]:duration-300 [&>li]:ease-out motion-reduce:[&>li]:transition-none [&>li]:starting:translate-y-1 [&>li]:starting:opacity-0",
              grid === "tiles"
                ? "grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-4"
                : grid
                  ? "grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3"
                  : "flex flex-col divide-y divide-line [&>li]:px-5",
            )}
          >
            {visible}
          </ul>
        </div>
      ) : (
        <p className="px-5 py-6 text-value text-ink-muted">{empty}</p>
      )}
      {(hidden > 0 || collapsible) && (
        <button
          type="button"
          data-part="more"
          onClick={() => setShown(hidden > 0 ? revealed + pageSize : pageSize)}
          className="flex min-h-(--control-h) cursor-pointer items-center justify-center gap-1.5 border-t border-line text-label font-medium text-primary-700 hover:bg-primary-50"
        >
          {hidden > 0 ? t("portal.showMore", { count: next }) : t("portal.showLess")}
          <SiteIcon
            name="chevron-down"
            className={cx("size-4 transition-transform duration-300", hidden === 0 && "rotate-180")}
          />
        </button>
      )}
    </section>
  );
}
