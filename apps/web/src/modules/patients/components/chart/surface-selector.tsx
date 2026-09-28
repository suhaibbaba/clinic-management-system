import { useId, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@clinic/ui/lib/cn";
import { SELECTABLE_SURFACES, SURFACE_BOX, SURFACE_INSET } from "@web/modules/patients/constants";
export type SelectableSurface = (typeof SELECTABLE_SURFACES)[number];

const ZONES: Record<SelectableSurface, { points: string; labelX: number; labelY: number }> = {
  B: {
    points: `0,0 ${SURFACE_BOX},0 ${SURFACE_BOX - SURFACE_INSET},${SURFACE_INSET} ${SURFACE_INSET},${SURFACE_INSET}`,
    labelX: SURFACE_BOX / 2,
    labelY: SURFACE_INSET * 0.62,
  },
  M: {
    points: `0,0 ${SURFACE_INSET},${SURFACE_INSET} ${SURFACE_INSET},${SURFACE_BOX - SURFACE_INSET} 0,${SURFACE_BOX}`,
    labelX: SURFACE_INSET * 0.55,
    labelY: SURFACE_BOX / 2,
  },
  O: {
    points: `${SURFACE_INSET},${SURFACE_INSET} ${SURFACE_BOX - SURFACE_INSET},${SURFACE_INSET} ${SURFACE_BOX - SURFACE_INSET},${SURFACE_BOX - SURFACE_INSET} ${SURFACE_INSET},${SURFACE_BOX - SURFACE_INSET}`,
    labelX: SURFACE_BOX / 2,
    labelY: SURFACE_BOX / 2,
  },
  D: {
    points: `${SURFACE_BOX},0 ${SURFACE_BOX},${SURFACE_BOX} ${SURFACE_BOX - SURFACE_INSET},${SURFACE_BOX - SURFACE_INSET} ${SURFACE_BOX - SURFACE_INSET},${SURFACE_INSET}`,
    labelX: SURFACE_BOX - SURFACE_INSET * 0.55,
    labelY: SURFACE_BOX / 2,
  },
  L: {
    points: `0,${SURFACE_BOX} ${SURFACE_INSET},${SURFACE_BOX - SURFACE_INSET} ${SURFACE_BOX - SURFACE_INSET},${SURFACE_BOX - SURFACE_INSET} ${SURFACE_BOX},${SURFACE_BOX}`,
    labelX: SURFACE_BOX / 2,
    labelY: SURFACE_BOX - SURFACE_INSET * 0.55,
  },
};

export interface SurfaceSelectorProps {
  readonly value: readonly string[];
  readonly onChange?: ((surfaces: SelectableSurface[]) => void) | undefined;
  readonly readOnly?: boolean | undefined;
}

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
    <div
      role="group"
      data-testid="surface-selector"
      aria-labelledby={groupId}
      className="inline-flex flex-col items-center gap-2"
    >
      <span id={groupId} className="sr-only">
        {t("chart.surfaces.legend")}
      </span>

      <svg
        viewBox={`-1 -1 ${SURFACE_BOX + 2} ${SURFACE_BOX + 2}`}
        className="size-32 select-none"
        style={{ direction: "ltr" }}
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
                  "stroke-line-strong transition-colors",
                  selected ? "fill-primary-600" : "fill-ink-inverse",
                )}
                strokeWidth={1.5}
              />
              <text
                x={zone.labelX}
                y={zone.labelY}
                textAnchor="middle"
                dominantBaseline="central"
                className={cn(
                  "text-meta font-medium",
                  selected ? "fill-ink-inverse" : "fill-ink-muted",
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
              data-testid={`surface-${surface}`}
              disabled={readOnly}
              aria-pressed={selected}
              onClick={() => toggle(surface)}
              className={cn(
                "cursor-pointer rounded-control border px-2.5 py-1 text-label font-medium",
                "[transition:background-color_250ms_ease-in-out,border-color_250ms_ease-in-out,scale_120ms_ease-out] active:scale-95",
                selected
                  ? "border-primary-600 bg-primary-600 text-ink-inverse"
                  : "border-line-strong bg-surface text-ink hover:border-primary-300 hover:bg-inset",
                readOnly && "cursor-default opacity-90 hover:bg-surface active:scale-100",
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
