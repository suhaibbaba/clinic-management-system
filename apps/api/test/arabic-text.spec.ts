import { shapeArabic, visualRuns } from '@api/billing/pdf/arabic-text';

/**
 * The Arabic layer of the PDF pipeline.
 *
 * These are the two things that have to be right before a receipt is readable:
 * a letter takes the shape its neighbours give it, and a line mixing Arabic
 * with numbers comes out in the order a reader expects.
 */
describe('Arabic text', () => {
  describe('shaping', () => {
    it('gives every letter of a word its joining form', () => {
      // بحث — initial beh, medial hah, final theh.
      expect(shapeArabic('بحث')).toBe('ﺑﺤﺚ');
    });

    it('breaks the chain at a letter that never joins forward', () => {
      // مدرسة — dal takes its final form after meem but leaves reh isolated,
      // and the word joins up again from seen onwards.
      expect(shapeArabic('مدرسة')).toBe('ﻣﺪﺭﺳﺔ');
      // Neither dal nor alef joins forward, so none of these three attach.
      expect(shapeArabic('دار')).toBe('ﺩﺍﺭ');
    });

    it('folds lam-alef into its ligature', () => {
      expect(shapeArabic('لا')).toBe('ﻻ');
      // Attached to a preceding beh, the ligature takes its final form.
      expect(shapeArabic('بلا')).toBe('ﺑﻼ');
    });

    it('joins across a harakat rather than breaking on it', () => {
      const withFatha = shapeArabic('بَحث');

      expect(withFatha).toContain('ﺑ');
      expect(withFatha).toContain('َ');
      expect(withFatha).toContain('ﺤ');
    });

    it('passes Latin text and digits through untouched', () => {
      expect(shapeArabic('USD 150.00')).toBe('USD 150.00');
    });
  });

  describe('visual ordering', () => {
    it('keeps a pure Arabic line as one right-to-left run', () => {
      const runs = visualRuns('إيصال قبض');

      expect(runs).toHaveLength(1);
      expect((runs[0]?.level ?? 0) % 2).toBe(1);
    });

    it('puts a price to the left of the Arabic that introduces it', () => {
      const runs = visualRuns('المبلغ: 150.00');

      // The number is the left-to-right run and is drawn first, at the left.
      expect(runs[0]?.text).toContain('150.00');
      expect((runs[0]?.level ?? 1) % 2).toBe(0);
      expect((runs.at(-1)?.level ?? 0) % 2).toBe(1);
    });

    it('reads a date left to right inside a right-to-left line', () => {
      const runs = visualRuns('التاريخ 2026/09/05');
      const digits = runs.find((run) => run.text.includes('2026'));

      expect(digits?.text.trim()).toBe('2026/09/05');
    });

    it('has nothing to order in an empty line', () => {
      expect(visualRuns('')).toEqual([]);
    });
  });
});
