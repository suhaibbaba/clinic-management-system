import { FDI_DECIDUOUS_TEETH, FDI_PERMANENT_TEETH } from '@clinic/shared';
import { describe, expect, it } from 'vitest';

import {
  archRow,
  layoutRow,
  layoutTeeth,
  navigationOrder,
} from '@web/features/patients/chart/fdi-layout';
import { toothTypeOf } from '@web/features/patients/chart/tooth-shapes';

/**
 * The layout is pure data, so it is checked as data: the order teeth appear in
 * and the shape each one takes. Both are things a chart gets silently wrong —
 * a mirrored row puts the patient's right on the viewer's right, and a molar
 * drawn with one root is just a big premolar — and neither shows up in a test
 * that only counts buttons.
 */
describe('archRow', () => {
  it('runs from the patient’s right to the patient’s left', () => {
    // Charts are drawn from the clinician's point of view, so quadrant 1 is on
    // the viewer's left, counting down to the midline and back up.
    expect(archRow('permanent', 'upper')).toEqual([
      18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28,
    ]);

    expect(archRow('permanent', 'lower')).toEqual([
      48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38,
    ]);
  });

  it('does the same for the deciduous quadrants', () => {
    expect(archRow('deciduous', 'upper')).toEqual([55, 54, 53, 52, 51, 61, 62, 63, 64, 65]);
    expect(archRow('deciduous', 'lower')).toEqual([85, 84, 83, 82, 81, 71, 72, 73, 74, 75]);
  });

  it('puts the two central incisors either side of the midline', () => {
    const upper = archRow('permanent', 'upper');
    const midline = upper.length / 2;

    expect(upper[midline - 1]).toBe(11);
    expect(upper[midline]).toBe(21);
  });

  it('covers every tooth of its dentition exactly once', () => {
    const permanent = layoutTeeth('permanent').map((slot) => slot.tooth);
    const deciduous = layoutTeeth('deciduous').map((slot) => slot.tooth);

    expect([...permanent].sort()).toEqual([...FDI_PERMANENT_TEETH].sort());
    expect([...deciduous].sort()).toEqual([...FDI_DECIDUOUS_TEETH].sort());
    expect(new Set(permanent).size).toBe(32);
    expect(new Set(deciduous).size).toBe(20);
  });
});

describe('layoutRow', () => {
  it('numbers positions left to right within the row', () => {
    const row = layoutRow('permanent', 'upper');

    expect(row[0]).toMatchObject({ tooth: 18, index: 0, arch: 'upper' });
    expect(row[15]).toMatchObject({ tooth: 28, index: 15, arch: 'upper' });
  });

  it('lines the two rows up so up/down crosses to the tooth above or below', () => {
    const upper = layoutRow('permanent', 'upper');
    const lower = layoutRow('permanent', 'lower');

    // Same index, same side of the mouth, same position in the quadrant.
    expect(lower[upper.findIndex((slot) => slot.tooth === 16)]?.tooth).toBe(46);
    expect(lower[upper.findIndex((slot) => slot.tooth === 21)]?.tooth).toBe(31);
  });
});

describe('toothTypeOf', () => {
  it('reads the type off the FDI position', () => {
    expect(toothTypeOf(11, 'upper')).toBe('incisor');
    expect(toothTypeOf(12, 'upper')).toBe('incisor');
    expect(toothTypeOf(13, 'upper')).toBe('canine');
    expect(toothTypeOf(14, 'upper')).toBe('premolar');
    expect(toothTypeOf(15, 'upper')).toBe('premolar');
  });

  it('gives upper molars three roots and lower molars two', () => {
    expect(toothTypeOf(16, 'upper')).toBe('molarUpper');
    expect(toothTypeOf(46, 'lower')).toBe('molarLower');
  });

  it('has no deciduous premolars: 54 and 55 are molars', () => {
    // The one place the rule differs between dentitions — a child's arch goes
    // canine straight to molar.
    expect(toothTypeOf(54, 'upper')).toBe('molarUpper');
    expect(toothTypeOf(55, 'upper')).toBe('molarUpper');
    expect(toothTypeOf(84, 'lower')).toBe('molarLower');
    expect(toothTypeOf(53, 'upper')).toBe('canine');
  });
});

describe('navigationOrder', () => {
  it('reads the upper row, then the lower, each left to right', () => {
    const order = navigationOrder('permanent');

    expect(order).toHaveLength(32);
    expect(order.slice(0, 3)).toEqual([18, 17, 16]);
    expect(order.slice(16, 19)).toEqual([48, 47, 46]);
  });
});
