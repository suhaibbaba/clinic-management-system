import { ITEM_CATEGORY, ITEM_UNIT, type InventoryItemRow } from '@clinic/shared';
import { describe, expect, it } from 'vitest';

import { stockScale, stockTone } from '@web/features/inventory/display';

const item = (quantity: string, minQuantity: string, isLow = false): InventoryItemRow => ({
  id: 'item',
  clinicId: 'clinic',
  nameAr: 'قفازات',
  category: ITEM_CATEGORY.CONSUMABLE,
  unit: ITEM_UNIT.BOX,
  minQuantity,
  defaultSupplierId: null,
  notes: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  quantity,
  supplierName: null,
  isLow,
  isExpiring: false,
  isExpired: false,
  nearestExpiry: null,
});

describe('stockTone', () => {
  it('is danger when the API says the item is low', () => {
    expect(stockTone(item('3', '10', true))).toBe('danger');
  });

  it('warns between the minimum and twice it', () => {
    expect(stockTone(item('11', '10'))).toBe('warning');
    expect(stockTone(item('20', '10'))).toBe('warning');
  });

  it('is ordinary above twice the minimum', () => {
    expect(stockTone(item('21', '10'))).toBe('primary');
  });

  it('is ordinary when no minimum has been set — there is nothing to be under', () => {
    expect(stockTone(item('0', '0'))).toBe('primary');
  });

  it('reads exact decimals rather than rounding them', () => {
    // 20.001 is above twice the minimum by a thousandth, and that is the answer.
    expect(stockTone(item('20.001', '10'))).toBe('primary');
    expect(stockTone(item('20.000', '10'))).toBe('warning');
  });
});

describe('stockScale', () => {
  it('puts the minimum at the halfway mark', () => {
    expect(stockScale(item('5', '10'))).toEqual({ value: 5, total: 20 });
  });

  it('never draws a negative bar from a count that has gone below zero', () => {
    expect(stockScale(item('-4', '10'))).toEqual({ value: 0, total: 20 });
  });

  it('falls back to what is there when no minimum has been set', () => {
    expect(stockScale(item('7', '0'))).toEqual({ value: 7, total: 7 });
    // An empty item with no minimum still needs a non-zero scale to divide by.
    expect(stockScale(item('0', '0'))).toEqual({ value: 0, total: 1 });
  });
});
