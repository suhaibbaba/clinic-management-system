import { randomUUID } from "node:crypto";
import {
  DEFAULT_TIME_ZONE,
  ITEM_CATEGORY,
  ITEM_UNIT,
  STOCK_ERROR,
  SUPPLIER_DOCUMENT_KIND,
  USER_ROLE,
  addDays,
  localDate,
  type LotBlock,
  type Payroll,
  type PurchaseResult,
  type SupplierInvoiceSummary,
  type SupplierReturnResult,
  type SupplierSummary,
  type UserRole,
} from "@clinic/shared";
import { eq, sql } from "drizzle-orm";
import { stockMovements } from "@api/database/schema";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

describe("Stock corrections, write-offs and lot blocks (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  const tokens = {} as Record<UserRole, string>;
  const today = localDate(new Date(), DEFAULT_TIME_ZONE);
  const month = today.slice(0, 7);
  let sequence = 0;

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();

    for (const role of [USER_ROLE.ADMIN, USER_ROLE.TECHNICIAN, USER_ROLE.DOCTOR]) {
      tokens[role] = await context.login(clinic.phones[role]);
    }
  });

  afterAll(async () => {
    await context.close();
  });

  beforeEach(() => {
    context.resetThrottle();
  });

  const send = (
    method: "GET" | "POST" | "PATCH",
    url: string,
    payload?: unknown,
    role: UserRole = USER_ROLE.TECHNICIAN,
  ) =>
    context.app.inject({
      method,
      url,
      headers: auth(tokens[role]),
      ...(payload !== undefined && { payload: payload as object }),
    });

  const newItem = async (flags: Record<string, unknown> = {}): Promise<string> => {
    sequence += 1;
    const response = await send("POST", "/inventory/items", {
      name: `صنف تصحيح ${sequence} ${randomUUID().slice(0, 6)}`,
      category: ITEM_CATEGORY.CONSUMABLE,
      unit: ITEM_UNIT.PIECE,
      ...flags,
    });
    expect(response.statusCode).toBe(201);
    return (response.json() as { id: string }).id;
  };

  const newSupplier = async (): Promise<string> =>
    (
      (await send("POST", "/suppliers", { name: `مورّد ${randomUUID().slice(0, 8)}` })).json() as {
        id: string;
      }
    ).id;

  const buy = async (
    supplierId: string | null,
    lines: readonly Record<string, unknown>[],
  ): Promise<PurchaseResult> => {
    const response = await send("POST", "/purchases", {
      supplierId,
      date: today,
      lines,
      invoice: supplierId ? {} : null,
    });
    expect(response.statusCode).toBe(201);
    return response.json() as PurchaseResult;
  };

  const layers = async (itemId: string) => {
    const [row] = await context.db
      .select({
        onHand: sql<string>`sum(${stockMovements.quantity})::text`,
        value: sql<string>`sum(${stockMovements.value})::text`,
      })
      .from(stockMovements)
      .where(eq(stockMovements.itemId, itemId));
    return row;
  };

  const owed = async (supplierId: string): Promise<string | undefined> =>
    ((await send("GET", `/suppliers/${supplierId}`)).json() as SupplierSummary).balance;

  const profit = async () =>
    ((await send("GET", `/payroll/${month}`, undefined, USER_ROLE.ADMIN)).json() as Payroll).profit;

  const receiptLine = async (receiptId: string): Promise<string> => {
    const rows = await context.db.execute<{ id: string }>(
      sql`select id::text as id from stock_receipt_lines where receipt_id = ${receiptId}`,
    );
    return [...rows][0]?.id ?? "";
  };

  describe("item flags", () => {
    it("asks a sensitive item for its lot and expiry, and an expiring one for its date", async () => {
      const sensitive = await newItem({ sensitive: true });
      const expiring = await newItem({ hasExpiry: true });

      const noLot = await send("POST", "/purchases", {
        date: today,
        lines: [{ itemId: sensitive, quantity: "2", expiryDate: addDays(today, 200) }],
      });
      expect(noLot.statusCode).toBe(400);
      expect(noLot.json()).toMatchObject({ message: STOCK_ERROR.LOT_REQUIRED });

      const noDate = await send("POST", "/purchases", {
        date: today,
        lines: [{ itemId: expiring, quantity: "2" }],
      });
      expect(noDate.statusCode).toBe(400);
      expect(noDate.json()).toMatchObject({ message: STOCK_ERROR.EXPIRY_REQUIRED });

      const item = (await send("GET", `/inventory/items/${sensitive}`)).json() as {
        hasExpiry: boolean;
        sensitive: boolean;
      };
      expect(item).toMatchObject({ sensitive: true, hasExpiry: true });
    });

    it("uses whole units unless the item is measured", async () => {
      const piece = await newItem();
      const liquid = await newItem({ unit: ITEM_UNIT.ML, measured: true });
      await buy(null, [{ itemId: piece, quantity: "5" }]);
      await buy(null, [{ itemId: liquid, quantity: "5" }]);

      const half = await send("POST", "/inventory/movements/consume", {
        itemId: piece,
        quantity: "0.5",
      });
      expect(half.statusCode).toBe(400);
      expect(half.json()).toMatchObject({ message: STOCK_ERROR.WHOLE_UNITS });

      expect(
        (await send("POST", "/inventory/movements/consume", { itemId: liquid, quantity: "0.5" }))
          .statusCode,
      ).toBe(201);
    });
  });

  describe("write-offs", () => {
    it("takes expired stock off at its cost with a reason from the clinic's list", async () => {
      const itemId = await newItem();
      await buy(null, [
        {
          itemId,
          quantity: "3",
          unitPrice: "10",
          batchNo: "OLD-1",
          expiryDate: addDays(today, -5),
        },
        {
          itemId,
          quantity: "2",
          unitPrice: "10",
          batchNo: "NEW-1",
          expiryDate: addDays(today, 90),
        },
      ]);

      const named = await send("POST", "/inventory/movements/consume", {
        itemId,
        quantity: "1",
        batchNo: "OLD-1",
      });
      expect(named.statusCode).toBe(409);

      const unknownReason = await send("POST", "/inventory/movements/write-off", {
        itemId,
        quantity: "3",
        reasonCode: "no_such_reason",
      });
      expect(unknownReason.statusCode).toBe(400);

      const requestId = randomUUID();
      const written = await send("POST", "/inventory/movements/write-off", {
        itemId,
        quantity: "3",
        reasonCode: "expired",
        requestId,
      });
      expect(written.statusCode).toBe(201);
      expect(written.json()).toMatchObject({ type: "write_off", quantity: "-3", batchNo: "OLD-1" });

      const replay = await send("POST", "/inventory/movements/write-off", {
        itemId,
        quantity: "3",
        reasonCode: "expired",
        requestId,
      });
      expect((replay.json() as { id: string }).id).toBe((written.json() as { id: string }).id);

      expect(await layers(itemId)).toEqual({ onHand: "2.000", value: "20.00" });
    });

    it("never takes more than the shelf holds", async () => {
      const itemId = await newItem();
      await buy(null, [{ itemId, quantity: "1" }]);

      const tooMuch = await send("POST", "/inventory/movements/write-off", {
        itemId,
        quantity: "2",
        reasonCode: "damaged",
      });
      expect(tooMuch.statusCode).toBe(409);
      expect(tooMuch.json()).toMatchObject({ message: STOCK_ERROR.INSUFFICIENT });
    });
  });

  describe("lot blocks", () => {
    it("keeps a blocked lot on hand but out of use until a manager lifts it", async () => {
      const itemId = await newItem();
      await buy(null, [
        { itemId, quantity: "5", batchNo: "L-1", expiryDate: addDays(today, 30) },
        { itemId, quantity: "5", batchNo: "L-2", expiryDate: addDays(today, 60) },
      ]);
      await send("POST", "/inventory/movements/consume", {
        itemId,
        quantity: "1",
        batchNo: "L-1",
      });

      const blocked = await send("POST", `/inventory/items/${itemId}/lot-blocks`, {
        batchNo: "L-1",
        reason: "سحب من الشركة المصنّعة",
      });
      expect(blocked.statusCode).toBe(201);
      const block = blocked.json() as LotBlock;
      expect(block).toMatchObject({ batchNo: "L-1", remaining: "4", liftedAt: null });
      expect(block.uses).toHaveLength(1);

      const again = await send("POST", `/inventory/items/${itemId}/lot-blocks`, {
        batchNo: "L-1",
        reason: "مرة ثانية",
      });
      expect(again.statusCode).toBe(409);
      expect(again.json()).toMatchObject({ message: STOCK_ERROR.ALREADY_BLOCKED });

      const named = await send("POST", "/inventory/movements/consume", {
        itemId,
        quantity: "1",
        batchNo: "L-1",
      });
      expect(named.statusCode).toBe(409);
      expect(named.json()).toMatchObject({ message: STOCK_ERROR.BLOCKED });

      const fefo = await send("POST", "/inventory/movements/consume", { itemId, quantity: "2" });
      expect(fefo.statusCode).toBe(201);
      expect(fefo.json()).toMatchObject({ batchNo: "L-2" });

      const beyond = await send("POST", "/inventory/movements/consume", { itemId, quantity: "4" });
      expect(beyond.statusCode).toBe(409);
      expect(beyond.json()).toMatchObject({ message: STOCK_ERROR.BLOCKED });

      const list = (await send("GET", "/inventory/lot-blocks")).json() as LotBlock[];
      expect(list.map((row) => row.id)).toContain(block.id);

      expect(
        (
          await send("PATCH", `/inventory/lot-blocks/${block.id}/lift`, {
            reason: "تبيّن أنها سليمة",
          })
        ).statusCode,
      ).toBe(403);

      const lifted = await send(
        "PATCH",
        `/inventory/lot-blocks/${block.id}/lift`,
        { reason: "تبيّن أنها سليمة" },
        USER_ROLE.ADMIN,
      );
      expect(lifted.statusCode).toBe(200);
      expect((lifted.json() as LotBlock).liftedAt).not.toBeNull();

      expect(
        (
          await send("POST", "/inventory/movements/consume", {
            itemId,
            quantity: "1",
            batchNo: "L-1",
          })
        ).statusCode,
      ).toBe(201);
    });
  });

  describe("returns and credit notes", () => {
    it("returns stock at its cost and books the credit difference as variance", async () => {
      const supplierId = await newSupplier();
      const itemId = await newItem();
      await buy(supplierId, [{ itemId, quantity: "4", unitPrice: "100" }]);
      const before = await profit();

      const asTechnician = await send("POST", "/purchases/returns", {
        supplierId,
        date: today,
        lines: [{ itemId, quantity: "2" }],
        credit: { amount: "190" },
      });
      expect(asTechnician.statusCode).toBe(403);

      const returned = await send(
        "POST",
        "/purchases/returns",
        {
          supplierId,
          date: today,
          lines: [{ itemId, quantity: "2" }],
          credit: { amount: "190", supplierRef: "CR-11" },
        },
        USER_ROLE.ADMIN,
      );
      expect(returned.statusCode).toBe(201);
      const result = returned.json() as SupplierReturnResult;
      expect(result.returnNumber).toMatch(/^RT-\d{4}-\d{4}$/);
      expect(result.creditNoteNumber).toMatch(/^CN-\d{4}-\d{4}$/);
      expect(result.value).toBe("200.00");

      expect(await layers(itemId)).toEqual({ onHand: "2.000", value: "200.00" });
      expect(await owed(supplierId)).toBe("210.00");

      const after = await profit();
      expect(Number(after.stock) - Number(before.stock)).toBeCloseTo(-200, 2);
      expect(Number(after.purchaseVariance) - Number(before.purchaseVariance)).toBeCloseTo(10, 2);

      const documents = (
        await send("GET", `/suppliers/${supplierId}/invoices`)
      ).json() as SupplierInvoiceSummary[];
      const credit = documents.find((row) => row.kind === SUPPLIER_DOCUMENT_KIND.CREDIT_NOTE);
      expect(credit).toMatchObject({ total: "190.00", paid: "190.00", open: "0.00" });

      const voided = await send(
        "PATCH",
        `/purchases/returns/${result.returnId}/void`,
        { reason: "أرجعها المورّد" },
        USER_ROLE.ADMIN,
      );
      expect(voided.statusCode).toBe(204);
      expect(await layers(itemId)).toEqual({ onHand: "4.000", value: "400.00" });
      expect(await owed(supplierId)).toBe("400.00");
    });

    it("lets a technician return goods without a credit", async () => {
      const supplierId = await newSupplier();
      const itemId = await newItem();
      await buy(supplierId, [{ itemId, quantity: "3", unitPrice: "10" }]);

      const returned = await send("POST", "/purchases/returns", {
        supplierId,
        date: today,
        lines: [{ itemId, quantity: "1" }],
      });
      expect(returned.statusCode).toBe(201);
      expect((returned.json() as SupplierReturnResult).creditNoteId).toBeNull();
      expect(await owed(supplierId)).toBe("30.00");
    });

    it("splits a price credit between stock on hand and variance on what was used", async () => {
      const supplierId = await newSupplier();
      const itemId = await newItem();
      const purchase = await buy(supplierId, [{ itemId, quantity: "10", unitPrice: "25" }]);
      await send("POST", "/inventory/movements/consume", { itemId, quantity: "4" });
      const lineId = await receiptLine(purchase.receiptId);
      const before = await profit();

      expect(
        (
          await send("POST", "/purchases/credit-notes", {
            supplierId,
            date: today,
            lines: [{ receiptLineId: lineId, amount: "20" }],
          })
        ).statusCode,
      ).toBe(403);

      const credited = await send(
        "POST",
        "/purchases/credit-notes",
        {
          supplierId,
          date: today,
          invoiceId: purchase.invoiceId,
          lines: [{ receiptLineId: lineId, amount: "20" }],
        },
        USER_ROLE.ADMIN,
      );
      expect(credited.statusCode).toBe(201);
      const credit = credited.json() as SupplierInvoiceSummary;
      expect(credit).toMatchObject({ kind: SUPPLIER_DOCUMENT_KIND.CREDIT_NOTE, total: "20.00" });

      expect(await layers(itemId)).toEqual({ onHand: "6.000", value: "138.00" });
      expect(await owed(supplierId)).toBe("230.00");

      const after = await profit();
      expect(Number(after.stock) - Number(before.stock)).toBeCloseTo(-12, 2);
      expect(Number(after.purchaseVariance) - Number(before.purchaseVariance)).toBeCloseTo(-8, 2);

      const supplement = await send(
        "POST",
        "/purchases/supplementary",
        { supplierId, date: today, lines: [{ receiptLineId: lineId, amount: "10" }] },
        USER_ROLE.ADMIN,
      );
      expect(supplement.statusCode).toBe(201);
      expect(await layers(itemId)).toEqual({ onHand: "6.000", value: "144.00" });
      expect(await owed(supplierId)).toBe("240.00");

      const voided = await send(
        "PATCH",
        `/purchases/invoices/${credit.id}/void`,
        { reason: "ألغى المورّد الخصم" },
        USER_ROLE.ADMIN,
      );
      expect(voided.statusCode).toBe(204);
      expect(await layers(itemId)).toEqual({ onHand: "6.000", value: "156.00" });
      expect(await owed(supplierId)).toBe("260.00");
    });
  });
});
