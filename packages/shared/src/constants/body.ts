export const BODY_SIDE = {
  RIGHT: "right",
  LEFT: "left",
  MIDLINE: "midline",
} as const;

export type BodySide = (typeof BODY_SIDE)[keyof typeof BODY_SIDE];

export const BODY_SIDES = [BODY_SIDE.RIGHT, BODY_SIDE.LEFT, BODY_SIDE.MIDLINE] as const;

export const PAIRED_SIDES: readonly BodySide[] = [BODY_SIDE.RIGHT, BODY_SIDE.LEFT];

export interface BodyRegionMeta {
  readonly paired?: boolean;
}

export function isPairedRegion(meta: Record<string, unknown> | null | undefined): boolean {
  return (meta as BodyRegionMeta | null | undefined)?.paired === true;
}
