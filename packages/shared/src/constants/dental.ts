/**
 * FDI two-digit tooth notation (CLAUDE.md architecture decision 5).
 *
 * The first digit is the quadrant, the second the tooth within it:
 *   permanent  1–4 → 11–18, 21–28, 31–38, 41–48
 *   deciduous  5–8 → 51–55, 61–65, 71–75, 81–85
 *
 * Dental-specific, so it lives with the dental specialty configuration and is
 * never referenced from core, billing or appointments.
 */

function quadrantRange(quadrants: readonly number[], teeth: number): number[] {
  return quadrants.flatMap((quadrant) =>
    Array.from({ length: teeth }, (_, index) => quadrant * 10 + index + 1),
  );
}

/** 11–18, 21–28, 31–38, 41–48. */
export const FDI_PERMANENT_TEETH: readonly number[] = quadrantRange([1, 2, 3, 4], 8);

/** 51–55, 61–65, 71–75, 81–85. */
export const FDI_DECIDUOUS_TEETH: readonly number[] = quadrantRange([5, 6, 7, 8], 5);

export const FDI_TEETH: readonly number[] = [...FDI_PERMANENT_TEETH, ...FDI_DECIDUOUS_TEETH];

const FDI_TOOTH_SET: ReadonlySet<number> = new Set(FDI_TEETH);

export function isFdiTooth(value: number): boolean {
  return FDI_TOOTH_SET.has(value);
}

export function isDeciduousTooth(value: number): boolean {
  return FDI_DECIDUOUS_TEETH.includes(value);
}

/**
 * Tooth surfaces, FDI single-letter codes. Incisal applies to anterior teeth
 * and occlusal to posterior ones; both are accepted, since the distinction is a
 * clinical detail rather than something the API enforces.
 */
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
