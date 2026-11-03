import {
  DASHBOARD_ZONE,
  dashboardRowSpans,
  type DashboardLayout,
  type DashboardWidgetPlacement,
  type DashboardZone,
} from "@clinic/shared";
import type { DragEvent, JSX, ReactNode } from "react";
import { cn } from "@clinic/ui/lib/cn";
import { shownIn } from "@web/modules/dashboard/lib/layout-edits";
import { DASHBOARD_SPAN_CLASS } from "@web/modules/dashboard/constants";

export interface DashboardZonesProps {
  readonly layout: DashboardLayout;
  readonly present?: ((widget: DashboardWidgetPlacement) => boolean) | undefined;
  readonly render: (widget: DashboardWidgetPlacement) => ReactNode;
  readonly labels?: Readonly<Record<DashboardZone, string>> | undefined;
  readonly onZoneDragOver?: ((zone: DashboardZone) => void) | undefined;
  readonly "data-testid"?: string | undefined;
}

export function DashboardZones({
  layout,
  present = () => true,
  render,
  labels,
  onZoneDragOver,
  "data-testid": testId = "dashboard-zones",
}: DashboardZonesProps): JSX.Element {
  const editing = labels !== undefined;
  const top = shownIn(layout, DASHBOARD_ZONE.TOP).filter(present);
  const main = shownIn(layout, DASHBOARD_ZONE.MAIN).filter(present);
  const side = shownIn(layout, DASHBOARD_ZONE.SIDE).filter(present);
  const spans = dashboardRowSpans(main.map((widget) => widget.width));
  const outline = cn(editing && "rounded-card border border-dashed border-line p-3");

  const dropZone = (zone: DashboardZone) =>
    onZoneDragOver === undefined
      ? {}
      : {
          onDragOver: (event: DragEvent) => {
            event.preventDefault();
            if (event.target === event.currentTarget) {
              onZoneDragOver(zone);
            }
          },
          onDrop: (event: DragEvent) => event.preventDefault(),
        };

  const label = (zone: DashboardZone, className?: string): ReactNode =>
    labels !== undefined && (
      <p className={cn("text-label text-ink-muted", className)}>{labels[zone]}</p>
    );

  return (
    <div data-testid={testId} className="flex flex-col gap-4">
      {(top.length > 0 || editing) && (
        <div
          data-testid={`${testId}-top`}
          data-zone={DASHBOARD_ZONE.TOP}
          className={cn("flex min-w-0 flex-col gap-4", outline)}
          {...dropZone(DASHBOARD_ZONE.TOP)}
        >
          {label(DASHBOARD_ZONE.TOP)}
          {top.map((widget) => (
            <div key={widget.id} data-testid={`${testId}-top-${widget.id}`} className="min-w-0">
              {render(widget)}
            </div>
          ))}
        </div>
      )}

      <div
        className={cn(
          "grid items-start gap-4",
          (side.length > 0 || editing) && "min-[1220px]:grid-cols-[1fr_292px]",
        )}
      >
        <div
          data-testid={`${testId}-main`}
          data-zone={DASHBOARD_ZONE.MAIN}
          className={cn("grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-6", outline)}
          {...dropZone(DASHBOARD_ZONE.MAIN)}
        >
          {label(DASHBOARD_ZONE.MAIN, "lg:col-span-6")}
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

        {(side.length > 0 || editing) && (
          <aside
            data-testid={`${testId}-side`}
            data-zone={DASHBOARD_ZONE.SIDE}
            className={cn(
              "flex min-w-0 flex-col gap-4 max-[1219px]:flex-row max-[1219px]:flex-wrap max-[759px]:flex-col",
              editing && "min-h-40",
              outline,
            )}
            {...dropZone(DASHBOARD_ZONE.SIDE)}
          >
            {label(DASHBOARD_ZONE.SIDE, "w-full")}
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
