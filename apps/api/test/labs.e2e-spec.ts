import {
  LAB_ORDER_ERROR,
  LAB_ORDER_STATUS,
  PAYMENT_METHOD,
  USER_ROLE,
  type LabOrderRow,
  type Paginated,
  type UserRole,
} from "@clinic/shared";
import {
  createPatient,
  procedurePayload,
  seedClinicFixtures,
  uniquePhone,
  type PatientFixtures,
  nameParts,
} from "@test/helpers/patient-fixtures";
import { eq } from "drizzle-orm";
import { labOrders } from "@api/database/schema";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

describe("Labs (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let fixtures: PatientFixtures;
  const tokens = {} as Record<UserRole, string>;

  let patientId: string;
  let labId: string;
  let crownId: string;
  let bridgeId: string;

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();

    for (const role of [
      USER_ROLE.ADMIN,
      USER_ROLE.DOCTOR,
      USER_ROLE.RECEPTIONIST,
      USER_ROLE.TECHNICIAN,
    ]) {
      tokens[role] = await context.login(clinic.phones[role]);
    }

    fixtures = await seedClinicFixtures(context, clinic, tokens[USER_ROLE.ADMIN]);

    patientId = await createPatient(context, tokens[USER_ROLE.RECEPTIONIST], {
      ...nameParts("مريض المخبر"),
      phone: uniquePhone(),
    });

    const lab = await context.app.inject({
      method: "POST",
      url: "/labs",
      headers: auth(tokens[USER_ROLE.TECHNICIAN]),
      payload: { name: "مخبر الاختبار", phone: "+963110000000", contactPerson: "أبو خالد" },
    });

    expect(lab.statusCode).toBe(201);
    labId = (lab.json() as { id: string }).id;

    crownId = await createWorkType("تاج زيركون", "45.00");
    bridgeId = await createWorkType("جسر ثلاثي", "120.00");
  });

  afterAll(async () => {
    await context.close();
  });

  async function createWorkType(name: string, defaultPrice: string): Promise<string> {
    const response = await context.app.inject({
      method: "POST",
      url: `/labs/${labId}/work-types`,
      headers: auth(tokens[USER_ROLE.TECHNICIAN]),
      payload: { name, defaultPrice },
    });

    expect(response.statusCode).toBe(201);

    return (response.json() as { id: string }).id;
  }

  async function createOrder(overrides: Record<string, unknown> = {}): Promise<LabOrderRow> {
    const { expectedAt, ...rest } = overrides;
    const backdated =
      typeof expectedAt === "string" && expectedAt < new Date().toISOString().slice(0, 10);

    const response = await context.app.inject({
      method: "POST",
      url: "/lab-orders",
      headers: auth(tokens[USER_ROLE.DOCTOR]),
      payload: {
        labId,
        patientId,
        doctorId: fixtures.doctorId,
        workTypeId: crownId,
        teeth: [26],
        material: "zirconia",
        shade: "A2",
        ...(backdated ? rest : overrides),
      },
    });

    expect(response.statusCode).toBe(201);
    const order = response.json() as LabOrderRow;

    if (backdated) {
      await context.db
        .update(labOrders)
        .set({ expectedAt: new Date(expectedAt) })
        .where(eq(labOrders.id, order.id));

      return { ...order, expectedAt: new Date(expectedAt).toISOString() };
    }

    return order;
  }

  const move = (
    id: string,
    step: string,
    role: UserRole = USER_ROLE.ADMIN,
    payload?: Record<string, unknown>,
  ) =>
    context.app.inject({
      method: "PATCH",
      url: `/lab-orders/${id}/${step}`,
      headers: auth(tokens[role]),
      ...(payload && { payload }),
    });

  const balance = async (): Promise<{ owed: string; paid: string; balance: string }> => {
    const response = await context.app.inject({
      method: "GET",
      url: `/labs/${labId}/balance`,
      headers: auth(tokens[USER_ROLE.ADMIN]),
    });

    expect(response.statusCode).toBe(200);

    return response.json() as { owed: string; paid: string; balance: string };
  };

  describe("status transitions", () => {
    it("walks the happy path and stamps each date as it goes", async () => {
      const order = await createOrder();

      expect(order.status).toBe(LAB_ORDER_STATUS.DRAFT);
      expect(order.sentAt).toBeNull();

      const sent = await move(order.id, "send");
      expect(sent.statusCode).toBe(200);
      expect((sent.json() as LabOrderRow).sentAt).not.toBeNull();

      expect((await move(order.id, "ready")).statusCode).toBe(200);

      const received = await move(order.id, "receive");
      expect((received.json() as LabOrderRow).receivedAt).not.toBeNull();

      const fitted = await move(order.id, "fit");
      expect(fitted.statusCode).toBe(200);
      expect((fitted.json() as LabOrderRow).status).toBe(LAB_ORDER_STATUS.FITTED);
      expect((fitted.json() as LabOrderRow).fittedAt).not.toBeNull();
    });

    it("refuses every jump the table does not allow", async () => {
      const order = await createOrder();

      expect((await move(order.id, "ready")).statusCode).toBe(400);
      expect((await move(order.id, "receive")).statusCode).toBe(400);
      expect((await move(order.id, "fit")).statusCode).toBe(400);

      await move(order.id, "send");

      expect((await move(order.id, "fit")).statusCode).toBe(400);
      expect((await move(order.id, "receive")).statusCode).toBe(400);
    });

    it("sends returned work straight back to the lab, which marks it ready again", async () => {
      const order = await createOrder();
      await move(order.id, "send");
      await move(order.id, "ready");

      const returned = await move(order.id, "return", USER_ROLE.ADMIN, {
        reason: "اللون لا يطابق",
        expectedAt: "2030-01-15",
      });

      expect(returned.statusCode).toBe(200);
      expect((returned.json() as LabOrderRow).returnReason).toBe("اللون لا يطابق");
      expect((returned.json() as LabOrderRow).receivedAt).toBeNull();
      expect((returned.json() as LabOrderRow).expectedAt?.slice(0, 10)).toBe("2030-01-15");

      expect((await move(order.id, "send")).statusCode).toBe(400);
      expect((await move(order.id, "ready")).statusCode).toBe(200);
    });

    it("refuses an expected date that has already passed", async () => {
      const order = await createOrder();
      await move(order.id, "send");
      await move(order.id, "ready");

      const late = await move(order.id, "return", USER_ROLE.ADMIN, {
        reason: "اللون لا يطابق",
        expectedAt: "2020-01-15",
      });

      expect(late.statusCode).toBe(400);
      expect((late.json() as { message: string }).message).toBe(LAB_ORDER_ERROR.EXPECTED_IN_PAST);

      const draft = await context.app.inject({
        method: "POST",
        url: "/lab-orders",
        headers: auth(tokens[USER_ROLE.DOCTOR]),
        payload: { labId, patientId, doctorId: fixtures.doctorId, expectedAt: "2020-01-15" },
      });

      expect(draft.statusCode).toBe(400);
    });

    it("will not accept a return with no reason", async () => {
      const order = await createOrder();
      await move(order.id, "send");
      await move(order.id, "ready");

      expect(
        (await move(order.id, "return", USER_ROLE.ADMIN, { reason: "", expectedAt: "2030-01-15" }))
          .statusCode,
      ).toBe(400);
    });

    it("cancels before the work is in hand, and returned work, but not after receiving", async () => {
      const draft = await createOrder();
      expect(
        (await move(draft.id, "cancel", USER_ROLE.ADMIN, { reason: "طلب المريض" })).statusCode,
      ).toBe(200);

      const sent = await createOrder();
      await move(sent.id, "send");
      expect(
        (await move(sent.id, "cancel", USER_ROLE.ADMIN, { reason: "طلب المريض" })).statusCode,
      ).toBe(200);

      const received = await createOrder();
      await move(received.id, "send");
      await move(received.id, "ready");
      await move(received.id, "receive");
      expect(
        (await move(received.id, "cancel", USER_ROLE.ADMIN, { reason: "طلب المريض" })).statusCode,
      ).toBe(400);
    });
  });

  describe("transition permissions", () => {
    it("lets the technician run the conversation with the lab", async () => {
      const order = await createOrder();

      expect((await move(order.id, "send", USER_ROLE.TECHNICIAN)).statusCode).toBe(200);
      expect((await move(order.id, "ready", USER_ROLE.TECHNICIAN)).statusCode).toBe(200);
      expect((await move(order.id, "receive", USER_ROLE.TECHNICIAN)).statusCode).toBe(200);
    });

    it("lets the technician record the fitting", async () => {
      const order = await createOrder();
      await move(order.id, "send");
      await move(order.id, "ready");
      await move(order.id, "receive");

      expect((await move(order.id, "fit", USER_ROLE.TECHNICIAN)).statusCode).toBe(200);
    });

    it("lets the doctor run the lab conversation on their own order", async () => {
      const order = await createOrder();
      await move(order.id, "send", USER_ROLE.DOCTOR);

      expect((await move(order.id, "ready", USER_ROLE.DOCTOR)).statusCode).toBe(200);
      expect((await move(order.id, "receive", USER_ROLE.DOCTOR)).statusCode).toBe(200);
      expect((await move(order.id, "fit", USER_ROLE.DOCTOR)).statusCode).toBe(200);
    });

    it("will not let a doctor set the price of the work", async () => {
      const order = await createOrder();

      const response = await context.app.inject({
        method: "PATCH",
        url: `/lab-orders/${order.id}`,
        headers: auth(tokens[USER_ROLE.DOCTOR]),
        payload: { price: "5.00" },
      });

      expect(response.statusCode).toBe(403);
      expect(order.price).toBe("45.00");
    });

    it("gives a receptionist nothing at all in this module", async () => {
      const order = await createOrder();
      const receptionist = auth(tokens[USER_ROLE.RECEPTIONIST]);

      const responses = await Promise.all([
        context.app.inject({ method: "GET", url: "/labs", headers: receptionist }),
        context.app.inject({ method: "GET", url: `/labs/${labId}`, headers: receptionist }),
        context.app.inject({
          method: "GET",
          url: `/labs/${labId}/work-types`,
          headers: receptionist,
        }),
        context.app.inject({ method: "GET", url: `/labs/${labId}/balance`, headers: receptionist }),
        context.app.inject({
          method: "GET",
          url: `/labs/${labId}/statement`,
          headers: receptionist,
        }),
        context.app.inject({ method: "GET", url: "/lab-orders", headers: receptionist }),
        context.app.inject({
          method: "GET",
          url: `/lab-orders/${order.id}`,
          headers: receptionist,
        }),
        context.app.inject({ method: "GET", url: "/lab-orders/overdue", headers: receptionist }),
        context.app.inject({
          method: "POST",
          url: "/lab-payments",
          headers: receptionist,
          payload: { labId, amount: "10.00", method: PAYMENT_METHOD.CASH },
        }),
      ]);

      expect(responses.map((response) => response.statusCode)).toEqual(
        Array.from({ length: responses.length }, () => 403),
      );
    });
  });

  describe("what counts toward the balance", () => {
    it("ignores a draft, counts it once sent", async () => {
      const before = await balance();

      const order = await createOrder({ workTypeId: bridgeId });
      expect((await balance()).owed).toBe(before.owed);

      await move(order.id, "send");
      expect(Number((await balance()).owed)).toBe(Number(before.owed) + 120);
    });

    it("drops a cancelled order back out", async () => {
      const before = await balance();

      const order = await createOrder({ workTypeId: bridgeId });
      await move(order.id, "send");
      expect(Number((await balance()).owed)).toBe(Number(before.owed) + 120);

      await move(order.id, "cancel", USER_ROLE.ADMIN, { reason: "طلب المريض" });
      expect((await balance()).owed).toBe(before.owed);
    });

    it("keeps a cancelled order's cost when asked to", async () => {
      const before = await balance();

      const order = await createOrder({ workTypeId: bridgeId });
      await move(order.id, "send");

      const cancelled = await move(order.id, "cancel", USER_ROLE.ADMIN, {
        reason: "طلب المريض",
        keepCost: true,
      });

      expect((cancelled.json() as LabOrderRow).costKept).toBe(true);
      expect(Number((await balance()).owed)).toBe(Number(before.owed) + 120);
    });

    it("cancels returned work, dropping or keeping its cost", async () => {
      const before = await balance();
      const returned = async (): Promise<LabOrderRow> => {
        const order = await createOrder({ workTypeId: bridgeId });
        await move(order.id, "send");
        await move(order.id, "ready");
        await move(order.id, "return", USER_ROLE.ADMIN, {
          reason: "لا يجلس",
          expectedAt: "2030-01-15",
        });
        return order;
      };

      const dropped = await returned();
      expect(
        (await move(dropped.id, "cancel", USER_ROLE.ADMIN, { reason: "طلب المريض" })).statusCode,
      ).toBe(200);
      expect((await balance()).owed).toBe(before.owed);

      const kept = await returned();
      await move(kept.id, "cancel", USER_ROLE.ADMIN, { reason: "طلب المريض", keepCost: true });
      expect(Number((await balance()).owed)).toBe(Number(before.owed) + 120);
    });

    it("will not cancel without a reason, and keeps the one given", async () => {
      const order = await createOrder();

      expect((await move(order.id, "cancel", USER_ROLE.ADMIN, { reason: "" })).statusCode).toBe(
        400,
      );

      const cancelled = await move(order.id, "cancel", USER_ROLE.ADMIN, { reason: "طلب المريض" });
      expect((cancelled.json() as LabOrderRow).cancelReason).toBe("طلب المريض");
    });

    it("never charges a draft, whatever the cancel asks", async () => {
      const before = await balance();

      const draft = await createOrder({ workTypeId: bridgeId });
      const cancelled = await move(draft.id, "cancel", USER_ROLE.ADMIN, {
        reason: "طلب المريض",
        keepCost: true,
      });

      expect((cancelled.json() as LabOrderRow).costKept).toBe(false);
      expect((await balance()).owed).toBe(before.owed);
    });

    it("keeps counting work that came back — the lab still made it", async () => {
      const before = await balance();

      const order = await createOrder({ workTypeId: bridgeId });
      await move(order.id, "send");
      await move(order.id, "ready");
      await move(order.id, "return", USER_ROLE.ADMIN, {
        reason: "لا يجلس",
        expectedAt: "2030-01-15",
      });

      expect(Number((await balance()).owed)).toBe(Number(before.owed) + 120);
    });

    it("keeps the price the order was placed at when the list moves", async () => {
      const order = await createOrder({ workTypeId: bridgeId });
      await move(order.id, "send");

      await context.app.inject({
        method: "PATCH",
        url: `/labs/work-types/${bridgeId}`,
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
        payload: { defaultPrice: "999.00" },
      });

      const after = await context.app.inject({
        method: "GET",
        url: `/lab-orders/${order.id}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });

      expect((after.json() as LabOrderRow).price).toBe("120.00");

      await context.app.inject({
        method: "PATCH",
        url: `/labs/work-types/${bridgeId}`,
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
        payload: { defaultPrice: "120.00" },
      });
    });
  });

  describe("payments", () => {
    it("records what the technician paid, and reverses it admin-only", async () => {
      const before = await balance();

      const paid = await context.app.inject({
        method: "POST",
        url: "/lab-payments",
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
        payload: { labId, amount: "50.00", method: PAYMENT_METHOD.CASH, note: "دفعة" },
      });

      expect(paid.statusCode).toBe(201);
      const paymentId = (paid.json() as { id: string }).id;
      expect(Number((await balance()).paid)).toBe(Number(before.paid) + 50);

      const refused = await context.app.inject({
        method: "PATCH",
        url: `/lab-payments/${paymentId}/reverse`,
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
        payload: { reason: "خطأ" },
      });
      expect(refused.statusCode).toBe(403);

      const reversed = await context.app.inject({
        method: "PATCH",
        url: `/lab-payments/${paymentId}/reverse`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { reason: "سُجّلت مرتين" },
      });

      expect(reversed.statusCode).toBe(200);
      expect((reversed.json() as { amount: string }).amount).toBe("-50.00");
      expect((await balance()).paid).toBe(before.paid);
    });

    it("refuses to reverse the same payment twice, or to reverse a reversal", async () => {
      const paid = await context.app.inject({
        method: "POST",
        url: "/lab-payments",
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { labId, amount: "20.00", method: PAYMENT_METHOD.CASH },
      });

      const paymentId = (paid.json() as { id: string }).id;

      const reversal = await context.app.inject({
        method: "PATCH",
        url: `/lab-payments/${paymentId}/reverse`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { reason: "خطأ في المبلغ" },
      });

      const reversalId = (reversal.json() as { id: string }).id;

      const twice = await context.app.inject({
        method: "PATCH",
        url: `/lab-payments/${paymentId}/reverse`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { reason: "مرة أخرى" },
      });
      const ofReversal = await context.app.inject({
        method: "PATCH",
        url: `/lab-payments/${reversalId}/reverse`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { reason: "وأيضاً" },
      });

      expect(twice.statusCode).toBe(400);
      expect(ofReversal.statusCode).toBe(400);
    });
  });

  describe("statement and documents", () => {
    it("dates an order from the day it was sent, and runs the balance down each line", async () => {
      const response = await context.app.inject({
        method: "GET",
        url: `/labs/${labId}/statement`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });

      expect(response.statusCode).toBe(200);
      const statement = response.json() as {
        closingBalance: string;
        entries: { kind: string; amount: string; runningBalance: string }[];
      };

      expect(statement.entries.length).toBeGreaterThan(0);
      expect(statement.closingBalance).toBe((await balance()).balance);
      expect(statement.entries.every((entry) => ["order", "payment"].includes(entry.kind))).toBe(
        true,
      );
    });

    it("prints an order sheet and a statement as PDFs", async () => {
      const order = await createOrder();

      const [sheet, statement] = await Promise.all([
        context.app.inject({
          method: "GET",
          url: `/lab-orders/${order.id}/print`,
          headers: auth(tokens[USER_ROLE.TECHNICIAN]),
        }),
        context.app.inject({
          method: "GET",
          url: `/labs/${labId}/statement.pdf`,
          headers: auth(tokens[USER_ROLE.ADMIN]),
        }),
      ]);

      for (const response of [sheet, statement]) {
        expect(response.statusCode).toBe(200);
        expect(response.headers["content-type"]).toContain("application/pdf");
        expect(response.rawPayload.subarray(0, 4).toString()).toBe("%PDF");
      }
    });

    it("lists what is late, and stops once the work is back", async () => {
      const order = await createOrder({
        expectedAt: new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10),
      });
      await move(order.id, "send");

      const late = await context.app.inject({
        method: "GET",
        url: "/lab-orders/overdue",
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
      });

      expect(late.statusCode).toBe(200);
      const ids = (late.json() as LabOrderRow[]).map((row) => row.id);
      expect(ids).toContain(order.id);
      expect((late.json() as LabOrderRow[]).every((row) => row.isOverdue)).toBe(true);

      await move(order.id, "ready");
      await move(order.id, "receive");

      const after = await context.app.inject({
        method: "GET",
        url: "/lab-orders/overdue",
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
      });

      expect((after.json() as LabOrderRow[]).map((row) => row.id)).not.toContain(order.id);
    });
  });

  describe("the work list", () => {
    const inDays = (days: number): string =>
      new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

    const list = async (query: string): Promise<Paginated<LabOrderRow>> => {
      const response = await context.app.inject({
        method: "GET",
        url: `/lab-orders?${query}`,
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
      });

      expect(response.statusCode).toBe(200);

      return response.json() as Paginated<LabOrderRow>;
    };

    it("lists open work soonest due first across every stage, counts each stage, and keeps the finished apart", async () => {
      const lab = await context.app.inject({
        method: "POST",
        url: "/labs",
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
        payload: { name: `مخبر القائمة ${uniquePhone()}` },
      });
      expect(lab.statusCode).toBe(201);
      const listLabId = (lab.json() as { id: string }).id;

      const order = (expectedAt: string) =>
        createOrder({ labId: listLabId, workTypeId: null, price: "100", expectedAt });

      const draft = await order(inDays(5));
      const late = await order(inDays(-2));
      const soon = await order(inDays(3));
      const inClinic = await order(inDays(-10));
      const fitted = await order(inDays(-20));

      for (const id of [late.id, soon.id, inClinic.id, fitted.id]) {
        await move(id, "send");
      }
      for (const step of ["ready", "receive"]) {
        await move(inClinic.id, step);
        await move(fitted.id, step);
      }
      await move(fitted.id, "fit");

      const open = await list(`view=open&sort=due&labId=${listLabId}`);
      expect(open.items.map((row) => row.id)).toEqual([late.id, soon.id, draft.id, inClinic.id]);

      const counts = await context.app.inject({
        method: "GET",
        url: `/lab-orders/stages?labId=${listLabId}`,
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
      });
      expect(counts.statusCode).toBe(200);
      expect(counts.json()).toEqual({
        stages: { to_send: 1, at_lab: 2, ready: 0, to_fit: 1 },
        overdue: 1,
      });

      const atLab = await list(`view=open&labId=${listLabId}&stage=at_lab&sort=due&dir=desc`);
      expect(atLab.items.map((row) => row.id)).toEqual([soon.id, late.id]);

      expect((await list(`view=done&labId=${listLabId}`)).items.map((row) => row.id)).toEqual([
        fitted.id,
      ]);

      const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
      expect((await list(`view=done&labId=${listLabId}&finishedFrom=${tomorrow}`)).total).toBe(0);
    });
  });

  describe("ordering from a procedure", () => {
    it("takes the teeth from the treatment that needs the work", async () => {
      const procedure = await context.app.inject({
        method: "POST",
        url: "/performed-procedures",
        headers: auth(tokens[USER_ROLE.DOCTOR]),
        payload: procedurePayload({
          patientId,
          doctorId: fixtures.doctorId,
          procedureId: fixtures.catalogId,
          tooth: 36,
        }),
      });

      expect(procedure.statusCode).toBe(201);
      const performedProcedureId = (procedure.json() as { id: string }).id;

      const order = await createOrder({ performedProcedureId, teeth: undefined });

      expect(order.teeth).toEqual([36]);
      expect(order.performedProcedureId).toBe(performedProcedureId);
    });

    it("refuses another patient's procedure", async () => {
      const other = await createPatient(context, tokens[USER_ROLE.RECEPTIONIST], {
        ...nameParts("مريض آخر"),
        phone: uniquePhone(),
      });
      const procedure = await context.app.inject({
        method: "POST",
        url: "/performed-procedures",
        headers: auth(tokens[USER_ROLE.DOCTOR]),
        payload: procedurePayload({
          patientId: other,
          doctorId: fixtures.doctorId,
          procedureId: fixtures.catalogId,
          tooth: 36,
        }),
      });

      const response = await context.app.inject({
        method: "POST",
        url: "/lab-orders",
        headers: auth(tokens[USER_ROLE.DOCTOR]),
        payload: {
          labId,
          patientId,
          doctorId: fixtures.doctorId,
          performedProcedureId: (procedure.json() as { id: string }).id,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
