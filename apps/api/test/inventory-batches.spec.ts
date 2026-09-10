import {
  addQuantity,
  batchesRemaining,
  compareQuantity,
  formatThousandths,
  nearestExpiry,
  negateQuantity,
  quantityToNumber,
  subtractQuantity,
  toThousandths,
  type BatchInflow,
} from '@clinic/shared';

// Unit-tested rather than driven through the API because both are arithmetic: the interesting cases
// are ones a seeded database would never contain.
describe('quantity arithmetic', () => {
  it('never goes through a float', () => {
    // 0.1 + 0.2 is the canonical float failure; in thousandths it is 300.
    expect(addQuantity('0.1', '0.2')).toBe('0.3');

    let total = '0';
    for (let index = 0; index < 10; index += 1) {
      total = addQuantity(total, '0.1');
    }
    expect(total).toBe('1');
  });

  it('keeps the sign on the whole value, not on its parts', () => {
    // '-2.5' split naively is -2 and 5, which sums to -1.5 rather than -2.5.
    expect(toThousandths('-2.5')).toBe(-2500);
    expect(formatThousandths(-2500)).toBe('-2.5');
    expect(negateQuantity('-2.5')).toBe('2.5');
  });

  it('trims trailing zeros without losing precision', () => {
    expect(formatThousandths(2000)).toBe('2');
    expect(formatThousandths(2500)).toBe('2.5');
    expect(formatThousandths(2005)).toBe('2.005');
    expect(subtractQuantity('2', '0.005')).toBe('1.995');
  });

  it('compares exactly, which is what the low-stock flag needs', () => {
    expect(compareQuantity('2.000', '2')).toBe(0);
    expect(compareQuantity('1.999', '2')).toBeLessThan(0);
    expect(compareQuantity('2.001', '2')).toBeGreaterThan(0);
  });

  it('converts to a number only where a bar has to be drawn', () => {
    expect(quantityToNumber('2.5')).toBe(2.5);
  });
});

const inflow = (
  batchNo: string | null,
  expiryDate: string | null,
  receivedAt: string,
  quantity: string,
): BatchInflow => ({ batchNo, expiryDate, receivedAt, quantity });

describe('batchesRemaining', () => {
  it('drains the batch that goes off first', () => {
    const batches = batchesRemaining(
      [
        inflow('B-2', '2027-01-01', '2026-01-10T00:00:00.000Z', '10'),
        inflow('B-1', '2026-06-01', '2026-01-20T00:00:00.000Z', '10'),
      ],
      [{ batchNo: null, quantity: '12' }],
    );

    // Bought second, expires first: it goes first, and takes the overflow with it.
    expect(batches.map((batch) => [batch.batchNo, batch.remaining])).toEqual([
      ['B-1', '0'],
      ['B-2', '8'],
    ]);
  });

  it('falls back to the arrival date when nothing has an expiry', () => {
    const batches = batchesRemaining(
      [
        inflow('B-1', null, '2026-01-10T00:00:00.000Z', '5'),
        inflow('B-2', null, '2026-02-10T00:00:00.000Z', '5'),
      ],
      [{ batchNo: null, quantity: '6' }],
    );

    expect(batches.map((batch) => [batch.batchNo, batch.remaining])).toEqual([
      ['B-1', '0'],
      ['B-2', '4'],
    ]);
  });

  it('puts a batch with no expiry last — it cannot be the next to go off', () => {
    const batches = batchesRemaining(
      [
        inflow(null, null, '2026-01-01T00:00:00.000Z', '5'),
        inflow('B-1', '2026-09-01', '2026-02-01T00:00:00.000Z', '5'),
      ],
      [{ batchNo: null, quantity: '5' }],
    );

    expect(batches.map((batch) => [batch.batchNo, batch.remaining])).toEqual([
      ['B-1', '0'],
      [null, '5'],
    ]);
  });

  it('takes a named consumption off that batch and nothing else', () => {
    const batches = batchesRemaining(
      [
        inflow('B-1', '2026-06-01', '2026-01-10T00:00:00.000Z', '10'),
        inflow('B-2', '2027-01-01', '2026-01-20T00:00:00.000Z', '10'),
      ],
      [{ batchNo: 'B-2', quantity: '3' }],
    );

    expect(batches.map((batch) => [batch.batchNo, batch.remaining])).toEqual([
      ['B-1', '10'],
      ['B-2', '7'],
    ]);
  });

  it('spills a batch drained past its own size into the pool rather than going negative', () => {
    const batches = batchesRemaining(
      [
        inflow('B-1', '2026-06-01', '2026-01-10T00:00:00.000Z', '4'),
        inflow('B-2', '2027-01-01', '2026-01-20T00:00:00.000Z', '10'),
      ],
      [{ batchNo: 'B-1', quantity: '6' }],
    );

    expect(batches.map((batch) => [batch.batchNo, batch.remaining])).toEqual([
      ['B-1', '0'],
      ['B-2', '8'],
    ]);
  });

  it('merges two arrivals of one lot number and keeps the earlier date', () => {
    const batches = batchesRemaining(
      [
        inflow('B-1', '2026-06-01', '2026-02-01T00:00:00.000Z', '5'),
        inflow('B-1', '2026-06-01', '2026-01-01T00:00:00.000Z', '5'),
      ],
      [],
    );

    expect(batches).toHaveLength(1);
    expect(batches[0]?.quantity).toBe('10');
    expect(batches[0]?.receivedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('never reports a negative remainder, however far the count is drained', () => {
    const batches = batchesRemaining(
      [inflow('B-1', '2026-06-01', '2026-01-10T00:00:00.000Z', '2')],
      [{ batchNo: null, quantity: '9' }],
    );

    expect(batches[0]?.remaining).toBe('0');
  });

  it('handles fractional stock without drifting', () => {
    const batches = batchesRemaining(
      [inflow('B-1', '2026-06-01', '2026-01-10T00:00:00.000Z', '500')],
      Array.from({ length: 7 }, () => ({ batchNo: null, quantity: '2.5' })),
    );

    expect(batches[0]?.remaining).toBe('482.5');
  });

  it('reports the earliest expiry that still has stock behind it', () => {
    const batches = batchesRemaining(
      [
        inflow('B-1', '2026-06-01', '2026-01-10T00:00:00.000Z', '5'),
        inflow('B-2', '2026-09-01', '2026-01-20T00:00:00.000Z', '5'),
      ],
      [{ batchNo: null, quantity: '5' }],
    );

    // B-1 is used up, so the date the clinic should be watching is B-2's.
    expect(nearestExpiry(batches)).toBe('2026-09-01');
  });

  it('has no nearest expiry when nothing is left', () => {
    expect(
      nearestExpiry(
        batchesRemaining(
          [inflow('B-1', '2026-06-01', '2026-01-10T00:00:00.000Z', '5')],
          [{ batchNo: null, quantity: '5' }],
        ),
      ),
    ).toBeNull();
  });
});
