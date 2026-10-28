import { randomUUID } from "node:crypto";
import {
  DEFAULT_TIME_ZONE,
  ITEM_CATEGORY,
  ITEM_UNIT,
  STOCK_ERROR,
  USER_ROLE,
  addDays,
  localDate,
  type ItemPrice,
  type PackSize,
  type PurchaseResult,
  type Valuation,
  type VarianceReport,
  type WasteReport,
  type UserRole,
} from "@clinic/shared";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

describe("Pack sizes, price history and stock reports (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  const tokens = {} as Record<UserRole, string>;
  const today = localDate(new Date(), DEFAULT_TIME_ZONE);

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

  const newItem = async (): Promise<string> =>
    (
      (
        await send("POST", "/inventory/items", {
          name: `صنف تقرير ${randomUUID().slice(0, 8)}`,
          category: ITEM_CATEGORY.CONSUMABLE,
          unit: ITEM_UNIT.PIECE,
        })
      ).json() as { id: string }
    ).id;

  it("buys by the box, stocks by the piece and remembers the price per box", async () => {
    const supplierId = (
      (await send("POST", "/suppliers", { name: `مورّد ${randomUUID().slice(0, 8)}` })).json() as {
        id: string;
      }
    ).id;
    const itemId = await newItem();
    const otherId = await newItem();

    const added = await send("POST", `/inventory/items/${itemId}/pack-sizes`, {
      unit: ITEM_UNIT.BOX,
      unitsPer: "10",
    });
    expect(added.statusCode).toBe(201);
    const [box] = added.json() as PackSize[];
    expect(box).toMatchObject({ unit: ITEM_UNIT.BOX, unitsPer: "10" });

    const again = await send("POST", `/inventory/items/${itemId}/pack-sizes`, {
      unit: ITEM_UNIT.BOX,
      unitsPer: "12",
    });
    expect(again.json()).toMatchObject({ message: STOCK_ERROR.PACK_SIZE_EXISTS });

    const wrongItem = await send("POST", "/purchases", {
      date: today,
      lines: [{ itemId: otherId, quantity: "1", packSizeId: box?.id }],
    });
    expect(wrongItem.statusCode).toBe(400);

    const posted = await send("POST", "/purchases", {
      supplierId,
      date: today,
      lines: [{ itemId, quantity: "2", unitPrice: "50", packSizeId: box?.id }],
      invoice: {},
    });
    expect(posted.statusCode).toBe(201);
    expect((posted.json() as PurchaseResult).total).toBe("100.00");

    const item = (await send("GET", `/inventory/items/${itemId}`)).json() as { quantity: string };
    expect(item.quantity).toBe("20");

    expect(
      (await send("GET", `/inventory/items/${itemId}/prices`, undefined, USER_ROLE.DOCTOR))
        .statusCode,
    ).toBe(403);

    const [price] = (await send("GET", `/inventory/items/${itemId}/prices`)).json() as ItemPrice[];
    expect(price).toMatchObject({
      purchaseUnit: ITEM_UNIT.BOX,
      unitsPer: "10",
      quantity: "2",
      unitPrice: "50.00",
      unitCost: "5.0000",
    });

    const written = await send("POST", "/inventory/movements/write-off", {
      itemId,
      quantity: "3",
      reasonCode: "damaged",
    });
    expect(written.statusCode).toBe(201);

    const waste = (
      await send("GET", `/inventory/reports/waste?from=${addDays(today, -1)}&to=${today}`)
    ).json() as WasteReport;
    expect(waste.lines.find((line) => line.itemId === itemId)).toMatchObject({
      reasonCode: "damaged",
      quantity: "3",
      value: "15.00",
    });

    const valuation = (
      await send("GET", `/inventory/reports/valuation?date=${today}`)
    ).json() as Valuation;
    expect(valuation.lines.find((line) => line.itemId === itemId)).toMatchObject({
      quantity: "17",
      value: "85.00",
    });

    const before = (
      await send("GET", `/inventory/reports/valuation?date=${addDays(today, -1)}`)
    ).json() as Valuation;
    expect(before.lines.find((line) => line.itemId === itemId)).toBeUndefined();

    await send(
      "POST",
      "/purchases/credit-notes",
      { supplierId, date: today, amount: "7" },
      USER_ROLE.ADMIN,
    );
    const variance = (
      await send("GET", `/inventory/reports/variance?from=${today}&to=${today}`)
    ).json() as VarianceReport;
    expect(variance.lines.some((line) => line.variance === "-7.00")).toBe(true);
  });
});
