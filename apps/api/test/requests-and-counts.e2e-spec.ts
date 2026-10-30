import { randomUUID } from "node:crypto";
import {
  DEFAULT_TIME_ZONE,
  ITEM_CATEGORY,
  ITEM_UNIT,
  PURCHASE_REQUEST_ERROR,
  PURCHASE_REQUEST_STATUS,
  STOCK_COUNT_ERROR,
  STOCK_COUNT_STATUS,
  USER_ROLE,
  addDays,
  localDate,
  type PurchaseRequest,
  type StockCount,
  type UserRole,
} from "@clinic/shared";
import { eq, sql } from "drizzle-orm";
import { stockMovements } from "@api/database/schema";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

describe("Purchase requests and stock counts (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  const tokens = {} as Record<UserRole, string>;
  const today = localDate(new Date(), DEFAULT_TIME_ZONE);
  let sequence = 0;

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();

    for (const role of [
      USER_ROLE.ADMIN,
      USER_ROLE.TECHNICIAN,
      USER_ROLE.DOCTOR,
      USER_ROLE.RECEPTIONIST,
    ]) {
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

  const newSupplier = async (phone?: string): Promise<string> =>
    (
      (
        await send("POST", "/suppliers", {
          name: `مورّد ${randomUUID().slice(0, 8)}`,
          ...(phone && { phone }),
        })
      ).json() as { id: string }
    ).id;

  const newItem = async (payload: Record<string, unknown> = {}): Promise<string> => {
    sequence += 1;
    const response = await send("POST", "/inventory/items", {
      name: `صنف طلب ${sequence} ${randomUUID().slice(0, 6)}`,
      category: ITEM_CATEGORY.CONSUMABLE,
      unit: ITEM_UNIT.PIECE,
      ...payload,
    });
    expect(response.statusCode).toBe(201);
    return (response.json() as { id: string }).id;
  };

  const onHand = async (itemId: string): Promise<string | undefined> => {
    const [row] = await context.db
      .select({ value: sql<string>`sum(${stockMovements.quantity})::text` })
      .from(stockMovements)
      .where(eq(stockMovements.itemId, itemId));
    return row?.value;
  };

  describe("purchase requests", () => {
    it("is raised by a doctor, sent to the supplier and received in two deliveries", async () => {
      const supplierId = await newSupplier("+970599123456");
      const itemId = await newItem();

      expect(
        (
          await send(
            "POST",
            "/purchase-requests",
            { supplierId, lines: [{ itemId, quantity: "10" }] },
            USER_ROLE.RECEPTIONIST,
          )
        ).statusCode,
      ).toBe(403);

      const created = await send(
        "POST",
        "/purchase-requests",
        { supplierId, lines: [{ itemId, quantity: "10" }], requestId: randomUUID() },
        USER_ROLE.DOCTOR,
      );
      expect(created.statusCode).toBe(201);
      const request = created.json() as PurchaseRequest;
      expect(request.number).toMatch(/^PR-\d{4}-\d{4}$/);
      expect(request.status).toBe(PURCHASE_REQUEST_STATUS.REQUESTED);

      expect(
        (await send("POST", `/purchase-requests/${request.id}/send`, {}, USER_ROLE.DOCTOR))
          .statusCode,
      ).toBe(403);

      const sent = await send("POST", `/purchase-requests/${request.id}/send`, {});
      expect(sent.statusCode).toBe(201);
      expect(sent.json()).toMatchObject({
        status: PURCHASE_REQUEST_STATUS.ORDERED,
        sentTo: "+970599123456",
      });

      const lineId = request.lines[0]?.id ?? "";
      const first = await send("POST", "/purchases", {
        supplierId,
        date: today,
        lines: [{ itemId, quantity: "6", requestLineId: lineId }],
      });
      expect(first.statusCode).toBe(201);

      const partly = (
        await send("GET", `/purchase-requests/${request.id}`)
      ).json() as PurchaseRequest;
      expect(partly.status).toBe(PURCHASE_REQUEST_STATUS.PARTLY_RECEIVED);
      expect(partly.lines[0]).toMatchObject({ received: "6", open: "4" });

      await send("POST", "/purchases", {
        supplierId,
        date: today,
        lines: [{ itemId, quantity: "4", requestLineId: lineId }],
      });

      const done = (
        await send("GET", `/purchase-requests/${request.id}`)
      ).json() as PurchaseRequest;
      expect(done.status).toBe(PURCHASE_REQUEST_STATUS.RECEIVED);
    });

    it("refuses to send without a supplier phone and to receive against the wrong item", async () => {
      const supplierId = await newSupplier();
      const [itemId, otherId] = [await newItem(), await newItem()];
      const request = (
        await send("POST", "/purchase-requests", {
          supplierId,
          lines: [{ itemId, quantity: "2" }],
        })
      ).json() as PurchaseRequest;

      const noPhone = await send("POST", `/purchase-requests/${request.id}/send`, {});
      expect(noPhone.statusCode).toBe(409);
      expect(noPhone.json()).toMatchObject({ message: PURCHASE_REQUEST_ERROR.NO_PHONE });

      const marked = await send("PATCH", `/purchase-requests/${request.id}/ordered`);
      expect(marked.json()).toMatchObject({ status: PURCHASE_REQUEST_STATUS.ORDERED });

      const wrong = await send("POST", "/purchases", {
        supplierId,
        date: today,
        lines: [{ itemId: otherId, quantity: "2", requestLineId: request.lines[0]?.id }],
      });
      expect(wrong.statusCode).toBe(400);
      expect(wrong.json()).toMatchObject({ message: PURCHASE_REQUEST_ERROR.WRONG_LINE });

      const cancelled = await send("PATCH", `/purchase-requests/${request.id}/cancel`, {
        reason: "وجدنا بديلاً",
      });
      expect(cancelled.json()).toMatchObject({ status: PURCHASE_REQUEST_STATUS.CANCELLED });

      const late = await send("POST", "/purchases", {
        supplierId,
        date: today,
        lines: [{ itemId, quantity: "2", requestLineId: request.lines[0]?.id }],
      });
      expect(late.statusCode).toBe(400);
    });

    it("lists an item's unfinished orders, without prices, until the last unit arrives", async () => {
      const supplierId = await newSupplier();
      const itemId = await newItem();
      const openLines = (query: string, role: UserRole = USER_ROLE.DOCTOR) =>
        send("GET", `/purchase-requests/open-lines?${query}`, undefined, role);

      const first = (
        await send(
          "POST",
          "/purchase-requests",
          { supplierId, lines: [{ itemId, quantity: "10" }], requestId: randomUUID() },
          USER_ROLE.DOCTOR,
        )
      ).json() as PurchaseRequest;
      const cancelled = (
        await send("POST", "/purchase-requests", {
          lines: [{ itemId, quantity: "3" }],
          requestId: randomUUID(),
        })
      ).json() as PurchaseRequest;
      expect(
        (
          await send("PATCH", `/purchase-requests/${cancelled.id}/cancel`, {
            reason: "ordered twice",
          })
        ).statusCode,
      ).toBe(200);

      expect((await openLines(`itemIds=${itemId}`, USER_ROLE.RECEPTIONIST)).statusCode).toBe(403);
      expect((await openLines("itemIds=")).statusCode).toBe(400);

      const listed = await openLines(`itemIds=${itemId},${randomUUID()}`);
      expect(listed.statusCode).toBe(200);
      expect(listed.json()).toEqual([
        expect.objectContaining({
          itemId,
          requestId: first.id,
          number: first.number,
          status: PURCHASE_REQUEST_STATUS.REQUESTED,
          quantity: "10",
          open: "10",
        }),
      ]);
      expect(listed.json()[0]).not.toHaveProperty("lastPrice");
      expect(listed.json()[0].createdByName).not.toBeNull();

      expect((await openLines(`itemIds=${itemId}&excludeRequestId=${first.id}`)).json()).toEqual(
        [],
      );

      const lineId = first.lines[0]?.id ?? "";
      await send("POST", "/purchases", {
        supplierId,
        date: today,
        lines: [{ itemId, quantity: "4", requestLineId: lineId }],
      });
      expect((await openLines(`itemIds=${itemId}`)).json()).toEqual([
        expect.objectContaining({
          status: PURCHASE_REQUEST_STATUS.PARTLY_RECEIVED,
          quantity: "10",
          open: "6",
        }),
      ]);

      await send("POST", "/purchases", {
        supplierId,
        date: today,
        lines: [{ itemId, quantity: "6", requestLineId: lineId }],
      });
      expect((await openLines(`itemIds=${itemId}`)).json()).toEqual([]);
    });

    it("turns items below their minimum into one request per default supplier", async () => {
      const [laith, sami] = [await newSupplier(), await newSupplier()];
      const gloves = await newItem({ minQuantity: "5", defaultSupplierId: laith });
      const masks = await newItem({ minQuantity: "3", defaultSupplierId: sami });
      await send("POST", "/purchases", { date: today, lines: [{ itemId: gloves, quantity: "1" }] });

      const response = await send("POST", "/purchase-requests/below-minimum", {});
      expect(response.statusCode).toBe(201);
      const requests = response.json() as PurchaseRequest[];

      const forLaith = requests.find((request) => request.supplierId === laith);
      const forSami = requests.find((request) => request.supplierId === sami);
      expect(forLaith?.lines.find((line) => line.itemId === gloves)?.quantity).toBe("9");
      expect(forSami?.lines.find((line) => line.itemId === masks)?.quantity).toBe("6");
    });
  });

  describe("stock counts", () => {
    it("posts each counted difference against the shelf, and leaves uncounted items as they are", async () => {
      const itemId = await newItem();
      const spareId = await newItem();
      await send("POST", "/purchases", {
        date: today,
        lines: [
          { itemId, quantity: "10", unitPrice: "4" },
          { itemId: spareId, quantity: "3", unitPrice: "2" },
        ],
      });

      const started = await send("POST", "/stock-counts", { itemIds: [itemId, spareId] });
      expect(started.statusCode).toBe(201);
      const count = started.json() as StockCount;
      expect(count.number).toMatch(/^SC-\d{4}-\d{4}$/);
      expect(count.lines.find((line) => line.itemId === itemId)?.expected).toBe("10");

      const second = await send("POST", "/stock-counts", { itemIds: [itemId] });
      expect(second.statusCode).toBe(409);
      expect(second.json()).toMatchObject({ message: STOCK_COUNT_ERROR.ALREADY_OPEN });

      const empty = await send(
        "POST",
        `/stock-counts/${count.id}/post`,
        undefined,
        USER_ROLE.ADMIN,
      );
      expect(empty.statusCode).toBe(409);
      expect(empty.json()).toMatchObject({ message: STOCK_COUNT_ERROR.INCOMPLETE });

      await send("PUT", `/stock-counts/${count.id}/lines`, {
        lines: [{ itemId, counted: "7" }],
      });
      await send("POST", "/inventory/movements/consume", { itemId, quantity: "1" });

      expect((await send("POST", `/stock-counts/${count.id}/post`)).statusCode).toBe(403);

      const posted = await send(
        "POST",
        `/stock-counts/${count.id}/post`,
        undefined,
        USER_ROLE.ADMIN,
      );
      expect(posted.statusCode).toBe(201);
      const result = posted.json() as StockCount;
      expect(result.status).toBe(STOCK_COUNT_STATUS.POSTED);
      expect(await onHand(itemId)).toBe("7.000");
      expect(await onHand(spareId)).toBe("3.000");
      expect(result.lines.find((line) => line.itemId === itemId)?.value).toBe("-8.00");
      expect(result.lines.find((line) => line.itemId === spareId)).toMatchObject({
        counted: null,
        difference: null,
      });

      const after = await send("POST", "/stock-counts", { itemIds: [itemId] });
      expect(after.statusCode).toBe(201);
      await send("PATCH", `/stock-counts/${(after.json() as StockCount).id}/cancel`);
    });

    it("brings a surplus in at the price and expiry typed beside it", async () => {
      const fresh = await newItem();
      const expiryDate = addDays(today, 200);
      const count = (
        await send("POST", "/stock-counts", { itemIds: [fresh] })
      ).json() as StockCount;

      const saved = await send("PUT", `/stock-counts/${count.id}/lines`, {
        lines: [{ itemId: fresh, counted: "4", unitPrice: "2.50", expiryDate }],
      });
      expect(saved.statusCode).toBe(200);
      expect((saved.json() as StockCount).lines[0]).toMatchObject({
        counted: "4",
        unitPrice: "2.50",
        expiryDate,
      });

      await send("PUT", `/stock-counts/${count.id}/lines`, {
        lines: [{ itemId: fresh, counted: "5" }],
      });

      const posted = await send(
        "POST",
        `/stock-counts/${count.id}/post`,
        undefined,
        USER_ROLE.ADMIN,
      );
      expect(posted.statusCode).toBe(201);
      expect((posted.json() as StockCount).lines[0]?.value).toBe("12.50");
      expect(await onHand(fresh)).toBe("5.000");

      const [movement] = await context.db
        .select({ expiryDate: stockMovements.expiryDate, unitPrice: stockMovements.unitPrice })
        .from(stockMovements)
        .where(eq(stockMovements.itemId, fresh));
      expect(movement).toEqual({ expiryDate, unitPrice: "2.50" });
    });

    it("keeps a surplus without a price at the average cost", async () => {
      const itemId = await newItem();
      await send("POST", "/purchases", {
        date: today,
        lines: [{ itemId, quantity: "2", unitPrice: "3" }],
      });
      const count = (
        await send("POST", "/stock-counts", { itemIds: [itemId] })
      ).json() as StockCount;
      await send("PUT", `/stock-counts/${count.id}/lines`, {
        lines: [{ itemId, counted: "4" }],
      });

      const posted = await send(
        "POST",
        `/stock-counts/${count.id}/post`,
        undefined,
        USER_ROLE.ADMIN,
      );
      expect((posted.json() as StockCount).lines[0]?.value).toBe("6.00");
    });
  });

  describe("the manager's review list", () => {
    it("lists purchases others posted until the manager marks them reviewed", async () => {
      const supplierId = await newSupplier();
      const itemId = await newItem();
      const posted = (
        await send("POST", "/purchases", {
          supplierId,
          date: today,
          lines: [{ itemId, quantity: "2", unitPrice: "5" }],
          invoice: {},
        })
      ).json() as { receiptId: string; invoiceId: string };
      const own = (
        await send(
          "POST",
          "/purchases",
          { date: today, lines: [{ itemId, quantity: "1" }] },
          USER_ROLE.ADMIN,
        )
      ).json() as { receiptId: string };

      expect((await send("GET", "/purchases/review")).statusCode).toBe(403);

      const pending = (
        await send("GET", "/purchases/review", undefined, USER_ROLE.ADMIN)
      ).json() as {
        id: string;
        kind: string;
        total: string | null;
      }[];
      const ids = pending.map((entry) => entry.id);
      expect(ids).toEqual(expect.arrayContaining([posted.receiptId, posted.invoiceId]));
      expect(ids).not.toContain(own.receiptId);
      expect(pending.find((entry) => entry.id === posted.invoiceId)).toMatchObject({
        kind: "invoice",
        total: "10.00",
      });

      const marked = await send(
        "PATCH",
        "/purchases/review",
        { receipts: [posted.receiptId], invoices: [posted.invoiceId] },
        USER_ROLE.ADMIN,
      );
      expect(marked.statusCode).toBe(204);

      const after = (await send("GET", "/purchases/review", undefined, USER_ROLE.ADMIN)).json() as {
        id: string;
      }[];
      expect(after.map((entry) => entry.id)).not.toContain(posted.receiptId);
      expect(after.map((entry) => entry.id)).not.toContain(posted.invoiceId);
    });
  });
});
