import {
  DASHBOARD_GRID_COLUMNS,
  DASHBOARD_WIDTH_COLUMNS,
  DASHBOARD_WIDTHS,
  type DashboardWidgetPlacement,
  type DashboardWidth,
} from "@clinic/shared";
import {
  useId,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { Button, Icon } from "@clinic/ui";
import { cn } from "@clinic/ui/lib/cn";
import { documentDirection } from "@clinic/ui/lib/direction";

export interface WidgetChoice {
  readonly id: string;
  readonly label: string;
  readonly on: boolean;
}

export interface WidgetFrameProps {
  readonly widget: DashboardWidgetPlacement;
  readonly resizable: boolean;
  readonly dragging: boolean;
  readonly choices?: readonly WidgetChoice[] | undefined;
  readonly choicesLabel?: string | undefined;
  readonly onChoose?: ((id: string) => void) | undefined;
  readonly onHide: () => void;
  readonly onStep: (step: -1 | 1) => void;
  readonly onResize: (width: DashboardWidth) => void;
  readonly onDragStart: () => void;
  readonly onDragOver: () => void;
  readonly onDragEnd: () => void;
  readonly children: ReactNode;
}

const columnsWidth = (grid: HTMLElement): ((width: DashboardWidth) => number) => {
  const style = getComputedStyle(grid);
  const gap = parseFloat(style.columnGap) || 0;
  const inner =
    grid.clientWidth -
    (parseFloat(style.paddingInlineStart) || 0) -
    (parseFloat(style.paddingInlineEnd) || 0);
  const column = (inner - (DASHBOARD_GRID_COLUMNS - 1) * gap) / DASHBOARD_GRID_COLUMNS;

  return (width) =>
    DASHBOARD_WIDTH_COLUMNS[width] * column + (DASHBOARD_WIDTH_COLUMNS[width] - 1) * gap;
};

const nearestWidth = (px: number, span: (width: DashboardWidth) => number): DashboardWidth =>
  DASHBOARD_WIDTHS.reduce((best, width) =>
    Math.abs(span(width) - px) < Math.abs(span(best) - px) ? width : best,
  );

export function WidgetFrame({
  widget,
  resizable,
  dragging,
  choices,
  choicesLabel,
  onChoose,
  onHide,
  onStep,
  onResize,
  onDragStart,
  onDragOver,
  onDragEnd,
  children,
}: WidgetFrameProps): JSX.Element {
  const { t } = useTranslation();
  const hintId = useId();
  const frame = useRef<HTMLElement>(null);
  const resizeFrom = useRef<{ readonly x: number; readonly px: number } | null>(null);
  const [armed, setArmed] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [editing, setEditing] = useState(false);
  const editable = choices !== undefined && choices.length > 0;
  const testId = `dashboard-frame-${widget.id}`;
  const name = t(`dashboard.widgets.${widget.id}.title`);
  const rtl = documentDirection() === "rtl";

  const moveByKey = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const earlier = ["ArrowUp", rtl ? "ArrowRight" : "ArrowLeft"];
    const later = ["ArrowDown", rtl ? "ArrowLeft" : "ArrowRight"];

    if (earlier.includes(event.key)) {
      event.preventDefault();
      onStep(-1);
    } else if (later.includes(event.key)) {
      event.preventDefault();
      onStep(1);
    }
  };

  const startResize = (event: PointerEvent<HTMLButtonElement>): void => {
    if (!frame.current) {
      return;
    }

    resizeFrom.current = { x: event.clientX, px: frame.current.getBoundingClientRect().width };
    setResizing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveResize = (event: PointerEvent<HTMLButtonElement>): void => {
    const from = resizeFrom.current;
    const grid = frame.current?.closest<HTMLElement>("[data-zone]");

    if (!from || !grid) {
      return;
    }

    const span = columnsWidth(grid);
    const delta = (event.clientX - from.x) * (rtl ? -1 : 1);
    const next = nearestWidth(from.px + delta, span);

    if (next !== widget.width) {
      onResize(next);
    }
  };

  const endResize = (): void => {
    resizeFrom.current = null;
    setResizing(false);
  };

  const resizeByKey = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const grow = rtl ? "ArrowLeft" : "ArrowRight";
    const shrink = rtl ? "ArrowRight" : "ArrowLeft";
    const step = event.key === grow ? 1 : event.key === shrink ? -1 : 0;
    const next = DASHBOARD_WIDTHS[DASHBOARD_WIDTHS.indexOf(widget.width) + step];

    if (step !== 0) {
      event.preventDefault();
    }

    if (step !== 0 && next !== undefined) {
      onResize(next);
    }
  };

  return (
    <section
      ref={frame}
      data-testid={testId}
      aria-label={name}
      draggable={armed}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", widget.id);
        onDragStart();
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        onDragOver();
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => event.preventDefault()}
      onDragEnd={() => {
        setArmed(false);
        onDragEnd();
      }}
      className={cn(
        "relative flex h-full flex-col gap-2 rounded-card border-2 border-dashed border-primary-600/30 bg-canvas p-2 transition-[border-color,opacity] duration-150",
        dragging && "border-primary-600 opacity-50",
        resizing && "border-solid border-primary-600",
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid={`${testId}-handle`}
          aria-label={t("dashboard.customize.drag", { name })}
          aria-describedby={hintId}
          onPointerDown={() => setArmed(true)}
          onPointerUp={() => setArmed(false)}
          onKeyDown={moveByKey}
          className="flex min-h-(--control-h-sm) min-w-0 flex-1 cursor-grab items-center gap-2 rounded-pill ps-1 pe-3 text-start active:cursor-grabbing"
        >
          <Icon name="grip" className="size-4 shrink-0 text-ink-muted" />
          <span className="truncate text-label font-semibold">{name}</span>
          <span id={hintId} className="sr-only">
            {t("dashboard.customize.moveHint")}
          </span>
        </button>

        {editable && (
          <Button
            variant={editing ? "ghost" : "quiet"}
            size="sm"
            data-testid={`${testId}-edit`}
            aria-label={t("dashboard.customize.edit", { name })}
            aria-pressed={editing}
            aria-expanded={editing}
            icon={<Icon name={editing ? "check" : "edit"} />}
            onClick={() => setEditing((open) => !open)}
          />
        )}

        <Button
          variant="quiet"
          size="sm"
          data-testid={`${testId}-hide`}
          aria-label={t("dashboard.customize.hide")}
          icon={<Icon name="eye-off" />}
          onClick={onHide}
        />
      </div>

      {editable && editing && (
        <div
          role="group"
          aria-label={choicesLabel}
          data-testid={`${testId}-choices`}
          className="flex flex-col gap-2 rounded-panel bg-inset px-3 py-2"
        >
          <span className="text-label text-ink-muted">{choicesLabel}</span>
          <div className="flex flex-wrap gap-2">
            {choices.map((choice) => (
              <Button
                key={choice.id}
                variant={choice.on ? "ghost" : "secondary"}
                size="sm"
                data-testid={`${testId}-choice-${choice.id}`}
                aria-pressed={choice.on}
                icon={<Icon name={choice.on ? "check" : "plus"} />}
                onClick={() => onChoose?.(choice.id)}
              >
                {choice.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div inert className="pointer-events-none flex-1 select-none">
        {children}
      </div>

      {resizable && (
        <button
          type="button"
          role="slider"
          data-testid={`${testId}-resize`}
          aria-label={t("dashboard.customize.resize", { name })}
          aria-orientation="horizontal"
          aria-valuemin={1}
          aria-valuemax={DASHBOARD_WIDTHS.length}
          aria-valuenow={DASHBOARD_WIDTHS.indexOf(widget.width) + 1}
          aria-valuetext={t(`dashboard.customize.widths.${widget.width}`)}
          onPointerDown={startResize}
          onPointerMove={moveResize}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          onKeyDown={resizeByKey}
          className={cn(
            "absolute -end-3 -bottom-3 z-10 flex h-(--control-h-sm) min-w-(--control-h-sm) cursor-ew-resize touch-none items-center justify-center gap-1 rounded-pill border border-line bg-surface px-2 text-ink-muted shadow-card hover:text-primary-700 max-lg:hidden",
            resizing && "border-primary-600 text-primary-700",
          )}
        >
          {resizing && (
            <span className="text-micro font-medium">
              {t(`dashboard.customize.widths.${widget.width}`)}
            </span>
          )}
          <Icon name="move-horizontal" className="size-3.5" />
        </button>
      )}
    </section>
  );
}
