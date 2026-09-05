import { TOOTH_STATE, type ToothState } from '@clinic/shared';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
} from 'react';
import { useTranslation } from 'react-i18next';

import {
  CHART_VIEWBOX,
  layoutTeeth,
  type Dentition,
  type ToothGeometry,
} from '@web/features/patients/chart/fdi-layout';
import {
  healthyTooth,
  TOOTH_STATE_STYLES,
  toothStateLabelKey,
  type ToothSummary,
} from '@web/features/patients/chart/tooth-state';
import { cn } from '@web/lib/cn';

export interface ToothChartProps {
  readonly dentition: Dentition;
  readonly summaries: ReadonlyMap<number, ToothSummary>;
  readonly selectedTooth: number | null;
  readonly onSelect: (tooth: number) => void;
}

/**
 * The interactive chart.
 *
 * Drawn as one SVG rather than a grid of boxes because the arch itself carries
 * meaning: a clinician finds tooth 26 by its position in the mouth, not by
 * reading numbers. Every tooth is still a real button underneath, so the whole
 * thing works from the keyboard and announces itself.
 *
 * Two things are deliberate:
 *
 *  - **The chart never mirrors in RTL.** It is anatomy, not text: it is drawn
 *    from the clinician's point of view, with the patient's right on the
 *    viewer's left. Flipping it with the page would put the patient's right on
 *    the wrong side, which is the kind of error that ends up in the wrong
 *    tooth being treated. The SVG is pinned `dir="ltr"`.
 *  - **It scales rather than stacking on narrow screens.** The upper and lower
 *    arches have to stay vertically aligned for the midline to read, so
 *    splitting them apart is not an option. It scales down to the point where a
 *    tooth is still comfortably tappable and then scrolls sideways instead of
 *    shrinking further.
 */
export function ToothChart({
  dentition,
  summaries,
  selectedTooth,
  onSelect,
}: ToothChartProps): JSX.Element {
  const { t } = useTranslation();
  const teeth = useMemo(() => layoutTeeth(dentition), [dentition]);
  const [hoveredTooth, setHoveredTooth] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Start scrolled to the midline. When the chart is wider than the screen the
   * incisors are what orients you; opening on the third molars of one side does
   * not.
   */
  useEffect(() => {
    const container = containerRef.current;

    if (container) {
      container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
    }
  }, [dentition]);

  const upper = useMemo(() => teeth.filter((tooth) => tooth.arch === 'upper'), [teeth]);
  const lower = useMemo(() => teeth.filter((tooth) => tooth.arch === 'lower'), [teeth]);

  /** The tooth the Tab key lands on: the selected one, else the first. */
  const [focusedTooth, setFocusedTooth] = useState<number | null>(null);
  const rovingTooth = focusedTooth ?? selectedTooth ?? upper[0]?.tooth ?? null;

  const focusTooth = useCallback((tooth: number) => {
    setFocusedTooth(tooth);
    containerRef.current?.querySelector<SVGGElement>(`[data-tooth="${tooth}"]`)?.focus();
  }, []);

  /**
   * Arrow keys walk the arches the way the eye does — visually, left to right,
   * with up and down crossing between the arches at the same position. The
   * directions are visual on purpose: the chart is pinned LTR, so mapping the
   * keys to the page's reading direction would send focus the wrong way.
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<SVGGElement>, geometry: ToothGeometry): void => {
      const row = geometry.arch === 'upper' ? upper : lower;
      const other = geometry.arch === 'upper' ? lower : upper;
      const index = row.findIndex((entry) => entry.tooth === geometry.tooth);

      const move = (target: ToothGeometry | undefined): void => {
        if (target) {
          event.preventDefault();
          focusTooth(target.tooth);
        }
      };

      switch (event.key) {
        case 'ArrowRight':
          return move(row[index + 1]);
        case 'ArrowLeft':
          return move(row[index - 1]);
        case 'ArrowUp':
          return geometry.arch === 'lower' ? move(other[index]) : undefined;
        case 'ArrowDown':
          return geometry.arch === 'upper' ? move(other[index]) : undefined;
        case 'Home':
          return move(row[0]);
        case 'End':
          return move(row[row.length - 1]);
        case 'Enter':
        case ' ':
          event.preventDefault();
          onSelect(geometry.tooth);
          return;
        default:
          return;
      }
    },
    [upper, lower, focusTooth, onSelect],
  );

  const activeTooth = hoveredTooth ?? focusedTooth;
  const activeGeometry = teeth.find((entry) => entry.tooth === activeTooth);
  const activeSummary = activeTooth === null ? null : summarise(summaries, activeTooth);

  return (
    // `dir="ltr"` on the wrapper, not the SVG: the chart is anatomy drawn from
    // the clinician's point of view, so its labels must not reorder with the
    // page even though everything around it is Arabic.
    <div
      dir="ltr"
      ref={containerRef}
      className="overflow-x-auto rounded-lg border border-chart-border bg-chart-surface p-2"
    >
      {/* The tooltip is positioned inside this box so it tracks the tooth when
          the chart is scrolled sideways on a narrow screen. */}
      <div className="relative w-full min-w-[520px] max-w-3xl">
        <svg
          viewBox={`${CHART_VIEWBOX.x} ${CHART_VIEWBOX.y} ${CHART_VIEWBOX.width} ${CHART_VIEWBOX.height}`}
          role="group"
          aria-label={t('chart.title')}
          className="h-auto w-full"
        >
          {/* Midline: the reference a clinician reads quadrants against. */}
          <line
            x1={CHART_VIEWBOX.x + CHART_VIEWBOX.width / 2}
            y1={CHART_VIEWBOX.y + 6}
            x2={CHART_VIEWBOX.x + CHART_VIEWBOX.width / 2}
            y2={CHART_VIEWBOX.y + CHART_VIEWBOX.height - 6}
            stroke="var(--color-chart-guide)"
            strokeWidth={1}
            strokeDasharray="4 6"
          />

          {teeth.map((geometry) => (
            <Tooth
              key={geometry.tooth}
              geometry={geometry}
              summary={summarise(summaries, geometry.tooth)}
              selected={selectedTooth === geometry.tooth}
              tabIndex={rovingTooth === geometry.tooth ? 0 : -1}
              onSelect={onSelect}
              onKeyDown={handleKeyDown}
              onHoverChange={setHoveredTooth}
              onFocusChange={setFocusedTooth}
            />
          ))}
        </svg>

        {activeGeometry && activeSummary && (
          <Tooltip geometry={activeGeometry} summary={activeSummary} />
        )}
      </div>
    </div>
  );
}

function summarise(summaries: ReadonlyMap<number, ToothSummary>, tooth: number): ToothSummary {
  return summaries.get(tooth) ?? healthyTooth(tooth);
}

interface ToothProps {
  readonly geometry: ToothGeometry;
  readonly summary: ToothSummary;
  readonly selected: boolean;
  readonly tabIndex: number;
  readonly onSelect: (tooth: number) => void;
  readonly onKeyDown: (event: KeyboardEvent<SVGGElement>, geometry: ToothGeometry) => void;
  readonly onHoverChange: (tooth: number | null) => void;
  readonly onFocusChange: (tooth: number | null) => void;
}

function Tooth({
  geometry,
  summary,
  selected,
  tabIndex,
  onSelect,
  onKeyDown,
  onHoverChange,
  onFocusChange,
}: ToothProps): JSX.Element {
  const { t } = useTranslation();
  const style = TOOTH_STATE_STYLES[summary.state];
  const missing = summary.state === TOOTH_STATE.MISSING;

  return (
    <g
      data-tooth={geometry.tooth}
      data-state={summary.state}
      role="button"
      tabIndex={tabIndex}
      // Colour is never the only channel: the condition is in the name, in
      // words, so a screen reader announces "tooth 46, filling, 2 procedures".
      aria-label={
        summary.procedureCount === 0
          ? t('chart.toothLabel', {
              tooth: geometry.tooth,
              state: t(toothStateLabelKey(summary.state)),
            })
          : t('chart.toothLabelWithCount', {
              tooth: geometry.tooth,
              state: t(toothStateLabelKey(summary.state)),
              count: summary.procedureCount,
            })
      }
      aria-current={selected ? 'true' : undefined}
      className="cursor-pointer outline-none [&:focus-visible_.tooth-ring]:opacity-100"
      onClick={() => onSelect(geometry.tooth)}
      onKeyDown={(event) => onKeyDown(event, geometry)}
      onMouseEnter={() => onHoverChange(geometry.tooth)}
      onMouseLeave={() => onHoverChange(null)}
      onFocus={() => onFocusChange(geometry.tooth)}
    >
      <g transform={`translate(${geometry.x} ${geometry.y}) rotate(${geometry.rotation})`}>
        {/* Selection and focus ring, drawn behind the crown. */}
        <rect
          className={cn('tooth-ring transition-opacity', selected ? 'opacity-100' : 'opacity-0')}
          x={-geometry.width / 2 - 5}
          y={-geometry.height / 2 - 5}
          width={geometry.width + 10}
          height={geometry.height + 10}
          rx={7}
          fill="none"
          stroke="var(--color-primary-600)"
          strokeWidth={2.5}
        />

        <path
          d={geometry.path}
          fill={style.fill}
          stroke={style.stroke}
          strokeWidth={missing ? 1.6 : 1.2}
          strokeDasharray={style.dashed ? '4 3' : undefined}
          strokeLinejoin="round"
        />

        {geometry.groove && !missing && (
          <path
            d={geometry.groove}
            fill="none"
            stroke={style.ink}
            strokeOpacity={0.28}
            strokeWidth={1}
            strokeLinecap="round"
          />
        )}
      </g>

      {/* Numbers stay upright: the crown rotates, its label must not. */}
      <text
        x={geometry.labelX}
        y={geometry.labelY}
        textAnchor="middle"
        dominantBaseline="central"
        aria-hidden="true"
        className="pointer-events-none text-[11px] font-medium"
        fill="var(--color-chart-text)"
      >
        {geometry.tooth}
      </text>
    </g>
  );
}

function Tooltip({
  geometry,
  summary,
}: {
  geometry: ToothGeometry;
  summary: ToothSummary;
}): JSX.Element {
  const { t } = useTranslation();

  // Percentages, so the tooltip tracks the tooth as the SVG scales.
  const left = `${((geometry.x - CHART_VIEWBOX.x) / CHART_VIEWBOX.width) * 100}%`;
  const top = `${((geometry.y - CHART_VIEWBOX.y) / CHART_VIEWBOX.height) * 100}%`;

  return (
    <div
      role="tooltip"
      // Supplementary only: the same facts are already in the tooth's
      // accessible name, so a screen reader is not told them twice.
      aria-hidden="true"
      // The text follows the page even though the chart around it does not.
      dir="rtl"
      // Physical centring on purpose — `left` and `translate-x` are unaffected
      // by direction, so the bubble sits on the tooth either way.
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[130%] whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-ink-inverse shadow-lg"
      style={{ left, top }}
    >
      <span className="font-semibold" dir="ltr">
        {geometry.tooth}
      </span>{' '}
      · {t(toothStateLabelKey(summary.state))}
      {summary.surfaces.length > 0 && (
        <>
          {' · '}
          <span dir="ltr">{summary.surfaces.join(' ')}</span>
        </>
      )}
    </div>
  );
}

/** Placeholder with the same footprint as the chart, so nothing jumps. */
export function ToothChartSkeleton(): JSX.Element {
  return (
    <div
      className="w-full max-w-3xl animate-pulse rounded-lg bg-sunken"
      style={{ aspectRatio: `${CHART_VIEWBOX.width} / ${CHART_VIEWBOX.height}` }}
      aria-hidden="true"
    />
  );
}

export type { ToothState };
