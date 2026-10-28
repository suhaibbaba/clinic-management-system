import type { ItemBatch } from "@clinic/shared";
import { describe, expect, it } from "vitest";
import { shelfRows } from "@web/modules/inventory/lib/batches";

const batch = (overrides: Partial<ItemBatch>): ItemBatch => ({
  batchNo: "L-1",
  expiryDate: "2027-01-31",
  receivedAt: "2026-10-01T09:00:00.000Z",
  quantity: "5",
  remaining: "5",
  isExpired: false,
  isExpiring: false,
  blockId: null,
  ...overrides,
});

describe("shelfRows", () => {
  it("keeps a blocked lot on the shelf, earliest expiry first, with the loose stock last", () => {
    const rows = shelfRows(
      [
        batch({ batchNo: "L-2", expiryDate: "2027-06-30" }),
        batch({ batchNo: "L-1", blockId: "block-1" }),
        batch({ batchNo: "L-0", remaining: "0" }),
      ],
      "2",
    );

    expect(rows.map((row) => [row.batchNo, row.blockId])).toEqual([
      ["L-1", "block-1"],
      ["L-2", null],
      [null, null],
    ]);
  });
});
