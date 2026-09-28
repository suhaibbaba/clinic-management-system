import {
  lookupLabel,
  PERFORMED_PROCEDURE_STATUS,
  TOOTH_STATE,
  type LookupOption,
  type PerformedProcedure,
  type ProcedureOutcome,
  type ToothArea,
  type ToothChartBehaviour,
  type ToothState,
} from "@clinic/shared";

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

export interface ToothStateStyle {
  readonly fill: string;
  readonly stroke: string;
  readonly ink: string;
  readonly dashed: boolean;
}

const FILLED = (token: string): ToothStateStyle => ({
  fill: `var(--color-tooth-${token})`,
  stroke: `var(--color-tooth-${token})`,
  ink: "var(--color-tooth-ink)",
  dashed: false,
});

const PALE = (token: string): ToothStateStyle => ({
  fill: `var(--color-tooth-${token})`,
  stroke: `var(--color-tooth-${token}-line)`,
  ink: "var(--color-tooth-ink-dark)",
  dashed: false,
});

export const BUILTIN_STYLES: Record<string, ToothStateStyle> = {
  [TOOTH_STATE.HEALTHY]: {
    fill: "var(--color-tooth-healthy)",
    stroke: "var(--color-tooth-healthy-line)",
    ink: "var(--color-tooth-ink-muted)",
    dashed: false,
  },
  [TOOTH_STATE.PLANNED]: FILLED("planned"),
  [TOOTH_STATE.IN_PROGRESS]: FILLED("in-progress"),
  [TOOTH_STATE.FILLING]: FILLED("filling"),
  [TOOTH_STATE.ROOT_CANAL]: FILLED("root-canal"),
  [TOOTH_STATE.CROWN]: PALE("crown"),
  [TOOTH_STATE.IMPLANT]: FILLED("implant"),
  [TOOTH_STATE.BRIDGE]: PALE("bridge"),
  [TOOTH_STATE.MISSING]: {
    fill: "var(--color-tooth-missing)",
    stroke: "var(--color-tooth-missing-line)",
    ink: "var(--color-tooth-ink-muted)",
    dashed: true,
  },
};

const UNKNOWN_STYLE: ToothStateStyle = BUILTIN_STYLES[TOOTH_STATE.HEALTHY] as ToothStateStyle;

function customStyle(colour: string): ToothStateStyle {
  return {
    fill: colour,
    stroke: colour,
    ink: isLight(colour) ? "var(--color-tooth-ink-dark)" : "var(--color-tooth-ink)",
    dashed: false,
  };
}

function isLight(colour: string): boolean {
  const hex = colour.trim().replace("#", "");
  const full =
    hex.length === 3
      ? [...hex].map((channel) => channel + channel).join("")
      : hex.slice(0, 6).padEnd(6, "0");
  const value = Number.parseInt(full, 16);

  if (Number.isNaN(value)) {
    return false;
  }

  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255];

  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}

export interface ToothStateInfo {
  readonly code: string;
  readonly label: string;
  readonly style: ToothStateStyle;
  readonly area: ToothArea;
  readonly shape: ToothChartBehaviour["shape"];
}

export interface ToothStates {
  info(code: string): ToothStateInfo;
  readonly all: readonly ToothStateInfo[];
  readonly precedence: readonly string[];
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
      area: behaviour?.area ?? "whole",
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
        area: "whole",
        shape: undefined,
      },
    all: infos,
    precedence,
    dominant: (codes) => precedence.find((candidate) => codes.includes(candidate)) ?? HEALTHY,
  };
}

function chartBehaviour(meta: unknown): ToothChartBehaviour | undefined {
  const behaviour = (meta as { chartBehavior?: unknown } | null)?.chartBehavior;

  return typeof behaviour === "object" && behaviour !== null
    ? (behaviour as ToothChartBehaviour)
    : undefined;
}

export function areaState(
  summary: ToothSummary,
  area: "crown" | "root",
  states: ToothStates,
): string {
  return (
    summary.states.find((state) => {
      const stateArea = states.info(state).area;
      return stateArea === area || stateArea === "whole";
    }) ?? HEALTHY
  );
}

export function hasShape(
  summary: ToothSummary,
  shape: NonNullable<ToothChartBehaviour["shape"]>,
  states: ToothStates,
): boolean {
  return summary.states.some((state) => states.info(state).shape === shape);
}

export interface ToothSummary {
  readonly tooth: number;
  readonly state: ToothState;
  readonly states: readonly ToothState[];
  readonly surfaces: readonly string[];
  readonly procedureCount: number;
}

export type OutcomeLookup = ReadonlyMap<string, ProcedureOutcome | null>;

export function procedureToothState(
  procedure: Pick<PerformedProcedure, "status" | "procedureId">,
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

      if (typeof location.tooth !== "number") {
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
      states: states.precedence.filter((state) => entry.states.includes(state)),
      surfaces: [...entry.surfaces],
      procedureCount: entry.count,
    });
  }

  return summaries;
}

export function healthyTooth(tooth: number): ToothSummary {
  return {
    tooth,
    state: HEALTHY,
    states: [HEALTHY],
    surfaces: [],
    procedureCount: 0,
  };
}
