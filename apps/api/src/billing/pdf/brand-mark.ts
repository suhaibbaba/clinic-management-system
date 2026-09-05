/**
 * The brand mark, as path geometry pdf-lib can draw.
 *
 * This is a deliberate second copy of `apps/web/src/assets/logo.svg`. The API
 * cannot import from `apps/web` — they are separate packages and separate
 * images — and pdf-lib draws path geometry rather than SVG documents, so the
 * file could not be embedded verbatim even if it were reachable.
 *
 * A second copy is a chance to diverge, so `brand-mark.spec.ts` reads the web
 * logo and fails if these paths no longer match it. Replacing the logo is
 * still one file for the artwork plus this one for print, and the suite says
 * so out loud instead of letting receipts keep an old mark for months.
 *
 * Only fills and simple strokes survive the trip: gradients, embedded images
 * and text in a logo have no equivalent here. `drawBrandMark` renders what it
 * can and the letterhead stands on its own without it, so a logo this cannot
 * express costs a mark on the PDF, never a failed receipt.
 */

export interface MarkPath {
  /** SVG path data, in the mark's own viewBox coordinates. */
  readonly d: string;
  readonly fill?: readonly [number, number, number];
  readonly stroke?: readonly [number, number, number];
  readonly strokeWidth?: number;
}

/** Side of the (square) viewBox the paths are drawn in. */
export const MARK_VIEWBOX = 48;

/** #316C9C and #4EC191 — the same two brand values the web theme is built on. */
const BRAND_BLUE = [0.192, 0.424, 0.612] as const;
const BRAND_GREEN = [0.306, 0.757, 0.569] as const;

export const BRAND_MARK: readonly MarkPath[] = [
  {
    d: 'M24 4C14 4 8 10 8 19c0 8 4 13 6 21 1 4 4 5 6 3 2-2 2-9 4-9s2 7 4 9c2 2 5 1 6-3 2-8 6-13 6-21 0-9-6-15-16-15Z',
    fill: BRAND_BLUE,
  },
  {
    d: 'M17 13c2-2 5-3 8-3',
    stroke: BRAND_GREEN,
    strokeWidth: 3,
  },
];
