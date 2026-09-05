import { FDI_DECIDUOUS_TEETH, FDI_PERMANENT_TEETH } from '@clinic/shared';
import { describe, expect, it } from 'vitest';

import {
  CHART_VIEWBOX,
  layoutTeeth,
  navigationOrder,
} from '@web/features/patients/chart/fdi-layout';

describe('FDI arch layout', () => {
  describe('permanent dentition', () => {
    const teeth = layoutTeeth('permanent');

    it('lays out all 32 teeth, each exactly once', () => {
      expect(teeth).toHaveLength(32);
      expect([...teeth.map((tooth) => tooth.tooth)].sort((a, b) => a - b)).toEqual(
        [...FDI_PERMANENT_TEETH].sort((a, b) => a - b),
      );
    });

    it('draws each arch from the clinician’s point of view', () => {
      // The patient's right (quadrant 1) is on the viewer's left, counting down
      // to the midline and back up through quadrant 2.
      const upper = teeth.filter((tooth) => tooth.arch === 'upper').map((tooth) => tooth.tooth);

      expect(upper).toEqual([18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]);

      const lower = teeth.filter((tooth) => tooth.arch === 'lower').map((tooth) => tooth.tooth);

      expect(lower).toEqual([48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]);
    });

    it('places the arches left to right without ever going backwards', () => {
      for (const arch of ['upper', 'lower'] as const) {
        const xs = teeth.filter((tooth) => tooth.arch === arch).map((tooth) => tooth.x);

        expect(xs).toEqual([...xs].sort((a, b) => a - b));
      }
    });

    it('keeps the upper arch above the lower one everywhere', () => {
      const lowestUpper = Math.max(
        ...teeth.filter((tooth) => tooth.arch === 'upper').map((tooth) => tooth.y),
      );
      const highestLower = Math.min(
        ...teeth.filter((tooth) => tooth.arch === 'lower').map((tooth) => tooth.y),
      );

      expect(lowestUpper).toBeLessThan(highestLower);
    });

    it('mirrors the two halves of each arch about the midline', () => {
      const midline = CHART_VIEWBOX.x + CHART_VIEWBOX.width / 2;
      const upper = teeth.filter((tooth) => tooth.arch === 'upper');

      // 18 and 28 are the same tooth on opposite sides; so are 11 and 21.
      for (const [left, right] of [
        [18, 28],
        [11, 21],
      ]) {
        const a = upper.find((tooth) => tooth.tooth === left)!;
        const b = upper.find((tooth) => tooth.tooth === right)!;

        expect(midline - a.x).toBeCloseTo(b.x - midline, 5);
        expect(a.y).toBeCloseTo(b.y, 5);
      }
    });

    it('keeps neighbouring teeth apart', () => {
      for (const arch of ['upper', 'lower'] as const) {
        const row = teeth.filter((tooth) => tooth.arch === arch);

        for (let index = 1; index < row.length; index += 1) {
          const previous = row[index - 1]!;
          const current = row[index]!;
          const gap = Math.hypot(current.x - previous.x, current.y - previous.y);

          // Centres at least a crown apart, so no two teeth overlap.
          expect(gap).toBeGreaterThan((previous.width + current.width) / 2 - 4);
        }
      }
    });

    it('gives molars a wider crown than incisors', () => {
      const molar = teeth.find((tooth) => tooth.tooth === 16)!;
      const incisor = teeth.find((tooth) => tooth.tooth === 11)!;

      expect(molar.width).toBeGreaterThan(incisor.width);
      expect(incisor.height).toBeGreaterThan(molar.height);
    });

    it('draws cusps on posterior teeth only', () => {
      expect(teeth.find((tooth) => tooth.tooth === 16)!.groove).not.toBe('');
      expect(teeth.find((tooth) => tooth.tooth === 11)!.groove).toBe('');
    });

    it('keeps every tooth and its label inside the viewBox', () => {
      for (const tooth of teeth) {
        expect(tooth.x).toBeGreaterThan(CHART_VIEWBOX.x);
        expect(tooth.x).toBeLessThan(CHART_VIEWBOX.x + CHART_VIEWBOX.width);
        expect(tooth.labelY).toBeGreaterThan(CHART_VIEWBOX.y);
        expect(tooth.labelY).toBeLessThan(CHART_VIEWBOX.y + CHART_VIEWBOX.height);
      }
    });

    it('produces a drawable path for every tooth', () => {
      for (const tooth of teeth) {
        expect(tooth.path.startsWith('M ')).toBe(true);
        expect(tooth.path.endsWith('Z')).toBe(true);
        expect(tooth.path).not.toContain('NaN');
      }
    });
  });

  describe('deciduous dentition', () => {
    const teeth = layoutTeeth('deciduous');

    it('lays out all 20 teeth', () => {
      expect(teeth).toHaveLength(20);
      expect([...teeth.map((tooth) => tooth.tooth)].sort((a, b) => a - b)).toEqual(
        [...FDI_DECIDUOUS_TEETH].sort((a, b) => a - b),
      );
    });

    it('orders each arch the same way as the permanent one', () => {
      const upper = teeth.filter((tooth) => tooth.arch === 'upper').map((tooth) => tooth.tooth);

      expect(upper).toEqual([55, 54, 53, 52, 51, 61, 62, 63, 64, 65]);
    });
  });

  it('walks the upper arch before the lower one', () => {
    const order = navigationOrder('permanent');

    expect(order[0]).toBe(18);
    expect(order[15]).toBe(28);
    expect(order[16]).toBe(48);
    expect(order[31]).toBe(38);
  });
});
