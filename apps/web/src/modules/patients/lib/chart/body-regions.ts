import {
  BODY_SIDE,
  CHART_TYPE,
  PAIRED_SIDES,
  PERFORMED_PROCEDURE_STATUS,
  isPairedRegion,
  type BodyRegionLocation,
  type BodySide,
  type LookupOption,
  type PerformedProcedure,
} from "@clinic/shared";

export type RegionTone = "treated" | "planned" | "none";

export interface RegionSlot {
  readonly key: string;
  readonly region: string;
  readonly side: BodySide;
}

export interface RegionSummary {
  readonly key: string;
  readonly procedureCount: number;
  readonly tone: RegionTone;
}

export function regionKey(region: string, side: BodySide | undefined): string {
  return `${region}:${side ?? BODY_SIDE.MIDLINE}`;
}

export function regionSlots(regions: readonly LookupOption[]): RegionSlot[] {
  return regions.flatMap((option) =>
    (isPairedRegion(option.meta) ? PAIRED_SIDES : [BODY_SIDE.MIDLINE]).map((side) => ({
      key: regionKey(option.code, side),
      region: option.code,
      side,
    })),
  );
}

export function treatmentRegions(
  procedure: Pick<PerformedProcedure, "chartMarks">,
): BodyRegionLocation[] {
  return (procedure.chartMarks ?? []).flatMap((mark) =>
    mark.chartType === CHART_TYPE.BODY_REGION ? [mark.location as BodyRegionLocation] : [],
  );
}

export function treatedAt(
  procedure: Pick<PerformedProcedure, "chartMarks">,
  slot: Pick<RegionSlot, "key">,
): boolean {
  return treatmentRegions(procedure).some(
    (location) => regionKey(location.region, location.side) === slot.key,
  );
}

const TREATED: readonly string[] = [
  PERFORMED_PROCEDURE_STATUS.DONE,
  PERFORMED_PROCEDURE_STATUS.IN_PROGRESS,
];

export function deriveRegionSummaries(
  procedures: readonly PerformedProcedure[],
): Map<string, RegionSummary> {
  const counts = new Map<string, { count: number; treated: boolean }>();

  for (const procedure of procedures) {
    if (procedure.status === PERFORMED_PROCEDURE_STATUS.CANCELLED) {
      continue;
    }

    const keys = new Set(
      treatmentRegions(procedure).map((location) => regionKey(location.region, location.side)),
    );

    for (const key of keys) {
      const entry = counts.get(key) ?? { count: 0, treated: false };
      entry.count += 1;
      entry.treated ||= TREATED.includes(procedure.status);
      counts.set(key, entry);
    }
  }

  return new Map(
    [...counts].map(([key, entry]) => [
      key,
      { key, procedureCount: entry.count, tone: entry.treated ? "treated" : "planned" },
    ]),
  );
}

export function regionTone(summaries: ReadonlyMap<string, RegionSummary>, key: string): RegionTone {
  return summaries.get(key)?.tone ?? "none";
}
