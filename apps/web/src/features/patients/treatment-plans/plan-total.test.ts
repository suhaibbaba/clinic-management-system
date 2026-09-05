import { describe, expect, it } from 'vitest';

import { planRemaining, planTotal } from '@web/features/patients/treatment-plans/plan-total';
import { makePlanItem } from '@test/helpers/fixtures';

describe('treatment plan totals', () => {
  it('is zero for an empty plan', () => {
    expect(planTotal([])).toBe('0.00');
  });

  it('sums the quoted prices', () => {
    const items = [
      makePlanItem({ id: '1', estimatedPrice: '40.00' }),
      makePlanItem({ id: '2', estimatedPrice: '45.00' }),
      makePlanItem({ id: '3', estimatedPrice: '250.00' }),
    ];

    expect(planTotal(items)).toBe('335.00');
  });

  it('adds fractional amounts exactly, where floats would not', () => {
    const items = [
      makePlanItem({ id: '1', estimatedPrice: '0.10' }),
      makePlanItem({ id: '2', estimatedPrice: '0.20' }),
    ];

    // 0.1 + 0.2 is 0.30000000000000004 in binary floating point.
    expect(planTotal(items)).toBe('0.30');
  });

  it('keeps two decimals even when they are zero', () => {
    expect(planTotal([makePlanItem({ estimatedPrice: '7' })])).toBe('7.00');
  });

  it('counts only what is still planned as remaining', () => {
    const items = [
      makePlanItem({ id: '1', estimatedPrice: '40.00', status: 'planned' }),
      makePlanItem({ id: '2', estimatedPrice: '45.00', status: 'converted' }),
      makePlanItem({ id: '3', estimatedPrice: '250.00', status: 'cancelled' }),
    ];

    // Converted items have become real procedures with their own price, and
    // cancelled ones are not owed.
    expect(planTotal(items)).toBe('335.00');
    expect(planRemaining(items)).toBe('40.00');
  });
});
