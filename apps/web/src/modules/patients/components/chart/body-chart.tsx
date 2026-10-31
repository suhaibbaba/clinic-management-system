import { useCallback, useId, useRef, useState, type JSX, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@clinic/ui/components/skeleton";
import { cn } from "@clinic/ui/lib/cn";
import { SKELETON_URL } from "@web/modules/patients/constants";
import {
  SKELETON_VIEWBOX,
  SKELETON_VIEWS,
  skeletonOutline,
  stackingOrder,
  type SkeletonView,
} from "@web/modules/patients/lib/chart/skeleton-layout";
import {
  regionTone,
  type RegionSlot,
  type RegionSummary,
  type RegionTone,
} from "@web/modules/patients/lib/chart/body-regions";

export interface BodyChartProps {
  readonly slots: readonly RegionSlot[];
  readonly summaries: ReadonlyMap<string, RegionSummary>;
  readonly selectedKey: string | null;
  readonly label: (slot: RegionSlot) => string;
  readonly onSelect: (slot: RegionSlot) => void;
}

const BONE =
  "[--bone-hi:var(--color-surface)] [--bone:var(--color-neutral-50)] [--bone-shade:var(--color-neutral-200)] [--bone-deep:var(--color-neutral-400)] [--bone-line:var(--color-neutral-600)] [--bone-hole:var(--color-neutral-600)] [--cartilage:var(--color-primary-200)] [--cartilage-deep:var(--color-primary-300)]";

const TINT: Readonly<Record<RegionTone | "active", string>> = {
  none: "",
  active:
    "[--bone-hi:var(--color-primary-100)] [--bone:var(--color-primary-200)] [--bone-shade:var(--color-primary-300)] [--bone-deep:var(--color-primary-500)] [--bone-line:var(--color-primary-700)]",
  planned:
    "[--bone-hi:var(--color-warning-100)] [--bone:var(--color-warning-300)] [--bone-shade:var(--color-warning-500)] [--bone-deep:var(--color-warning-700)] [--bone-line:var(--color-warning-800)]",
  treated:
    "[--bone-hi:var(--color-primary-300)] [--bone:var(--color-primary-500)] [--bone-shade:var(--color-primary-600)] [--bone-deep:var(--color-primary-800)] [--bone-line:var(--color-primary-900)]",
};

const SELECTED = "[--bone-line:var(--color-ink)]";

export function BodyChart({
  slots,
  summaries,
  selectedKey,
  label,
  onSelect,
}: BodyChartProps): JSX.Element {
  const { t } = useTranslation();
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const rovingKey = focusedKey ?? selectedKey ?? slots[0]?.key ?? null;

  const primaryView = (slot: RegionSlot): SkeletonView | undefined =>
    SKELETON_VIEWS.find((view) => skeletonOutline(view, slot.region, slot.side) !== undefined);
  const listed = slots.filter((slot) => primaryView(slot) === undefined);

  const focusSlot = useCallback((slot: RegionSlot) => {
    setFocusedKey(slot.key);
    containerRef.current
      ?.querySelector<SVGElement | HTMLElement>(`[data-region="${slot.key}"][data-primary]`)
      ?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<Element>, slot: RegionSlot): void => {
    const index = slots.findIndex((candidate) => candidate.key === slot.key);
    const move = (target: RegionSlot | undefined): void => {
      if (target) {
        event.preventDefault();
        focusSlot(target);
      }
    };

    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        return move(slots[index + 1]);
      case "ArrowUp":
      case "ArrowLeft":
        return move(slots[index - 1]);
      case "Home":
        return move(slots[0]);
      case "End":
        return move(slots[slots.length - 1]);
      case "Enter":
      case " ":
        event.preventDefault();
        onSelect(slot);
        return;
      default:
        return;
    }
  };

  const regionProps = (slot: RegionSlot, primary: boolean) => ({
    "data-region": slot.key,
    "data-primary": primary ? "" : undefined,
    "data-testid": primary ? `body-region-${slot.key}` : undefined,
    "data-tone": regionTone(summaries, slot.key),
    tabIndex: primary ? (rovingKey === slot.key ? 0 : -1) : undefined,
    "aria-hidden": primary ? undefined : true,
    "aria-label": primary ? label(slot) : undefined,
    "aria-current": primary && selectedKey === slot.key ? ("true" as const) : undefined,
    onClick: () => onSelect(slot),
    onKeyDown: (event: KeyboardEvent<Element>) => handleKeyDown(event, slot),
    onFocus: () => {
      setFocusedKey(slot.key);
      setActiveKey(slot.key);
    },
    onBlur: () => setActiveKey(null),
    onMouseEnter: () => setActiveKey(slot.key),
    onMouseLeave: () => setActiveKey(null),
  });

  const figure = (view: SkeletonView): JSX.Element => {
    const drawn = slots
      .map((slot) => ({ slot, outline: skeletonOutline(view, slot.region, slot.side) }))
      .filter(
        (entry): entry is { slot: RegionSlot; outline: string } => entry.outline !== undefined,
      )
      .sort((a, b) => stackingOrder(a.slot.region) - stackingOrder(b.slot.region));
    const href = `${SKELETON_URL}#skeleton-${view}`;
    const clipId = (slot: RegionSlot): string =>
      `${id}-${view}-${slot.key}`.replace(/[^\w-]/g, "_");

    return (
      <figure
        key={view}
        data-testid={`body-chart-${view}`}
        className="flex flex-col items-center gap-2"
      >
        <figcaption className="text-label font-medium text-ink-muted">
          {t(`chart.body.views.${view}`)}
        </figcaption>
        <svg
          role="group"
          aria-label={t(`chart.body.views.${view}`)}
          viewBox={`0 0 ${SKELETON_VIEWBOX.width} ${SKELETON_VIEWBOX.height}`}
          className={cn("block h-auto w-full max-w-72", BONE)}
        >
          <defs>
            {drawn.map(({ slot, outline }) => (
              <clipPath key={slot.key} id={clipId(slot)}>
                <path d={outline} />
              </clipPath>
            ))}
          </defs>

          <use href={href} width={SKELETON_VIEWBOX.width} height={SKELETON_VIEWBOX.height} />

          {drawn.map(({ slot, outline }) => {
            const tone = regionTone(summaries, slot.key);
            const active = activeKey === slot.key;
            const selected = selectedKey === slot.key;
            const tint = tone !== "none" ? TINT[tone] : active || selected ? TINT.active : null;

            return (
              <g
                key={slot.key}
                role="button"
                className="cursor-pointer"
                {...regionProps(slot, primaryView(slot) === view)}
              >
                <title>{label(slot)}</title>
                {tint !== null && (
                  <use
                    href={href}
                    width={SKELETON_VIEWBOX.width}
                    height={SKELETON_VIEWBOX.height}
                    clipPath={`url(#${clipId(slot)})`}
                    className={cn(tint, selected && SELECTED)}
                  />
                )}
                <path d={outline} fill="transparent" />
              </g>
            );
          })}
        </svg>
      </figure>
    );
  };

  return (
    <div
      ref={containerRef}
      data-testid="body-chart"
      className="flex flex-col gap-4 rounded-card border border-chart-border bg-chart-surface p-4"
    >
      <div className="grid grid-cols-2 gap-4">{SKELETON_VIEWS.map(figure)}</div>

      {listed.length > 0 && (
        <div data-testid="body-chart-other" className="flex flex-wrap justify-center gap-2">
          {listed.map((slot) => (
            <button
              key={slot.key}
              type="button"
              className={cn(
                "h-(--control-h-sm) rounded-pill border px-3 text-label",
                regionTone(summaries, slot.key) === "none"
                  ? "border-line bg-surface text-ink"
                  : "border-primary-600 bg-primary-50 text-primary-800",
                selectedKey === slot.key && "border-ink",
              )}
              {...regionProps(slot, true)}
            >
              {label(slot)}
            </button>
          ))}
        </div>
      )}

      <ul data-testid="body-chart-legend" className="flex flex-wrap justify-center gap-4">
        {(["none", "planned", "treated"] as const).map((tone) => (
          <li key={tone} className="flex items-center gap-1.5 text-label text-ink-muted">
            <svg aria-hidden="true" viewBox="0 0 12 12" className={cn("size-3", BONE, TINT[tone])}>
              <rect
                x={1}
                y={1}
                width={10}
                height={10}
                rx={3}
                className="fill-(--bone) stroke-(--bone-line)"
              />
            </svg>
            {t(`chart.body.legend.${tone}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BodyChartSkeleton(): JSX.Element {
  return <Skeleton data-testid="body-chart-skeleton" className="mx-auto h-96 w-full max-w-lg" />;
}
