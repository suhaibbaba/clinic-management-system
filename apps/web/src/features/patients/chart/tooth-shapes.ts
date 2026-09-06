/**
 * What a tooth looks like.
 *
 * Each shape is drawn root-up in a 48×100 box with the **crown line at y=54**:
 * everything above that line is root, everything below is crown. The chart
 * relies on that split — a root canal colours the root and a crown colours the
 * crown, on the same tooth, at the same time — so the number is a contract
 * between these paths and the painting code, not an arbitrary constant.
 *
 * Roots are a list because a molar has two or three of them, and drawing them
 * separately is what makes an upper molar read as an upper molar.
 *
 * Lower teeth use the same paths flipped vertically. Anatomically a lower
 * incisor is not an upside-down upper one, but at 42px wide the difference is
 * about two pixels of crown taper, and one set of shapes that stays consistent
 * beats two sets that drift apart.
 */

/** The box every path below is drawn in. */
export const TOOTH_VIEWBOX = { width: 48, height: 100 } as const;

/** Where root meets crown. Paints are split on this line. */
export const CROWN_LINE = 54;

export type ToothType = 'incisor' | 'canine' | 'premolar' | 'molarUpper' | 'molarLower';

export interface ToothShape {
  /** One path per root: one for anteriors, two or three for molars. */
  readonly roots: readonly string[];
  readonly crown: string;
}

export const TOOTH_SHAPES: Record<ToothType, ToothShape> = {
  incisor: {
    roots: ['M24,5 C20,17 18,34 17,54 L31,54 C30,34 28,17 24,5 Z'],
    crown: 'M17,54 L31,54 C34,60 35,70 35,80 L35,92 L13,92 L13,80 C13,70 14,60 17,54 Z',
  },
  canine: {
    roots: ['M24,3 C20,16 17,34 16,54 L32,54 C31,34 28,16 24,3 Z'],
    crown:
      'M16,54 L32,54 C35,62 36,72 34,80 C32,87 28,93 24,95 C20,93 16,87 14,80 C12,72 13,62 16,54 Z',
  },
  premolar: {
    roots: ['M24,7 C20,19 17,36 16,54 L32,54 C31,36 28,19 24,7 Z'],
    crown:
      'M16,54 L32,54 C37,58 39,66 39,74 C39,84 35,91 29,91 C26,91 25,89 24,89 C23,89 22,91 19,91 C13,91 9,84 9,74 C9,66 11,58 16,54 Z',
  },
  molarLower: {
    roots: [
      'M14,9 C11,23 9,40 10,54 L21,54 C20,38 18,21 16,9 Z',
      'M34,9 C37,23 39,40 38,54 L27,54 C28,38 30,21 32,9 Z',
    ],
    crown:
      'M10,54 L38,54 C42,58 44,66 44,74 C44,84 39,92 32,92 C29,92 28,90 24,90 C20,90 19,92 16,92 C9,92 4,84 4,74 C4,66 6,58 10,54 Z',
  },
  molarUpper: {
    roots: [
      'M13,9 C10,23 8,40 9,54 L19,54 C18,38 16,21 15,9 Z',
      'M35,9 C38,23 40,40 39,54 L29,54 C30,38 32,21 33,9 Z',
      'M24,6 C22,20 21,36 21,54 L27,54 C27,36 26,20 24,6 Z',
    ],
    crown:
      'M10,54 L38,54 C42,58 44,66 44,74 C44,84 39,92 32,92 C29,92 28,90 24,90 C20,90 19,92 16,92 C9,92 4,84 4,74 C4,66 6,58 10,54 Z',
  },
};

/**
 * The implant: a threaded post in place of a root, drawn instead of one.
 *
 * A grey-filled root would say "this root is grey"; the point is that there is
 * no root — the shape has to differ, not just the colour. Kept here beside the
 * roots it replaces so the two stay in the same coordinate space.
 */
export const IMPLANT_POST = {
  body: 'M20,8 L28,8 L26,50 L22,50 Z',
  /** Thread lines, drawn slightly off horizontal so they read as a spiral. */
  threads: [16, 23, 30, 37, 44] as readonly number[],
  /** The abutment the crown seats on. */
  collar: 'M17,50 L31,50 L33,55 L15,55 Z',
} as const;

/**
 * Which of the five shapes a tooth number takes.
 *
 * Read off the FDI number's second digit, so it is the same rule for permanent
 * and deciduous teeth — except that a deciduous arch has no premolars: 54 and
 * 55 are molars, where 14 and 15 are premolars.
 */
export function toothTypeOf(tooth: number, arch: 'upper' | 'lower'): ToothType {
  const position = tooth % 10;
  const deciduous = tooth >= 50;

  if (position <= 2) {
    return 'incisor';
  }

  if (position === 3) {
    return 'canine';
  }

  if (!deciduous && position <= 5) {
    return 'premolar';
  }

  return arch === 'upper' ? 'molarUpper' : 'molarLower';
}
