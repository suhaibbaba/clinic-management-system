import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type KeyboardEvent,
} from 'react';
import { useTranslation } from 'react-i18next';

import { Skeleton, SkeletonStatus } from '@web/components/ui/skeleton';
import { layoutRow, type Dentition, type ToothSlot } from '@web/features/patients/chart/fdi-layout';
import {
  CROWN_LINE,
  IMPLANT_POST,
  TOOTH_SHAPES,
  TOOTH_VIEWBOX,
} from '@web/features/patients/chart/tooth-shapes';
import {
  areaState,
  hasShape,
  healthyTooth,
  useToothStates,
  type ToothStates,
  type ToothSummary,
} from '@web/features/patients/chart/tooth-state';
import { cn } from '@web/lib/cn';
import { documentDirection } from '@web/lib/direction';

export interface ToothChartProps {
  readonly dentition: Dentition;
  readonly summaries: ReadonlyMap<number, ToothSummary>;
  readonly selectedTooth: number | null;
  readonly onSelect: (tooth: number) => void;
}

// The chart never mirrors in RTL: it is anatomy from the clinician's side, and flipping it puts the
// patient's right on the wrong side. It scrolls rather than shrinking below a tappable size.
export function ToothChart({
  dentition,
  summaries,
  selectedTooth,
  onSelect,
}: ToothChartProps): JSX.Element {
  const { t } = useTranslation();
  const states = useToothStates();

  const upper = useMemo(() => layoutRow(dentition, 'upper'), [dentition]);
  const lower = useMemo(() => layoutRow(dentition, 'lower'), [dentition]);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (container) {
      container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
    }
  }, [dentition]);

  /** The tooth the Tab key lands on: the selected one, else the first. */
  const [focusedTooth, setFocusedTooth] = useState<number | null>(null);
  const rovingTooth = focusedTooth ?? selectedTooth ?? upper[0]?.tooth ?? null;

  const focusTooth = useCallback((tooth: number) => {
    setFocusedTooth(tooth);
    containerRef.current?.querySelector<HTMLButtonElement>(`[data-tooth="${tooth}"]`)?.focus();
  }, []);

  // The directions are visual on purpose: the chart is pinned LTR, so mapping the keys to the
  // page's reading direction would send focus the wrong way in Arabic.
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, slot: ToothSlot): void => {
      const row = slot.arch === 'upper' ? upper : lower;
      const other = slot.arch === 'upper' ? lower : upper;

      const move = (target: ToothSlot | undefined): void => {
        if (target) {
          event.preventDefault();
          focusTooth(target.tooth);
        }
      };

      switch (event.key) {
        case 'ArrowRight':
          return move(row[slot.index + 1]);
        case 'ArrowLeft':
          return move(row[slot.index - 1]);
        case 'ArrowUp':
          return slot.arch === 'lower' ? move(other[slot.index]) : undefined;
        case 'ArrowDown':
          return slot.arch === 'upper' ? move(other[slot.index]) : undefined;
        case 'Home':
          return move(row[0]);
        case 'End':
          return move(row[row.length - 1]);
        case 'Enter':
        case ' ':
          event.preventDefault();
          onSelect(slot.tooth);
          return;
        default:
          return;
      }
    },
    [upper, lower, focusTooth, onSelect],
  );

  const renderRow = (slots: readonly ToothSlot[]): JSX.Element => (
    <div className={cn('flex justify-center gap-px', slots[0]?.arch === 'lower' && 'chart-lower')}>
      {slots.map((slot) => (
        <Tooth
          key={slot.tooth}
          slot={slot}
          summary={summarise(summaries, slot.tooth)}
          states={states}
          bridge={bridgeSpan(slots, slot.index, summaries, states)}
          selected={selectedTooth === slot.tooth}
          tabIndex={rovingTooth === slot.tooth ? 0 : -1}
          onSelect={onSelect}
          onKeyDown={handleKeyDown}
          onFocusChange={setFocusedTooth}
        />
      ))}
    </div>
  );

  return (
    <div
      dir="ltr"
      ref={containerRef}
      // `pt-9` is for the tooltip: `overflow-x: auto` makes this a scroll container on both axes,
      // so a bubble above the top row was clipped to a sliver.
      className="overflow-x-auto rounded-card border border-chart-border bg-chart-surface px-2 pb-3 pt-9"
      style={
        {
          '--tooth-w': dentition === 'permanent' ? '30px' : '36px',
        } as CSSProperties
      }
    >
      <div
        role="group"
        aria-label={t('chart.title')}
        className="relative mx-auto w-max min-w-full sm:[--tooth-w:38px] md:[--tooth-w:44px] lg:[--tooth-w:52px]"
      >
        {/* At 50% rather than counted in teeth: both rows hold the same number, so the container's
            middle is the midline whether the chart has 32 teeth or 20. */}
        <span
          aria-hidden="true"
          data-chart-midline
          className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-chart-guide"
        />

        {renderRow(upper)}

        {/* The occlusal line: where the two arches meet, and the axis the
            numbers of both rows label towards. */}
        <div className="my-1 border-t border-chart-guide" />

        {renderRow(lower)}
      </div>
    </div>
  );
}

function summarise(summaries: ReadonlyMap<number, ToothSummary>, tooth: number): ToothSummary {
  return summaries.get(tooth) ?? healthyTooth(tooth);
}

type BridgeSpan = 'start' | 'middle' | 'end' | null;

// Membership is derived from adjacency, because the record has no bridge grouping — the strongest
// claim the data supports. Two adjacent bridges would draw as one.
function bridgeSpan(
  slots: readonly ToothSlot[],
  index: number,
  summaries: ReadonlyMap<number, ToothSummary>,
  states: ToothStates,
): BridgeSpan {
  const isBridge = (at: number): boolean => {
    const slot = slots[at];
    return slot !== undefined && hasShape(summarise(summaries, slot.tooth), 'bridge', states);
  };

  if (!isBridge(index)) {
    return null;
  }

  const before = isBridge(index - 1);
  const after = isBridge(index + 1);

  if (before && after) {
    return 'middle';
  }

  return after ? 'start' : before ? 'end' : null;
}

interface ToothProps {
  readonly slot: ToothSlot;
  readonly summary: ToothSummary;
  readonly states: ToothStates;
  readonly bridge: BridgeSpan;
  readonly selected: boolean;
  readonly tabIndex: number;
  readonly onSelect: (tooth: number) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, slot: ToothSlot) => void;
  readonly onFocusChange: (tooth: number | null) => void;
}

function Tooth({
  slot,
  summary,
  states,
  bridge,
  selected,
  tabIndex,
  onSelect,
  onKeyDown,
  onFocusChange,
}: ToothProps): JSX.Element {
  const { t } = useTranslation();

  const shape = TOOTH_SHAPES[slot.type];
  // Read from the state's own `shape` rather than its code, so a row a clinic renamed still draws
  // as the absence, the post or the bar it is.
  const missing = states.info(summary.state).shape === 'missing';
  const implant = hasShape(summary, 'implant', states);

  const crown = states.info(areaState(summary, 'crown', states)).style;
  const root = states.info(areaState(summary, 'root', states)).style;
  const stateLabel = states.info(summary.state).label;
  const implantStyle = states.info(areaState(summary, 'root', states)).style;
  const bridgeStyle = crown;

  const label =
    summary.procedureCount === 0
      ? t('chart.toothLabel', { tooth: slot.tooth, state: stateLabel })
      : t('chart.toothLabelWithCount', {
          tooth: slot.tooth,
          state: stateLabel,
          count: summary.procedureCount,
        });

  return (
    <button
      type="button"
      data-tooth={slot.tooth}
      data-state={summary.state}
      tabIndex={tabIndex}
      // Colour is never the only channel: the condition is in the name, in
      // words, so a screen reader announces "tooth 46, filling, 2 procedures".
      aria-label={label}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect(slot.tooth)}
      onKeyDown={(event) => onKeyDown(event, slot)}
      onFocus={() => onFocusChange(slot.tooth)}
      className={cn(
        'group relative flex shrink-0 cursor-pointer flex-col items-center gap-0.5',
        'rounded-panel px-px py-0.5 transition-colors duration-150',
        // The lower row reads bottom-up, so its number sits above its crown —
        // which puts the numbers of both rows against the occlusal line.
        slot.arch === 'lower' && 'flex-col-reverse',
      )}
      style={{ width: 'var(--tooth-w)' }}
    >
      <svg
        viewBox={`0 0 ${TOOTH_VIEWBOX.width} ${TOOTH_VIEWBOX.height}`}
        aria-hidden="true"
        className="block h-auto w-full"
        style={{
          // The bridge bar reaches past the tooth's own box to meet its
          // neighbour, so the SVG must not clip it.
          overflow: 'visible',
          transform: slot.arch === 'lower' ? 'scaleY(-1)' : undefined,
        }}
      >
        {missing ? (
          // Absence is a shape, not a hue: the outline of the tooth that is
          // not there, dashed, with nothing inside it.
          <g
            fill="none"
            stroke={states.info(summary.state).style.stroke}
            strokeWidth={2}
            strokeDasharray="5 4"
            strokeLinejoin="round"
          >
            {shape.roots.map((path) => (
              <path key={path} d={path} />
            ))}
            <path d={shape.crown} />
          </g>
        ) : (
          <g strokeWidth={2} strokeLinejoin="round">
            {implant ? (
              <g fill={implantStyle.fill} stroke={implantStyle.stroke}>
                <path d={IMPLANT_POST.body} />
                {IMPLANT_POST.threads.map((y) => (
                  <line
                    key={y}
                    x1={16}
                    y1={y}
                    x2={32}
                    y2={y - 2}
                    strokeWidth={2.6}
                    strokeLinecap="round"
                  />
                ))}
                <path d={IMPLANT_POST.collar} />
              </g>
            ) : (
              shape.roots.map((path) => (
                <path
                  key={path}
                  d={path}
                  fill={root.fill}
                  stroke={root.stroke}
                  strokeDasharray={root.dashed ? '4 3' : undefined}
                />
              ))
            )}

            <path
              d={shape.crown}
              fill={crown.fill}
              stroke={crown.stroke}
              strokeDasharray={crown.dashed ? '4 3' : undefined}
            />

            {bridge !== null && (
              <rect
                fill={bridgeStyle.stroke}
                // Every tooth but the first starts 6 units early, so its bar overlaps the one
                // reaching towards it and no gap opens between teeth the appliance joins.
                x={bridge === 'start' ? 8 : -6}
                width={bridge === 'middle' ? 60 : 46}
                y={CROWN_LINE - 10}
                height={8}
                rx={bridge === 'middle' ? 0 : 4}
              />
            )}
          </g>
        )}
      </svg>

      <span
        aria-hidden="true"
        className={cn(
          'text-[10px] font-medium leading-none tabular-nums',
          selected ? 'text-primary-600' : 'text-chart-text',
        )}
      >
        {slot.tooth}
      </span>

      {/* Selection and focus ring, over the whole slot rather than the crown:
          the number belongs to the tooth you picked. */}
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -inset-px rounded-panel border-2 border-primary-600',
          'transition-opacity duration-150',
          selected
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-40 group-focus-visible:opacity-100',
        )}
      />

      <Tooltip summary={summary} stateLabel={stateLabel} />
    </button>
  );
}

// Supplementary only: the same facts are in the tooth's accessible name, so a screen reader is not
// told them twice.
function Tooltip({
  summary,
  stateLabel,
}: {
  readonly summary: ToothSummary;
  readonly stateLabel: string;
}): JSX.Element {
  return (
    <span
      role="tooltip"
      aria-hidden="true"
      // The text follows the page even though the chart around it does not.
      dir={documentDirection()}
      className={cn(
        'pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2',
        'whitespace-nowrap rounded-pill bg-ink px-2.5 py-1 text-[11px] text-ink-inverse shadow-float',
        'opacity-0 transition-opacity duration-150',
        'group-hover:opacity-100 group-focus-visible:opacity-100',
      )}
    >
      <span className="font-semibold" dir="ltr">
        {summary.tooth}
      </span>{' '}
      · {stateLabel}
      {summary.surfaces.length > 0 && (
        <>
          {' · '}
          <span dir="ltr">{summary.surfaces.join(' ')}</span>
        </>
      )}
    </span>
  );
}

export function ToothChartSkeleton(): JSX.Element {
  return (
    <>
      <SkeletonStatus />
      <Skeleton className="h-56 w-full rounded-card sm:h-64 md:h-72" />
    </>
  );
}
