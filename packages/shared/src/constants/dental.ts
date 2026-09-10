// FDI: first digit is the quadrant, second the tooth (permanent 1-4 → 11-48, deciduous 5-8 →
// 51-85).

function quadrantRange(quadrants: readonly number[], teeth: number): number[] {
  return quadrants.flatMap((quadrant) =>
    Array.from({ length: teeth }, (_, index) => quadrant * 10 + index + 1),
  );
}

export const FDI_PERMANENT_TEETH: readonly number[] = quadrantRange([1, 2, 3, 4], 8);

export const FDI_DECIDUOUS_TEETH: readonly number[] = quadrantRange([5, 6, 7, 8], 5);

export const FDI_TEETH: readonly number[] = [...FDI_PERMANENT_TEETH, ...FDI_DECIDUOUS_TEETH];

const FDI_TOOTH_SET: ReadonlySet<number> = new Set(FDI_TEETH);

export function isFdiTooth(value: number): boolean {
  return FDI_TOOTH_SET.has(value);
}

export function isDeciduousTooth(value: number): boolean {
  return FDI_DECIDUOUS_TEETH.includes(value);
}

export const TOOTH_SURFACE = {
  MESIAL: 'M',
  DISTAL: 'D',
  OCCLUSAL: 'O',
  INCISAL: 'I',
  BUCCAL: 'B',
  LINGUAL: 'L',
  PALATAL: 'P',
} as const;

export const TOOTH_SURFACES = [
  TOOTH_SURFACE.MESIAL,
  TOOTH_SURFACE.DISTAL,
  TOOTH_SURFACE.OCCLUSAL,
  TOOTH_SURFACE.INCISAL,
  TOOTH_SURFACE.BUCCAL,
  TOOTH_SURFACE.LINGUAL,
  TOOTH_SURFACE.PALATAL,
] as const;

export type ToothSurface = (typeof TOOTH_SURFACES)[number];
