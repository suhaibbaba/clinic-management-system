import { FDI_DECIDUOUS_TEETH, FDI_PERMANENT_TEETH } from '@clinic/shared';

import { toothTypeOf, type ToothType } from '@web/features/patients/chart/tooth-shapes';

// Two straight rows, as a chart is drawn and the numbering read aloud. No pixel geometry here —
// flexbox and the stylesheet own that, which is what makes this testable.

export type Dentition = 'permanent' | 'deciduous';
export type Arch = 'upper' | 'lower';

export interface ToothSlot {
  readonly tooth: number;
  readonly arch: Arch;
  /** Position in its own row, counted as the viewer reads it. */
  readonly index: number;
  readonly type: ToothType;
}

// Ordered as the viewer sees them: charts are drawn from the clinician's side, so the patient's
// right (quadrants 1 and 4) is on the viewer's left.
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

export function layoutRow(dentition: Dentition, arch: Arch): ToothSlot[] {
  return archRow(dentition, arch).map((tooth, index) => ({
    tooth,
    arch,
    index,
    type: toothTypeOf(tooth, arch),
  }));
}

export function layoutTeeth(dentition: Dentition): ToothSlot[] {
  return [...layoutRow(dentition, 'upper'), ...layoutRow(dentition, 'lower')];
}

/** Arrow keys walk this list, so focus moves the way the eye does. */
export function navigationOrder(dentition: Dentition): number[] {
  return layoutTeeth(dentition).map((slot) => slot.tooth);
}
