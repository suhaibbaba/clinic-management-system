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
    it("posts each difference against what is on the shelf when the count is posted", async () => {
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

      await send("PUT", `/stock-counts/${count.id}/lines`, {
        lines: [{ itemId, counted: "7" }],
      });

      const incomplete = await send(
        "POST",
        `/stock-counts/${count.id}/post`,
        undefined,
        USER_ROLE.ADMIN,
      );
      expect(incomplete.statusCode).toBe(409);
      expect(incomplete.json()).toMatchObject({ message: STOCK_COUNT_ERROR.INCOMPLETE });

      await send("PUT", `/stock-counts/${count.id}/lines`, {
        lines: [{ itemId: spareId, counted: "3" }],
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

      const after = await send("POST", "/stock-counts", { itemIds: [itemId] });
      expect(after.statusCode).toBe(201);
      await send("PATCH", `/stock-counts/${(after.json() as StockCount).id}/cancel`);
    });
  });
});
