import {
  DASHBOARD_ZONE,
  dashboardRowSpans,
  type DashboardLayout,
  type DashboardWidgetPlacement,
} from "@clinic/shared";
import type { JSX, ReactNode } from "react";
import { cn } from "@clinic/ui/lib/cn";
import { shownIn } from "@web/modules/dashboard/lib/layout-edits";
import { DASHBOARD_SPAN_CLASS } from "@web/modules/dashboard/constants";

export interface DashboardZonesProps {
  readonly layout: DashboardLayout;
  readonly present?: ((widget: DashboardWidgetPlacement) => boolean) | undefined;
  readonly render: (widget: DashboardWidgetPlacement) => ReactNode;
  readonly sideLabel?: string | undefined;
  readonly mainLabel?: string | undefined;
  readonly outlined?: boolean | undefined;
  readonly "data-testid"?: string | undefined;
}

export function DashboardZones({
  layout,
  present = () => true,
  render,
  sideLabel,
  mainLabel,
  outlined = false,
  "data-testid": testId = "dashboard-zones",
}: DashboardZonesProps): JSX.Element {
  const top = shownIn(layout, DASHBOARD_ZONE.TOP).filter(present);
  const main = shownIn(layout, DASHBOARD_ZONE.MAIN).filter(present);
  const side = shownIn(layout, DASHBOARD_ZONE.SIDE).filter(present);
  const spans = dashboardRowSpans(main.map((widget) => widget.width));
  const zone = cn(outlined && "rounded-card border border-dashed border-line p-3");

  return (
    <div data-testid={testId} className="flex flex-col gap-4">
      {top.map((widget) => (
        <div key={widget.id} data-testid={`${testId}-top-${widget.id}`} className="min-w-0">
          {render(widget)}
        </div>
      ))}

      <div
        className={cn(
          "grid items-start gap-4",
          (side.length > 0 || outlined) && "min-[1220px]:grid-cols-[1fr_292px]",
        )}
      >
        <div
          data-testid={`${testId}-main`}
          className={cn("grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-6", zone)}
        >
          {mainLabel !== undefined && (
            <p className="text-label text-ink-muted lg:col-span-6">{mainLabel}</p>
          )}
          {main.map((widget, index) => (
            <div
              key={widget.id}
              data-testid={`${testId}-main-${widget.id}`}
              className={cn("min-w-0", DASHBOARD_SPAN_CLASS[spans[index] ?? 6])}
            >
              {render(widget)}
            </div>
          ))}
        </div>

        {(side.length > 0 || outlined) && (
          <aside
            data-testid={`${testId}-side`}
            className={cn(
              "flex min-w-0 flex-col gap-4 max-[1219px]:flex-row max-[1219px]:flex-wrap max-[759px]:flex-col",
              zone,
            )}
          >
            {sideLabel !== undefined && (
              <p className="w-full text-label text-ink-muted">{sideLabel}</p>
            )}
            {side.map((widget) => (
              <div
                key={widget.id}
                data-testid={`${testId}-side-${widget.id}`}
                className="min-w-0 flex-1"
              >
                {render(widget)}
              </div>
            ))}
          </aside>
        )}
      </div>
    </div>
  );
}
