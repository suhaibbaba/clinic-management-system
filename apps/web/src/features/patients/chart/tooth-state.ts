import {
  PERFORMED_PROCEDURE_STATUS,
  TOOTH_STATE,
  TOOTH_STATES,
  type PerformedProcedure,
  type ProcedureOutcome,
  type ToothState,
} from '@clinic/shared';

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
 * Nothing here reads a procedure's name, so a clinic can add "veneer" to its
 * catalog, classify it as a crown, and the chart colours it without a code
 * change (CLAUDE.md architecture decision 1).
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
 */
export const TOOTH_STATE_PRECEDENCE: readonly ToothState[] = [
  TOOTH_STATE.IMPLANT,
  TOOTH_STATE.BRIDGE,
  TOOTH_STATE.MISSING,
  TOOTH_STATE.IN_PROGRESS,
  TOOTH_STATE.PLANNED,
  TOOTH_STATE.CROWN,
  TOOTH_STATE.ROOT_CANAL,
  TOOTH_STATE.FILLING,
  TOOTH_STATE.HEALTHY,
];

/**
 * CSS variables from `index.css`, one per state. Kept as variable names rather
 * than hex values so light and dark mode are decided by the stylesheet — the
 * component never branches on a theme.
 */
interface ToothStateStyle {
  /** Interior colour. */
  readonly fill: string;
  /** Outline colour; distinct only where the fill alone would not read. */
  readonly stroke: string;
  /** Colour of the tooth number drawn on top of the fill. */
  readonly ink: string;
  /** Dashed outline marks an absent tooth — a shape difference, not a hue. */
  readonly dashed: boolean;
}

const FILLED = (token: string): ToothStateStyle => ({
  fill: `var(--color-tooth-${token})`,
  stroke: `var(--color-tooth-${token})`,
  ink: 'var(--color-tooth-ink)',
  dashed: false,
});

/**
 * The colour map. One entry per state, and the only place a state is turned
 * into a colour — the chart, the legend, the tooltip and the panel all read it,
 * so they can never disagree.
 */
export const TOOTH_STATE_STYLES: Record<ToothState, ToothStateStyle> = {
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
  [TOOTH_STATE.CROWN]: FILLED('crown'),
  [TOOTH_STATE.IMPLANT]: FILLED('implant'),
  [TOOTH_STATE.BRIDGE]: FILLED('bridge'),
  [TOOTH_STATE.MISSING]: {
    fill: 'var(--color-tooth-missing)',
    stroke: 'var(--color-tooth-missing-line)',
    ink: 'var(--color-tooth-ink-muted)',
    dashed: true,
  },
};

/** i18n key for a state's label, used by the chart, legend and tooltip alike. */
export const toothStateLabelKey = (state: ToothState): string => `chart.states.${state}`;

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

/** The most significant of several states (see `TOOTH_STATE_PRECEDENCE`). */
export function dominantState(states: readonly ToothState[]): ToothState {
  for (const candidate of TOOTH_STATE_PRECEDENCE) {
    if (states.includes(candidate)) {
      return candidate;
    }
  }

  return TOOTH_STATE.HEALTHY;
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
      state: dominantState(entry.states),
      states: TOOTH_STATE_PRECEDENCE.filter((state) => entry.states.includes(state)),
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
    state: TOOTH_STATE.HEALTHY,
    states: [TOOTH_STATE.HEALTHY],
    surfaces: [],
    procedureCount: 0,
  };
}

/** States in the order the legend lists them: the precedence order, reversed. */
export const LEGEND_STATES: readonly ToothState[] = TOOTH_STATES;
