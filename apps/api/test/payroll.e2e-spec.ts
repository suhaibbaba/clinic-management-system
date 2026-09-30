import { USER_ROLE, type Payroll, type UserRole } from "@clinic/shared";
import { staffName } from "@test/helpers/staff-name";
import { uniquePhone } from "@test/helpers/patient-fixtures";
import {
  auth,
  createTestContext,
  TEST_PASSWORD,
  type TestClinic,
  type TestContext,
} from "@test/helpers/test-app";

const MONTH = "2025-03";
const NEXT = "2025-04";

describe("Payroll (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let receptionistId: string;
  const tokens = {} as Record<UserRole, string>;

  const as = (role: UserRole) => auth(tokens[role]);

  const payroll = async (month = MONTH) => {
    const response = await context.app.inject({
      method: "GET",
      url: `/payroll/${month}`,
      headers: as(USER_ROLE.ADMIN),
    });

    expect(response.statusCode).toBe(200);
    return response.json() as Payroll;
  };

  const line = async (month = MONTH) =>
    (await payroll(month)).lines.find((entry) => entry.userId === receptionistId);

  const post = (url: string, payload: Record<string, unknown>) =>
    context.app.inject({ method: "POST", url, headers: as(USER_ROLE.ADMIN), payload });

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

    const me = await context.app.inject({
      method: "GET",
      url: "/me",
      headers: as(USER_ROLE.RECEPTIONIST),
    });
    receptionistId = (me.json() as { id: string }).id;

    await context.app.inject({
      method: "PATCH",
      url: `/users/${receptionistId}`,
      headers: as(USER_ROLE.ADMIN),
      payload: { joinedOn: "2024-06-01" },
    });

    const salary = await context.app.inject({
      method: "PUT",
      url: `/payroll/salaries/${receptionistId}`,
      headers: as(USER_ROLE.ADMIN),
      payload: { monthlyAmount: "3000", effectiveMonth: "2025-01" },
    });
    expect(salary.statusCode).toBe(200);
  });

  afterAll(async () => {
    await context.close();
  });

  it("owes the salary in force, plus extras and minus cuts", async () => {
    const extra = await post(`/payroll/${MONTH}/adjustments`, {
      userId: receptionistId,
      kind: "extra",
      amount: "200",
      reason: "عمل يوم الجمعة",
    });
    const cut = await post(`/payroll/${MONTH}/adjustments`, {
      userId: receptionistId,
      kind: "cut",
      amount: "100",
      reason: "غياب يوم",
    });
    expect([extra.statusCode, cut.statusCode]).toEqual([201, 201]);

    expect(await line()).toMatchObject({
      base: "3000.00",
      extras: "200.00",
      cuts: "100.00",
      due: "3100.00",
      remaining: "3100.00",
    });
  });

  it("takes what was paid off what is due, and a reversal puts it back", async () => {
    const paid = await post(`/payroll/${MONTH}/payments`, {
      userId: receptionistId,
      amount: "1000",
      method: "cash",
    });
    expect(paid.statusCode).toBe(201);
    expect(await line()).toMatchObject({ paid: "1000.00", remaining: "2100.00" });

    const reversed = await post(`/staff-payments/${(paid.json() as { id: string }).id}/reverse`, {
      reason: "دفعة مكررة",
    });
    expect(reversed.statusCode).toBe(201);
    expect(await line()).toMatchObject({ paid: "0.00", remaining: "3100.00" });
  });

  it("reverses an adjustment instead of editing it", async () => {
    const extra = await post(`/payroll/${MONTH}/adjustments`, {
      userId: receptionistId,
      kind: "extra",
      amount: "50",
      reason: "خطأ في الإدخال",
    });

    const reversed = await post(
      `/payroll-adjustments/${(extra.json() as { id: string }).id}/reverse`,
      { reason: "أُدخلت بالخطأ" },
    );
    expect(reversed.statusCode).toBe(201);
    expect((await line())?.extras).toBe("200.00");
  });

  it("locks a closed month, and a later raise leaves it as it was", async () => {
    const closed = await post(`/payroll/${MONTH}/close`, {});
    expect(closed.statusCode).toBe(201);
    expect((closed.json() as Payroll).closedAt).not.toBeNull();

    expect((await post(`/payroll/${MONTH}/close`, {})).statusCode).toBe(409);
    expect(
      (
        await post(`/payroll/${MONTH}/adjustments`, {
          userId: receptionistId,
          kind: "extra",
          amount: "10",
          reason: "بعد الإغلاق",
        })
      ).statusCode,
    ).toBe(409);

    const backdated = await context.app.inject({
      method: "PUT",
      url: `/payroll/salaries/${receptionistId}`,
      headers: as(USER_ROLE.ADMIN),
      payload: { monthlyAmount: "9999", effectiveMonth: MONTH },
    });
    expect(backdated.statusCode).toBe(409);

    const raise = await context.app.inject({
      method: "PUT",
      url: `/payroll/salaries/${receptionistId}`,
      headers: as(USER_ROLE.ADMIN),
      payload: { monthlyAmount: "3500", effectiveMonth: NEXT },
    });
    expect(raise.statusCode).toBe(200);

    expect((await line())?.due).toBe("3100.00");
    expect((await line(NEXT))?.base).toBe("3500.00");

    const late = await post(`/payroll/${MONTH}/payments`, {
      userId: receptionistId,
      amount: "3100",
      method: "cash",
    });
    expect(late.statusCode).toBe(201);
    expect((await line())?.remaining).toBe("0.00");
  });

  it("leaves out anybody who had not joined yet", async () => {
    const created = await context.app.inject({
      method: "POST",
      url: "/users",
      headers: as(USER_ROLE.ADMIN),
      payload: {
        ...staffName("موظف جديد", "New Hire"),
        phone: uniquePhone(),
        password: TEST_PASSWORD,
        role: USER_ROLE.TECHNICIAN,
        isActive: true,
        joinedOn: "2025-05-10",
      },
    });
    expect(created.statusCode).toBe(201);
    const id = (created.json() as { id: string; joinedOn: string }).id;

    expect((await payroll(NEXT)).lines.some((entry) => entry.userId === id)).toBe(false);
    expect((await payroll("2025-05")).lines.some((entry) => entry.userId === id)).toBe(true);
  });

  it("refuses a joining date in the future", async () => {
    const response = await context.app.inject({
      method: "PATCH",
      url: `/users/${receptionistId}`,
      headers: as(USER_ROLE.ADMIN),
      payload: { joinedOn: "2999-01-01" },
    });

    expect(response.statusCode).toBe(400);
  });

  it("keeps payroll to the admin", async () => {
    for (const role of [USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN]) {
      const response = await context.app.inject({
        method: "GET",
        url: `/payroll/${MONTH}`,
        headers: as(role),
      });

      expect({ role, status: response.statusCode }).toEqual({ role, status: 403 });
    }
  });
});
