import { useId, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@web/lib/cn';

/**
 * The five surfaces of a tooth, in the order the selector draws them.
 *
 * Codes match `TOOTH_SURFACES` in `packages/shared`, which is what the API
 * stores on a chart mark.
 */
export const SELECTABLE_SURFACES = ['B', 'M', 'O', 'D', 'L'] as const;
export type SelectableSurface = (typeof SELECTABLE_SURFACES)[number];

const BOX = 120;
const INSET = 34;

/**
 * Zone outlines: a centre square for the biting surface, with four trapezoids
 * around it. This is the schematic every dental chart uses — it is not a view
 * from any particular angle, which is why each zone is labelled by name rather
 * than left to be inferred from where it sits.
 */
const ZONES: Record<SelectableSurface, { points: string; labelX: number; labelY: number }> = {
  B: {
    points: `0,0 ${BOX},0 ${BOX - INSET},${INSET} ${INSET},${INSET}`,
    labelX: BOX / 2,
    labelY: INSET * 0.62,
  },
  M: {
    points: `0,0 ${INSET},${INSET} ${INSET},${BOX - INSET} 0,${BOX}`,
    labelX: INSET * 0.55,
    labelY: BOX / 2,
  },
  O: {
    points: `${INSET},${INSET} ${BOX - INSET},${INSET} ${BOX - INSET},${BOX - INSET} ${INSET},${BOX - INSET}`,
    labelX: BOX / 2,
    labelY: BOX / 2,
  },
  D: {
    points: `${BOX},0 ${BOX},${BOX} ${BOX - INSET},${BOX - INSET} ${BOX - INSET},${INSET}`,
    labelX: BOX - INSET * 0.55,
    labelY: BOX / 2,
  },
  L: {
    points: `0,${BOX} ${INSET},${BOX - INSET} ${BOX - INSET},${BOX - INSET} ${BOX},${BOX}`,
    labelX: BOX / 2,
    labelY: BOX - INSET * 0.55,
  },
};

export interface SurfaceSelectorProps {
  readonly value: readonly string[];
  readonly onChange?: ((surfaces: SelectableSurface[]) => void) | undefined;
  /** Read-only mode shows which surfaces are affected without offering a change. */
  readonly readOnly?: boolean | undefined;
}

/**
 * Five-zone surface picker.
 *
 * Each zone is a real toggle button, so it is reachable by keyboard and
 * announced with its own name and pressed state — a set of SVG polygons with
 * click handlers would be neither.
 */
export function SurfaceSelector({
  value,
  onChange,
  readOnly = false,
}: SurfaceSelectorProps): JSX.Element {
  const { t } = useTranslation();
  const groupId = useId();

  const toggle = (surface: SelectableSurface): void => {
    if (readOnly || !onChange) {
      return;
    }

    const next = value.filter((entry): entry is SelectableSurface =>
      SELECTABLE_SURFACES.includes(entry as SelectableSurface),
    );

    onChange(
      next.includes(surface) ? next.filter((entry) => entry !== surface) : [...next, surface],
    );
  };

  return (
    <div role="group" aria-labelledby={groupId} className="inline-flex flex-col items-center gap-2">
      <span id={groupId} className="sr-only">
        {t('chart.surfaces.legend')}
      </span>

      {/* Anatomical, not textual: the zones keep their positions in RTL, so the
          schematic is pinned LTR while the labelled buttons below follow the
          page. */}
      <svg
        viewBox={`-1 -1 ${BOX + 2} ${BOX + 2}`}
        className="size-32 select-none"
        style={{ direction: 'ltr' }}
        aria-hidden="true"
        focusable="false"
      >
        {SELECTABLE_SURFACES.map((surface) => {
          const zone = ZONES[surface];
          const selected = value.includes(surface);

          return (
            <g key={surface}>
              <polygon
                points={zone.points}
                className={cn(
                  'stroke-gray-300 transition-colors',
                  selected ? 'fill-brand-500' : 'fill-white',
                )}
                strokeWidth={1.5}
              />
              <text
                x={zone.labelX}
                y={zone.labelY}
                textAnchor="middle"
                dominantBaseline="central"
                className={cn(
                  'text-[13px] font-semibold',
                  selected ? 'fill-white' : 'fill-gray-500',
                )}
              >
                {surface}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap justify-center gap-1">
        {SELECTABLE_SURFACES.map((surface) => {
          const selected = value.includes(surface);

          return (
            <button
              key={surface}
              type="button"
              disabled={readOnly}
              aria-pressed={selected}
              onClick={() => toggle(surface)}
              className={cn(
                'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                selected
                  ? 'border-brand-600 bg-brand-500 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
                readOnly && 'cursor-default opacity-90 hover:bg-white',
              )}
            >
              {t(`chart.surfaces.${surface}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
