import { FDI_DECIDUOUS_TEETH, FDI_PERMANENT_TEETH } from '@clinic/shared';

import { toothTypeOf, type ToothType } from '@web/features/patients/chart/tooth-shapes';

/**
 * Which teeth are on the chart, and in what order.
 *
 * Two straight rows — upper above, lower below — which is how a dental chart is
 * drawn and how the numbering is read aloud. An earlier revision laid the teeth
 * on two elliptical arches; it was prettier and harder to read, because finding
 * "the fifth from the midline" along a curve means counting, and the rotation
 * meant no two crowns were the same way up.
 *
 * The rows carry no pixel geometry at all. Each tooth is its own small SVG in
 * its own button, laid out by flexbox, so widths and gaps are the stylesheet's
 * business and this file is pure data — which is what makes it testable
 * without rendering anything.
 */

export type Dentition = 'permanent' | 'deciduous';
export type Arch = 'upper' | 'lower';

export interface ToothSlot {
  /** FDI number. */
  readonly tooth: number;
  readonly arch: Arch;
  /** Position in its own row, counted as the viewer reads it. */
  readonly index: number;
  /** Which shape it takes. */
  readonly type: ToothType;
}

/**
 * Teeth of one arch, ordered as the viewer sees them: left to right.
 *
 * Charts are drawn from the clinician's point of view, so the patient's right
 * (quadrants 1 and 4) appears on the viewer's left, counting down to the
 * midline and back up. This is also why the chart never mirrors in RTL — see
 * `ToothChart`.
 */
export function archRow(dentition: Dentition, arch: Arch): readonly number[] {
  const all = dentition === 'permanent' ? FDI_PERMANENT_TEETH : FDI_DECIDUOUS_TEETH;
  const quadrants = dentition === 'permanent' ? [1, 2, 3, 4] : [5, 6, 7, 8];

  const [upperRight, upperLeft, lowerLeft, lowerRight] = quadrants as [
    number,
    number,
    number,
    number,
  ];

  const inQuadrant = (quadrant: number): number[] =>
    all.filter((tooth) => Math.floor(tooth / 10) === quadrant);

  return arch === 'upper'
    ? [...inQuadrant(upperRight).reverse(), ...inQuadrant(upperLeft)]
    : [...inQuadrant(lowerRight).reverse(), ...inQuadrant(lowerLeft)];
}

/** One row, with each tooth's shape resolved. */
export function layoutRow(dentition: Dentition, arch: Arch): ToothSlot[] {
  return archRow(dentition, arch).map((tooth, index) => ({
    tooth,
    arch,
    index,
    type: toothTypeOf(tooth, arch),
  }));
}

/** Every tooth of one dentition, upper row first, each left to right. */
export function layoutTeeth(dentition: Dentition): ToothSlot[] {
  return [...layoutRow(dentition, 'upper'), ...layoutRow(dentition, 'lower')];
}

/**
 * Reading order for the keyboard: the upper row left to right, then the lower.
 * Arrow keys walk this list, so focus moves the way the eye does.
 */
export function navigationOrder(dentition: Dentition): number[] {
  return layoutTeeth(dentition).map((slot) => slot.tooth);
}
