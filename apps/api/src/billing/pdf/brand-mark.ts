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
 * What is copied is the emblem — every path the artwork draws itself. The
 * wordmark beside it is not: the logo sets it as glyph outlines, and the
 * letterhead already prints the clinic's own name in its own script directly
 * under this. Printing a second, Latin, name of the software over it would be
 * the wrong name in the wrong language.
 *
 * Only fills and simple strokes survive the trip: gradients, embedded images
 * and text in a logo have no equivalent here. `RtlPdf.mark` renders what it
 * can and the letterhead stands on its own without it, so a logo this cannot
 * express costs a mark on the PDF, never a failed receipt.
 *
 * This is the *fallback*. A clinic that has uploaded its own logo gets that
 * one on its documents; this is what prints until it does.
 */

export interface MarkPath {
  /** SVG path data, in the mark's own viewBox coordinates. */
  readonly d: string;
  readonly fill?: readonly [number, number, number];
  readonly stroke?: readonly [number, number, number];
  readonly strokeWidth?: number;
}

/**
 * The emblem's own box inside the logo's coordinate space.
 *
 * The paths below keep the coordinates the artwork gave them, so the box says
 * where they actually are rather than asking anybody to shift them: `mark`
 * translates and scales by this, and re-copying the logo means copying its
 * numbers unchanged.
 */
export interface MarkViewBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const MARK_VIEWBOX: MarkViewBox = {
  x: 83.8633,
  y: 130.9219,
  width: 568.8906,
  height: 325.2695,
};

/** The logo's own two values, as pdf-lib wants them: 0–1 per channel. */
const BRAND_BLUE = [0.1923, 0.4254, 0.6104] as const;
const BRAND_GREEN = [0.304, 0.758, 0.5689] as const;

export const BRAND_MARK: readonly MarkPath[] = [
  {
    d:
      'M 265.75 139.773438 C 265.75 139.773438 242.296875 183.144531 170.601562 165.882812 C 98.910156 ' +
      '148.625 89.175781 168.097656 86.519531 183.585938 C 83.863281 199.074219 88.289062 257.492188 ' +
      '96.253906 284.929688 C 104.222656 312.367188 123.695312 399.546875 154.671875 418.574219 C ' +
      '154.671875 418.574219 178.125 433.621094 195.828125 365.914062 C 213.527344 298.203125 ' +
      '242.738281 301.746094 242.738281 301.746094 C 242.738281 301.746094 220.167969 291.566406 ' +
      '201.136719 315.464844 C 182.109375 339.359375 169.71875 402.644531 153.785156 379.191406 C ' +
      '137.855469 355.734375 117.496094 303.515625 115.726562 281.828125 C 113.957031 260.144531 ' +
      '93.601562 192.878906 140.511719 182.257812 C 140.511719 182.257812 221.054688 199.074219 ' +
      '243.179688 174.734375 C 265.308594 150.394531 265.75 139.773438 265.75 139.773438',
    fill: BRAND_BLUE,
  },
  {
    d:
      'M 152.015625 195.976562 C 152.015625 195.976562 176.355469 227.398438 253.800781 179.160156 C ' +
      '331.246094 130.921875 352.046875 164.3125 347.621094 206.035156 L 377.710938 211.464844 L ' +
      '317.085938 211.464844 C 317.085938 211.464844 311.332031 174.292969 269.289062 194.648438 C ' +
      '227.25 215.003906 168.832031 228.726562 152.015625 195.976562',
    fill: BRAND_GREEN,
  },
  {
    d:
      'M 224.59375 334.933594 C 224.59375 334.933594 245.835938 350.867188 255.128906 403.53125 C ' +
      '264.421875 456.191406 302.039062 389.367188 302.039062 389.367188 L 313.101562 365.914062 L ' +
      '652.753906 359.273438 L 294.292969 357.285156 C 294.292969 357.285156 279.027344 417.691406 ' +
      '259.777344 380.960938 C 240.523438 344.230469 244.507812 334.933594 224.59375 334.933594',
    fill: BRAND_GREEN,
  },
  {
    d:
      'M 391.199219 171.558594 C 391.199219 171.558594 389.457031 190.226562 409.121094 189.230469 C ' +
      '409.121094 189.230469 391.585938 189.230469 390.867188 206.90625 C 390.867188 206.90625 ' +
      '389.152344 190.28125 373 189.507812 C 373 189.507812 391.613281 190.308594 391.199219 171.558594',
    fill: BRAND_BLUE,
  },
  {
    d:
      'M 372.0625 132.65625 C 372.0625 132.65625 370.320312 151.328125 389.984375 150.332031 C ' +
      '389.984375 150.332031 372.449219 150.332031 371.730469 168.007812 C 371.730469 168.007812 ' +
      '370.015625 151.382812 353.863281 150.609375 C 353.863281 150.609375 372.476562 151.410156 ' +
      '372.0625 132.65625',
    fill: BRAND_BLUE,
  },
  {
    d:
      'M 238.144531 242.871094 C 238.144531 242.871094 236.402344 261.542969 256.070312 260.546875 C ' +
      '256.070312 260.546875 238.535156 260.546875 237.8125 278.21875 C 237.8125 278.21875 236.097656 ' +
      '261.597656 219.945312 260.820312 C 219.945312 260.820312 238.558594 261.625 238.144531 ' +
      '242.871094',
    fill: BRAND_BLUE,
  },
];
