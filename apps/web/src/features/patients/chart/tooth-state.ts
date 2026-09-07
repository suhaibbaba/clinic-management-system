import {
  LOOKUP_LIST,
  lookupLabel,
  PERFORMED_PROCEDURE_STATUS,
  TOOTH_STATE,
  type LookupOption,
  type PerformedProcedure,
  type ProcedureOutcome,
  type ToothArea,
  type ToothChartBehaviour,
  type ToothState,
} from '@clinic/shared';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useLookupList } from '@web/features/lookups/queries';

/**
 * How a tooth gets its colour.
 *
 * The state is derived from the record on every render — it is never stored, so
 * it cannot drift out of step with the procedures it summarises (CLAUDE.md:
 * nothing that can be computed is kept as an editable field).
 *
 * Two inputs decide it:
 *  - the procedure's **status**: still planned, or under way
 *  - the catalog item's **chart outcome**: what a finished procedure leaves
 *    behind — a filling, a crown, an extraction
 *
 * The states themselves are the clinic's `tooth_state` list, not a fixed set:
 * a clinic adds "veneer" with a colour in settings and the chart paints it,
 * with no code change and no deploy. What stays in code is the handful of
 * built-in codes the drawing itself is written against — a missing tooth is a
 * dashed outline, an implant is a post, a bridge is a bar between crowns — and
 * those rows cannot be deleted, which is what makes reading them safe.
 */

/**
 * Which state wins when several procedures touch one tooth, most significant
 * first.
 *
 * The order answers "what is true of this tooth right now?".
 *
 * A replacement outranks the extraction it replaced — a site that was extracted
 * and then implanted is an implant, not a gap, and reading it as a gap is how a
 * chart ends up disagreeing with the mouth. Absence comes next, then work that
 * is under way or waiting, because that is what the appointment is about.
 * Finished restorations rank last: they are history, and the panel lists every
 * one of them in full whatever the tooth is coloured.
 *
 * A clinic's own states are restorations too, so they slot in with the rest of
 * the finished work, in the order the clinic put them in — see `precedenceOf`.
 */
const BUILTIN_PRECEDENCE: readonly string[] = [
  TOOTH_STATE.IMPLANT,
  TOOTH_STATE.BRIDGE,
  TOOTH_STATE.MISSING,
  TOOTH_STATE.IN_PROGRESS,
  TOOTH_STATE.PLANNED,
  TOOTH_STATE.CROWN,
  TOOTH_STATE.ROOT_CANAL,
  TOOTH_STATE.FILLING,
];

/**
 * CSS variables from `index.css`, one per state. Kept as variable names rather
 * than hex values so light and dark mode are decided by the stylesheet — the
 * component never branches on a theme.
 */
export interface ToothStateStyle {
  /** Interior colour. */
  readonly fill: string;
  /** Outline colour; distinct only where the fill alone would not read. */
  readonly stroke: string;
  /** Colour of the tooth number drawn on top of the fill. */
  readonly ink: string;
  /** Dashed outline marks an absent tooth — a shape difference, not a hue. */
  readonly dashed: boolean;
}

/** A saturated fill that carries white ink and needs no separate outline. */
const FILLED = (token: string): ToothStateStyle => ({
  fill: `var(--color-tooth-${token})`,
  stroke: `var(--color-tooth-${token})`,
  ink: 'var(--color-tooth-ink)',
  dashed: false,
});

/**
 * A pale fill, which needs two things a saturated one does not: a darker
 * outline so the tooth still has an edge against the chart surface, and dark
 * ink so the tooth number stays legible on it.
 */
const PALE = (token: string): ToothStateStyle => ({
  fill: `var(--color-tooth-${token})`,
  stroke: `var(--color-tooth-${token}-line)`,
  ink: 'var(--color-tooth-ink-dark)',
  dashed: false,
});

/**
 * The theme's own palette, for the states that ship with the system.
 *
 * These are deliberately not hex values on the lookup rows: they are the pair
 * of colours the stylesheet defines for light and for dark mode, and freezing
 * one of them into the database would make the chart unreadable in the other.
 * An admin who picks a colour for one of these rows overrides this — their
 * choice wins, in both modes, which is what picking a colour means.
 */
export const BUILTIN_STYLES: Record<string, ToothStateStyle> = {
  [TOOTH_STATE.HEALTHY]: {
    fill: 'var(--color-tooth-healthy)',
    stroke: 'var(--color-tooth-healthy-line)',
    ink: 'var(--color-tooth-ink-muted)',
    dashed: false,
  },
  [TOOTH_STATE.PLANNED]: FILLED('planned'),
  [TOOTH_STATE.IN_PROGRESS]: FILLED('in-progress'),
  [TOOTH_STATE.FILLING]: FILLED('filling'),
  [TOOTH_STATE.ROOT_CANAL]: FILLED('root-canal'),
  [TOOTH_STATE.CROWN]: PALE('crown'),
  [TOOTH_STATE.IMPLANT]: FILLED('implant'),
  [TOOTH_STATE.BRIDGE]: PALE('bridge'),
  [TOOTH_STATE.MISSING]: {
    fill: 'var(--color-tooth-missing)',
    stroke: 'var(--color-tooth-missing-line)',
    ink: 'var(--color-tooth-ink-muted)',
    dashed: true,
  },
};

/** What the chart falls back to for a code with no row and no built-in style. */
const UNKNOWN_STYLE: ToothStateStyle = BUILTIN_STYLES[TOOTH_STATE.HEALTHY] as ToothStateStyle;

/**
 * A colour the clinic picked, turned into a full style.
 *
 * The ink is chosen by the colour's own brightness rather than by asking for a
 * second colour: nobody setting up "veneer" should have to think about label
 * contrast, and getting it wrong makes the tooth number vanish.
 */
function customStyle(colour: string): ToothStateStyle {
  return {
    fill: colour,
    stroke: colour,
    ink: isLight(colour) ? 'var(--color-tooth-ink-dark)' : 'var(--color-tooth-ink)',
    dashed: false,
  };
}

/** Rec. 601 luma, which is close enough to decide black text or white. */
function isLight(colour: string): boolean {
  const hex = colour.trim().replace('#', '');
  const full =
    hex.length === 3
      ? [...hex].map((channel) => channel + channel).join('')
      : hex.slice(0, 6).padEnd(6, '0');
  const value = Number.parseInt(full, 16);

  /* istanbul ignore next -- the colour picker cannot produce a non-hex value. */
  if (Number.isNaN(value)) {
    return false;
  }

  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255];

  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}

/** Everything the chart needs about one state, colour and shape together. */
export interface ToothStateInfo {
  readonly code: string;
  /** In the reader's language, from the clinic's own row. */
  readonly label: string;
  readonly style: ToothStateStyle;
  readonly area: ToothArea;
  /** Set only on the built-in states the drawing is written against. */
  readonly shape: ToothChartBehaviour['shape'];
}

/**
 * The clinic's tooth states, resolved: colour, shape, label and precedence.
 *
 * One object rather than four exported maps, because every one of them has to
 * agree about the same list — and because it is what a component receives when
 * the list is data rather than a constant.
 */
export interface ToothStates {
  /** Never undefined: a code with no row still draws, in the neutral style. */
  info(code: string): ToothStateInfo;
  /** In the order the clinic arranged them, for the legend. */
  readonly all: readonly ToothStateInfo[];
  /** Every code, most significant first. */
  readonly precedence: readonly string[];
  /** The most significant of several states. */
  dominant(codes: readonly string[]): string;
}

const HEALTHY = TOOTH_STATE.HEALTHY;

export function buildToothStates(options: readonly LookupOption[], language: string): ToothStates {
  const infos = options.map((option): ToothStateInfo => {
    const behaviour = chartBehaviour(option.meta);

    return {
      code: option.code,
      label: lookupLabel(option, language),
      style: option.color
        ? customStyle(option.color)
        : (BUILTIN_STYLES[option.code] ?? UNKNOWN_STYLE),
      // A custom state paints the whole tooth: the chart cannot know that
      // somebody's new "veneer" belongs on the crown, and guessing would put
      // it in the wrong place.
      area: behaviour?.area ?? 'whole',
      shape: behaviour?.shape,
    };
  });

  const byCode = new Map(infos.map((info) => [info.code, info]));

  const custom = infos
    .map((info) => info.code)
    .filter((code) => code !== HEALTHY && !BUILTIN_PRECEDENCE.includes(code));

  const precedence = [...BUILTIN_PRECEDENCE, ...custom, HEALTHY];

  return {
    info: (code) =>
      byCode.get(code) ?? {
        code,
        label: code,
        style: UNKNOWN_STYLE,
        area: 'whole',
        shape: undefined,
      },
    all: infos,
    precedence,
    dominant: (codes) => precedence.find((candidate) => codes.includes(candidate)) ?? HEALTHY,
  };
}

/** Reads the chart's half of a tooth-state row's `meta`, if it has one. */
function chartBehaviour(meta: unknown): ToothChartBehaviour | undefined {
  const behaviour = (meta as { chartBehavior?: unknown } | null)?.chartBehavior;

  return typeof behaviour === 'object' && behaviour !== null
    ? (behaviour as ToothChartBehaviour)
    : undefined;
}

/** The clinic's states, from the cached lookup bundle, in the reader's language. */
export function useToothStates(): ToothStates {
  const options = useLookupList(LOOKUP_LIST.TOOTH_STATE);
  const { i18n } = useTranslation();
  const language = i18n.language;

  return useMemo(() => buildToothStates(options, language), [options, language]);
}

/**
 * The state that paints one half of a tooth: the most significant state that
 * belongs to that half, or that belongs to the whole tooth.
 *
 * Falls back to healthy, so a tooth with only a crown recorded still has a
 * root drawn in the healthy fill rather than an unpainted hole.
 */
export function areaState(
  summary: ToothSummary,
  area: 'crown' | 'root',
  states: ToothStates,
): string {
  return (
    summary.states.find((state) => {
      const stateArea = states.info(state).area;
      return stateArea === area || stateArea === 'whole';
    }) ?? HEALTHY
  );
}

/** True when the tooth carries a state the drawing has a special shape for. */
export function hasShape(
  summary: ToothSummary,
  shape: NonNullable<ToothChartBehaviour['shape']>,
  states: ToothStates,
): boolean {
  return summary.states.some((state) => states.info(state).shape === shape);
}

/** Everything the chart knows about one tooth. */
export interface ToothSummary {
  readonly tooth: number;
  readonly state: ToothState;
  /** Every state present on the tooth, in precedence order. */
  readonly states: readonly ToothState[];
  /** Surface codes touched by any procedure on this tooth. */
  readonly surfaces: readonly string[];
  readonly procedureCount: number;
}

/** Lookup from a catalog item id to what it charts as when finished. */
export type OutcomeLookup = ReadonlyMap<string, ProcedureOutcome | null>;

/**
 * What one procedure says about the tooth it was recorded on.
 *
 * A procedure that is planned or under way says so whatever it will eventually
 * become. Once it is done, the catalog's classification decides; a procedure
 * that charts nothing — an examination, a cleaning — leaves the tooth as it was
 * and returns `null`.
 */
export function procedureToothState(
  procedure: Pick<PerformedProcedure, 'status' | 'procedureId'>,
  outcomes: OutcomeLookup,
): ToothState | null {
  if (procedure.status === PERFORMED_PROCEDURE_STATUS.PLANNED) {
    return TOOTH_STATE.PLANNED;
  }

  if (procedure.status === PERFORMED_PROCEDURE_STATUS.IN_PROGRESS) {
    return TOOTH_STATE.IN_PROGRESS;
  }

  return outcomes.get(procedure.procedureId) ?? null;
}

/**
 * Folds a patient's procedures into one summary per tooth.
 *
 * Only procedures carrying a chart mark reach a tooth: an X-ray of the whole
 * jaw or a cleaning of the whole mouth has no location and colours nothing.
 * Teeth with nothing recorded are simply absent from the map and render as
 * healthy.
 */
export function deriveToothSummaries(
  procedures: readonly PerformedProcedure[],
  outcomes: OutcomeLookup,
  states: ToothStates,
): Map<number, ToothSummary> {
  const byTooth = new Map<number, { states: ToothState[]; surfaces: Set<string>; count: number }>();

  for (const procedure of procedures) {
    const state = procedureToothState(procedure, outcomes);

    for (const mark of procedure.chartMarks ?? []) {
      const location = mark.location as { tooth?: number; surfaces?: string[] };

      if (typeof location.tooth !== 'number') {
        continue;
      }

      const entry = byTooth.get(location.tooth) ?? {
        states: [],
        surfaces: new Set<string>(),
        count: 0,
      };

      entry.count += 1;
      if (state) {
        entry.states.push(state);
      }
      for (const surface of location.surfaces ?? []) {
        entry.surfaces.add(surface);
      }

      byTooth.set(location.tooth, entry);
    }
  }

  const summaries = new Map<number, ToothSummary>();

  for (const [tooth, entry] of byTooth) {
    summaries.set(tooth, {
      tooth,
      state: states.dominant(entry.states),
      // Precedence order, so the crown/root split reads the most significant
      // state for each half first.
      states: states.precedence.filter((state) => entry.states.includes(state)),
      surfaces: [...entry.surfaces],
      procedureCount: entry.count,
    });
  }

  return summaries;
}

/** Summary for a tooth nothing has been recorded on. */
export function healthyTooth(tooth: number): ToothSummary {
  return {
    tooth,
    state: HEALTHY,
    states: [HEALTHY],
    surfaces: [],
    procedureCount: 0,
  };
}
