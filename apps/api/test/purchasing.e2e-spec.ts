import { randomUUID } from "node:crypto";
import {
  DEFAULT_TIME_ZONE,
  DISCOUNT_KIND,
  ITEM_CATEGORY,
  ITEM_UNIT,
  PAYMENT_METHOD,
  PURCHASE_ERROR,
  STOCK_ERROR,
  USER_ROLE,
  addDays,
  localDate,
  type PurchaseResult,
  type SupplierInvoiceSummary,
  type SupplierSummary,
  type UserRole,
} from "@clinic/shared";
import { and, eq, sql } from "drizzle-orm";
import { payrollMonths, stockMovements } from "@api/database/schema";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

describe("Purchasing documents (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  const tokens = {} as Record<UserRole, string>;
  const today = localDate(new Date(), DEFAULT_TIME_ZONE);
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
    method: "GET" | "POST" | "PATCH" | "PUT",
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

  const newItem = async (): Promise<string> => {
    sequence += 1;
    const response = await send("POST", "/inventory/items", {
      name: `صنف شراء ${sequence} ${randomUUID().slice(0, 6)}`,
      category: ITEM_CATEGORY.CONSUMABLE,
      unit: ITEM_UNIT.PIECE,
    });
    return (response.json() as { id: string }).id;
  };

  const newSupplier = async (): Promise<string> => {
    const response = await send("POST", "/suppliers", {
      name: `مورّد ${randomUUID().slice(0, 8)}`,
    });
    return (response.json() as { id: string }).id;
  };

  const owed = async (supplierId: string): Promise<string | undefined> =>
    ((await send("GET", `/suppliers/${supplierId}`)).json() as SupplierSummary).balance;

  const invoices = async (supplierId: string): Promise<SupplierInvoiceSummary[]> =>
    (await send("GET", `/suppliers/${supplierId}/invoices`)).json() as SupplierInvoiceSummary[];

  const layers = async (itemId: string) => {
    const [row] = await context.db
      .select({
        onHand: sql<string>`sum(${stockMovements.quantity})::text`,
        unknown: sql<string>`sum(${stockMovements.unknownQuantity})::text`,
        value: sql<string>`sum(${stockMovements.value})::text`,
      })
      .from(stockMovements)
      .where(eq(stockMovements.itemId, itemId));
    return row;
  };

  describe("receiving with an invoice", () => {
    it("posts the worked example to the cent and stores the cost of a later use", async () => {
      const supplierId = await newSupplier();
      const [composite, lidocaine, gloves, sample] = await Promise.all([
        newItem(),
        newItem(),
        newItem(),
        newItem(),
      ]);

      const earlier = await send("POST", "/purchases", {
        supplierId,
        date: today,
        lines: [{ itemId: composite, quantity: "3", unitPrice: "44" }],
        invoice: {},
      });
      expect(earlier.statusCode).toBe(201);

      const posted = await send("POST", "/purchases", {
        supplierId,
        date: today,
        lines: [
          { itemId: composite, quantity: "10", freeQuantity: "2", unitPrice: "45" },
          {
            itemId: lidocaine,
            quantity: "4",
            unitPrice: "120",
            discount: { kind: DISCOUNT_KIND.PERCENT, value: "10" },
          },
          { itemId: gloves, quantity: "10", unitPrice: "25" },
          { itemId: sample, quantity: "1", gift: true },
        ],
        invoice: {
          supplierRef: "INV-778",
          discount: { kind: DISCOUNT_KIND.PERCENT, value: "5" },
          charges: "20",
        },
        paidNow: "500",
        paymentMethod: PAYMENT_METHOD.CASH,
      });

      expect(posted.statusCode).toBe(201);
      const result = posted.json() as PurchaseResult;
      expect(result.total).toBe("1095.40");
      expect(result.receiptNumber).toMatch(/^GR-\d{4}-\d{4}$/);
      expect(result.invoiceNumber).toMatch(/^PI-\d{4}-\d{4}$/);

      expect(await owed(supplierId)).toBe("727.40");
      expect((await invoices(supplierId)).find((row) => row.id === result.invoiceId)).toMatchObject(
        {
          paid: "500.00",
          open: "595.40",
        },
      );
      expect(await layers(composite)).toEqual({
        onHand: "15.000",
        unknown: "0.000",
        value: "567.45",
      });
      expect(await layers(sample)).toEqual({ onHand: "1.000", unknown: "0.000", value: "0.00" });

      const used = await send("POST", "/inventory/movements/consume", {
        itemId: composite,
        quantity: "1",
      });
      expect(used.statusCode).toBe(201);

      const [row] = await context.db
        .select({ value: stockMovements.value })
        .from(stockMovements)
        .where(eq(stockMovements.id, (used.json() as { id: string }).id));
      expect(row?.value).toBe("-37.83");
    });

    it("refuses a duplicate supplier reference for the same supplier only", async () => {
      const [first, second] = [await newSupplier(), await newSupplier()];
      const itemId = await newItem();
      const body = (supplierId: string) => ({
        supplierId,
        date: today,
        lines: [{ itemId, quantity: "1", unitPrice: "5" }],
        invoice: { supplierRef: "A-1" },
      });

      expect((await send("POST", "/purchases", body(first))).statusCode).toBe(201);
      const again = await send("POST", "/purchases", body(first));
      expect(again.statusCode).toBe(409);
      expect(again.json().message).toBe(PURCHASE_ERROR.DUPLICATE_REFERENCE);
      expect((await send("POST", "/purchases", body(second))).statusCode).toBe(201);
    });

    it("records a repeated submission once", async () => {
      const supplierId = await newSupplier();
      const itemId = await newItem();
      const body = {
        supplierId,
        date: today,
        lines: [{ itemId, quantity: "2", unitPrice: "10" }],
        invoice: {},
        requestId: randomUUID(),
      };

      const results = await Promise.all([
        send("POST", "/purchases", body),
        send("POST", "/purchases", body),
      ]);

      expect(
        new Set(results.map((response) => (response.json() as PurchaseResult).receiptId)).size,
      ).toBe(1);
      expect((await layers(itemId))?.onHand).toBe("2.000");
      expect(await owed(supplierId)).toBe("20.00");
    });

    it("guards the date: never future, never past 30 days, backdating needs the manager, closed months never", async () => {
      const supplierId = await newSupplier();
      const itemId = await newItem();
      const body = (date: string) => ({
        supplierId,
        date,
        lines: [{ itemId, quantity: "1", unitPrice: "5" }],
        invoice: {},
      });

      expect((await send("POST", "/purchases", body(addDays(today, 1)))).json().message).toBe(
        PURCHASE_ERROR.FUTURE_DATE,
      );
      expect((await send("POST", "/purchases", body(addDays(today, -10)))).statusCode).toBe(403);
      expect(
        (await send("POST", "/purchases", body(addDays(today, -10)), USER_ROLE.ADMIN)).statusCode,
      ).toBe(201);

      const tooOld = await send("POST", "/purchases", body(addDays(today, -31)), USER_ROLE.ADMIN);
      expect(tooOld.statusCode).toBe(400);
      expect(tooOld.json().message).toBe(PURCHASE_ERROR.TOO_OLD);
      expect(
        (await send("POST", "/purchases", body(addDays(today, -30)), USER_ROLE.ADMIN)).statusCode,
      ).toBe(201);

      const lastMonth = `${addDays(`${today.slice(0, 7)}-01`, -40).slice(0, 7)}-01`;
      const closedDay = addDays(lastMonth, 3);
      await context.db
        .insert(payrollMonths)
        .values({ clinicId: clinic.id, month: lastMonth, lines: [] });
      const closed = await send("POST", "/purchases", body(closedDay), USER_ROLE.ADMIN);
      expect(closed.statusCode).toBe(409);
      expect(closed.json().message).toBe(PURCHASE_ERROR.CLOSED_MONTH);
      await context.db
        .delete(payrollMonths)
        .where(and(eq(payrollMonths.clinicId, clinic.id), eq(payrollMonths.month, lastMonth)))
        .catch(() => undefined);
    });

    it("keeps prices away from a doctor", async () => {
      const itemId = await newItem();
      const response = await send(
        "POST",
        "/purchases",
        { date: today, lines: [{ itemId, quantity: "1", unitPrice: "5" }] },
        USER_ROLE.DOCTOR,
      );

      expect(response.statusCode).toBe(403);
    });
  });

  describe("invoicing goods received earlier", () => {
    const receiptLine = async (receiptId: string): Promise<string> => {
      const rows = await context.db.execute<{ id: string }>(
        sql`select id::text from stock_receipt_lines where receipt_id = ${receiptId}`,
      );
      return [...rows][0]?.id ?? "";
    };

    it("moves a price difference into stock for what is left and to variance for what was used", async () => {
      const supplierId = await newSupplier();
      const itemId = await newItem();
      const received = (
        await send("POST", "/purchases", {
          supplierId,
          date: today,
          lines: [{ itemId, quantity: "2", unitPrice: "100" }],
        })
      ).json() as PurchaseResult;

      expect(await owed(supplierId)).toBe("0.00");
      const waiting = (await send("GET", `/suppliers/${supplierId}/uninvoiced`)).json() as {
        receiptLineId: string;
        unitPrice: string;
      }[];
      expect(waiting).toHaveLength(1);
      expect(waiting[0]?.unitPrice).toBe("100.00");
      await send("POST", "/inventory/movements/consume", { itemId, quantity: "1" });

      const invoiced = await send("POST", "/purchases/invoices", {
        supplierId,
        date: today,
        lines: [{ receiptLineId: await receiptLine(received.receiptId), unitPrice: "110" }],
      });

      expect(invoiced.statusCode).toBe(201);
      expect(await owed(supplierId)).toBe("220.00");
      expect((await send("GET", `/suppliers/${supplierId}/uninvoiced`)).json()).toEqual([]);
      expect(await layers(itemId)).toEqual({ onHand: "1.000", unknown: "0.000", value: "110.00" });

      const again = await send("POST", "/purchases/invoices", {
        supplierId,
        date: today,
        lines: [{ receiptLineId: await receiptLine(received.receiptId), unitPrice: "110" }],
      });
      expect(again.json().message).toBe(PURCHASE_ERROR.ALREADY_INVOICED);
    });

    it("gives unpriced stock its invoiced cost", async () => {
      const supplierId = await newSupplier();
      const itemId = await newItem();
      const received = (
        await send("POST", "/purchases", {
          supplierId,
          date: today,
          lines: [{ itemId, quantity: "2" }],
        })
      ).json() as PurchaseResult;

      expect(await layers(itemId)).toEqual({ onHand: "2.000", unknown: "2.000", value: "0.00" });

      await send("POST", "/purchases/invoices", {
        supplierId,
        date: today,
        lines: [{ receiptLineId: await receiptLine(received.receiptId), unitPrice: "50" }],
      });

      expect(await layers(itemId)).toEqual({ onHand: "2.000", unknown: "0.000", value: "100.00" });
    });
  });

  describe("voids", () => {
    it("voids a paid invoice into supplier credit, applied to the next invoice", async () => {
      const supplierId = await newSupplier();
      const itemId = await newItem();
      const first = (
        await send("POST", "/purchases", {
          supplierId,
          date: today,
          lines: [{ itemId, quantity: "1", unitPrice: "300" }],
          invoice: {},
          paidNow: "300",
          paymentMethod: PAYMENT_METHOD.CASH,
        })
      ).json() as PurchaseResult;

      expect(
        (
          await send("PATCH", `/purchases/invoices/${first.invoiceId}/void`, {
            reason: "فاتورة خاطئة",
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await send(
            "PATCH",
            `/purchases/invoices/${first.invoiceId}/void`,
            { reason: "فاتورة خاطئة" },
            USER_ROLE.ADMIN,
          )
        ).statusCode,
      ).toBe(204);
      expect(await owed(supplierId)).toBe("-300.00");

      const second = (
        await send("POST", "/purchases", {
          supplierId,
          date: today,
          lines: [{ itemId, quantity: "1", unitPrice: "200" }],
          invoice: {},
        })
      ).json() as PurchaseResult;

      expect((await invoices(supplierId)).find((row) => row.id === second.invoiceId)).toMatchObject(
        { open: "0.00" },
      );
      expect(await owed(supplierId)).toBe("-100.00");
    });

    it("refuses to void a receipt that is invoiced or whose stock was used", async () => {
      const supplierId = await newSupplier();
      const itemId = await newItem();
      const invoiced = (
        await send("POST", "/purchases", {
          supplierId,
          date: today,
          lines: [{ itemId, quantity: "2", unitPrice: "10" }],
          invoice: {},
        })
      ).json() as PurchaseResult;

      const blocked = await send(
        "PATCH",
        `/purchases/receipts/${invoiced.receiptId}/void`,
        { reason: "خطأ" },
        USER_ROLE.ADMIN,
      );
      expect(blocked.json().message).toBe(PURCHASE_ERROR.INVOICED_RECEIPT);

      const plain = (
        await send("POST", "/purchases", {
          date: today,
          lines: [{ itemId, quantity: "1", unitPrice: "10" }],
        })
      ).json() as PurchaseResult;
      await send("POST", "/inventory/movements/consume", { itemId, quantity: "3" });

      const used = await send(
        "PATCH",
        `/purchases/receipts/${plain.receiptId}/void`,
        { reason: "خطأ" },
        USER_ROLE.ADMIN,
      );
      expect(used.json().message).toBe(STOCK_ERROR.INSUFFICIENT);
    });
  });

  describe("payments", () => {
    it("allocates oldest first, keeps an overpayment as credit, and limits refunds to it", async () => {
      const supplierId = await newSupplier();
      const itemId = await newItem();
      const post = async (price: string) =>
        (
          (
            await send("POST", "/purchases", {
              supplierId,
              date: today,
              lines: [{ itemId, quantity: "1", unitPrice: price }],
              invoice: {},
            })
          ).json() as PurchaseResult
        ).invoiceId;

      const older = await post("100");
      const newer = await post("50");
      const paid = await send("POST", "/supplier-payments", {
        supplierId,
        amount: "170",
        method: PAYMENT_METHOD.CASH,
      });
      expect(paid.statusCode).toBe(201);

      const rows = await invoices(supplierId);
      expect(rows.find((row) => row.id === older)?.open).toBe("0.00");
      expect(rows.find((row) => row.id === newer)?.open).toBe("0.00");
      expect(await owed(supplierId)).toBe("-20.00");

      const tooMuch = await send(
        "POST",
        "/supplier-payments/refunds",
        { supplierId, amount: "21", method: PAYMENT_METHOD.CASH },
        USER_ROLE.ADMIN,
      );
      expect(tooMuch.json().message).toBe(PURCHASE_ERROR.REFUND_EXCEEDS_CREDIT);
      expect(
        (
          await send(
            "POST",
            "/supplier-payments/refunds",
            { supplierId, amount: "20", method: PAYMENT_METHOD.CASH },
            USER_ROLE.ADMIN,
          )
        ).statusCode,
      ).toBe(201);
      expect(await owed(supplierId)).toBe("0.00");
    });

    it("lets only the manager reallocate, never beyond an invoice's open amount", async () => {
      const supplierId = await newSupplier();
      const itemId = await newItem();
      const post = async (price: string) =>
        (
          (
            await send("POST", "/purchases", {
              supplierId,
              date: today,
              lines: [{ itemId, quantity: "1", unitPrice: price }],
              invoice: {},
            })
          ).json() as PurchaseResult
        ).invoiceId ?? "";

      const older = await post("100");
      const newer = await post("100");
      const payment = (
        await send("POST", "/supplier-payments", {
          supplierId,
          amount: "100",
          method: PAYMENT_METHOD.CASH,
        })
      ).json() as { id: string };

      const body = {
        allocations: [{ invoiceId: newer, amount: "100" }],
        reason: "للفاتورة الأحدث",
      };
      expect(
        (await send("PUT", `/supplier-payments/${payment.id}/allocations`, body)).statusCode,
      ).toBe(403);
      expect(
        (await send("PUT", `/supplier-payments/${payment.id}/allocations`, body, USER_ROLE.ADMIN))
          .statusCode,
      ).toBe(204);

      const rows = await invoices(supplierId);
      expect(rows.find((row) => row.id === older)?.open).toBe("100.00");
      expect(rows.find((row) => row.id === newer)?.open).toBe("0.00");

      const over = await send(
        "PUT",
        `/supplier-payments/${payment.id}/allocations`,
        { allocations: [{ invoiceId: older, amount: "150" }], reason: "أكثر" },
        USER_ROLE.ADMIN,
      );
      expect(over.json().message).toBe(PURCHASE_ERROR.ALLOCATION_EXCEEDS);
    });
  });
});
