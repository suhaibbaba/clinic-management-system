import { TOOTH_STATE, type ToothState } from '@clinic/shared';
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

import { layoutRow, type Dentition, type ToothSlot } from '@web/features/patients/chart/fdi-layout';
import {
  CROWN_LINE,
  IMPLANT_POST,
  TOOTH_SHAPES,
  TOOTH_VIEWBOX,
} from '@web/features/patients/chart/tooth-shapes';
import {
  areaState,
  healthyTooth,
  TOOTH_STATE_STYLES,
  toothStateLabelKey,
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

/**
 * The interactive chart: two rows of anatomical teeth, upper above lower.
 *
 * Each tooth is a real `<button>` containing its own small SVG, drawn root-up
 * and split at the crown line — so one tooth can say "root canal under a
 * crown", which is a thing mouths do and which a single fill cannot express.
 * Lower teeth are the same shapes flipped, with their numbers on the inside so
 * both rows label towards the midline.
 *
 * Three things are deliberate:
 *
 *  - **The chart never mirrors in RTL.** It is anatomy, not text: it is drawn
 *    from the clinician's point of view, with the patient's right on the
 *    viewer's left. Flipping it with the page would put the patient's right on
 *    the wrong side, which is the kind of error that ends up in the wrong
 *    tooth being treated. The rows are pinned `dir="ltr"`.
 *  - **Rows, not arches.** An earlier revision curved the teeth onto two
 *    ellipses. It was prettier and harder to read: counting "the fifth from
 *    the midline" along a curve is counting, and no two crowns were the same
 *    way up. Rows are also what every chart a dentist has used looks like.
 *  - **It scrolls rather than shrinking below a tappable size.** Sixteen teeth
 *    do not fit across a phone at a size anyone can hit, so the pair of rows
 *    scrolls together — and opens centred on the midline, because the incisors
 *    are what orients you.
 */
export function ToothChart({
  dentition,
  summaries,
  selectedTooth,
  onSelect,
}: ToothChartProps): JSX.Element {
  const { t } = useTranslation();

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

  /**
   * Arrow keys walk the rows the way the eye does — left to right, with up and
   * down crossing between the rows at the same position. The directions are
   * visual on purpose: the chart is pinned LTR, so mapping the keys to the
   * page's reading direction would send focus the wrong way in Arabic.
   */
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
          bridge={bridgeSpan(slots, slot.index, summaries)}
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
    // `dir="ltr"` on the wrapper: the chart is anatomy drawn from the
    // clinician's point of view, so it must not reorder with the page even
    // though everything around it is Arabic.
    <div
      dir="ltr"
      ref={containerRef}
      /*
       * `pt-9` is for the tooltip, not for looks.
       *
       * `overflow-x: auto` makes this a scroll container on *both* axes — CSS
       * turns the other axis's `visible` into `auto` — so a bubble sitting
       * above the top row was clipped to a black sliver at the card's edge.
       * The padding is the room it needs.
       */
      className="overflow-x-auto rounded-card border border-chart-border bg-chart-surface px-2 pb-3 pt-9"
      // Tooth width, in one place: the rows, the SVGs and the labels all size
      // off it. Small enough to fit a phone at a still-tappable 30px, roomier
      // once there is room.
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
        {/*
          The midline, the way an FDI chart draws it.

          It is the reference every quadrant is read against: everything left
          of it is the patient's right (quadrants 1 and 4), everything right of
          it is the patient's left. Without it "the fifth one" is ambiguous —
          fifth from which end? — which is the question the number is supposed
          to have already answered.

          Positioned at 50% rather than counted in teeth: both rows hold the
          same number and are centred in the same box, so the container's
          middle *is* the midline, and it stays there when the chart scrolls or
          the dentition changes from 32 teeth to 20.
        */}
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

/** Where a tooth sits in a run of bridged teeth, if it is in one. */
type BridgeSpan = 'start' | 'middle' | 'end' | null;

/**
 * A bridge is drawn as a bar joining the teeth it spans, so it reads as one
 * appliance rather than as three teeth that happen to share a colour.
 *
 * Membership is derived from adjacency: neighbouring teeth in the same row
 * that are both charted as bridge are one bridge. The record has no bridge
 * *grouping* — a procedure marks the teeth it touched and nothing links them —
 * so this is the strongest claim the data actually supports. Two separate
 * bridges that happen to be adjacent would draw as one; two bridges with a
 * healthy tooth between them draw correctly, which is the case that occurs.
 */
function bridgeSpan(
  slots: readonly ToothSlot[],
  index: number,
  summaries: ReadonlyMap<number, ToothSummary>,
): BridgeSpan {
  const isBridge = (at: number): boolean => {
    const slot = slots[at];
    return (
      slot !== undefined && summarise(summaries, slot.tooth).states.includes(TOOTH_STATE.BRIDGE)
    );
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
  bridge,
  selected,
  tabIndex,
  onSelect,
  onKeyDown,
  onFocusChange,
}: ToothProps): JSX.Element {
  const { t } = useTranslation();

  const shape = TOOTH_SHAPES[slot.type];
  const missing = summary.state === TOOTH_STATE.MISSING;
  const implant = summary.states.includes(TOOTH_STATE.IMPLANT);

  const crown = TOOTH_STATE_STYLES[areaState(summary, 'crown')];
  const root = TOOTH_STATE_STYLES[areaState(summary, 'root')];

  const label =
    summary.procedureCount === 0
      ? t('chart.toothLabel', {
          tooth: slot.tooth,
          state: t(toothStateLabelKey(summary.state)),
        })
      : t('chart.toothLabelWithCount', {
          tooth: slot.tooth,
          state: t(toothStateLabelKey(summary.state)),
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
            stroke={TOOTH_STATE_STYLES[TOOTH_STATE.MISSING].stroke}
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
              <g
                fill={TOOTH_STATE_STYLES[TOOTH_STATE.IMPLANT].fill}
                stroke={TOOTH_STATE_STYLES[TOOTH_STATE.IMPLANT].stroke}
              >
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
                fill={TOOTH_STATE_STYLES[TOOTH_STATE.BRIDGE].stroke}
                // Only the first tooth of a run keeps its bar inside its own
                // box; every other one starts 6 units early so it overlaps the
                // bar reaching towards it. Anything else leaves a hairline gap
                // between two teeth the appliance is supposed to join.
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

      <Tooltip summary={summary} />
    </button>
  );
}

/**
 * The hover bubble. Supplementary only — the same facts are already in the
 * tooth's accessible name, so a screen reader is not told them twice.
 */
function Tooltip({ summary }: { readonly summary: ToothSummary }): JSX.Element {
  const { t } = useTranslation();

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
      · {t(toothStateLabelKey(summary.state))}
      {summary.surfaces.length > 0 && (
        <>
          {' · '}
          <span dir="ltr">{summary.surfaces.join(' ')}</span>
        </>
      )}
    </span>
  );
}

/** Placeholder with about the chart's footprint, so nothing jumps. */
export function ToothChartSkeleton(): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="h-56 w-full animate-pulse rounded-card bg-sunken sm:h-64 md:h-72"
    />
  );
}

export type { ToothState };
