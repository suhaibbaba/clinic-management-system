import {
  PAYROLL_ERROR,
  USER_ROLE,
  addMoney,
  subtractMoney,
  type Expense,
  type ExpensesPage,
  type OwnerDraw,
  type Payroll,
  type UserRole,
} from "@clinic/shared";
import {
  createPatient,
  nameParts,
  seedClinicFixtures,
  uniquePhone,
} from "@test/helpers/patient-fixtures";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

const TODAY = new Date().toISOString().slice(0, 10);
const THIS_MONTH = TODAY.slice(0, 7);

const percentOf = (amount: string, percent: number): string => {
  const minor = Math.round(Number(amount) * 100);

  return ((minor <= 0 ? 0 : Math.round((minor * percent) / 100)) / 100).toFixed(2);
};

describe("Profit, expenses and staff percentages (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let patientId: string;
  const tokens = {} as Record<UserRole, string>;

  const as = (role: UserRole) => auth(tokens[role]);

  const send = (
    method: "GET" | "POST" | "PUT",
    url: string,
    payload?: unknown,
    role: UserRole = USER_ROLE.ADMIN,
  ) =>
    context.app.inject({
      method,
      url,
      headers: as(role),
      ...(payload !== undefined && { payload: payload as Record<string, unknown> }),
    });

  const payroll = async (): Promise<Payroll> => {
    const response = await send("GET", `/payroll/${THIS_MONTH}`);

    expect(response.statusCode).toBe(200);
    return response.json() as Payroll;
  };

  const lineOf = async (role: UserRole) =>
    (await payroll()).lines.find((entry) => entry.userId === clinic.userIds[role]);

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

    patientId = await createPatient(context, tokens[USER_ROLE.ADMIN], {
      ...nameParts("سلمى عادل ناصر"),
      phone: uniquePhone(),
    });

    const fixtures = await seedClinicFixtures(context, clinic, tokens[USER_ROLE.ADMIN]);
    const treated = await send(
      "POST",
      "/performed-procedures",
      {
        patientId,
        doctorId: fixtures.doctorId,
        procedureId: fixtures.catalogId,
        status: "done",
        price: "2000",
      },
      USER_ROLE.DOCTOR,
    );
    expect(treated.statusCode).toBe(201);

    const paid = await send("POST", "/payments", { patientId, amount: "2000", method: "cash" });
    expect(paid.statusCode).toBe(201);
  });

  afterAll(async () => {
    await context.close();
  });

  describe("expenses", () => {
    it("records an expense, lists it newest first and totals the month", async () => {
      const first = await send("POST", "/expenses", {
        spentOn: TODAY,
        category: "rent",
        amount: "500",
        method: "cash",
        note: "October rent",
      });
      expect(first.statusCode).toBe(201);

      const second = await send("POST", "/expenses", {
        spentOn: TODAY,
        category: "utilities",
        amount: "100",
        method: "transfer",
      });
      expect(second.statusCode).toBe(201);

      const page = (await send("GET", `/expenses?month=${THIS_MONTH}`)).json() as ExpensesPage;

      expect(page.items[0]?.id).toBe((second.json() as Expense).id);
      expect(page.monthTotal).toBe("600.00");
    });

    it("refuses a day still to come and a category the clinic does not list", async () => {
      const future = await send("POST", "/expenses", {
        spentOn: "2099-01-01",
        category: "rent",
        amount: "10",
        method: "cash",
      });
      const unknown = await send("POST", "/expenses", {
        spentOn: TODAY,
        category: "yacht",
        amount: "10",
        method: "cash",
      });

      expect(future.statusCode).toBe(400);
      expect(unknown.statusCode).toBe(400);
    });

    it("reverses an expense with a new row, leaving the original on file", async () => {
      const created = await send("POST", "/expenses", {
        spentOn: TODAY,
        category: "other",
        amount: "40",
        method: "cash",
      });
      const id = (created.json() as Expense).id;

      const reversed = await send("POST", `/expenses/${id}/reverse`, { reason: "Entered twice" });
      expect(reversed.statusCode).toBe(201);
      expect((reversed.json() as Expense).amount).toBe("-40.00");

      const again = await send("POST", `/expenses/${id}/reverse`, { reason: "Entered twice" });
      expect(again.statusCode).toBe(400);

      const page = (await send("GET", `/expenses?month=${THIS_MONTH}`)).json() as ExpensesPage;
      expect(page.monthTotal).toBe("600.00");
    });

    it("keeps expenses from everybody but the admin", async () => {
      for (const role of [USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN]) {
        expect(
          (await send("GET", `/expenses?month=${THIS_MONTH}`, undefined, role)).statusCode,
        ).toBe(403);
      }
    });
  });

  describe("staff percentages", () => {
    it("pays a receptionist a percentage of what patients paid this month", async () => {
      const receptionist = clinic.userIds[USER_ROLE.RECEPTIONIST];

      expect(
        (
          await send("PUT", `/payroll/plans/${receptionist}`, {
            kind: "salary_and_percentage",
            effectiveMonth: THIS_MONTH,
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await send("PUT", `/payroll/salaries/${receptionist}`, {
            monthlyAmount: "1000",
            effectiveMonth: THIS_MONTH,
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await send("PUT", `/payroll/share-terms/${receptionist}`, {
            basis: "collections",
            percent: 10,
            effectiveMonth: THIS_MONTH,
          })
        ).statusCode,
      ).toBe(200);

      const line = await lineOf(USER_ROLE.RECEPTIONIST);

      expect(line).toMatchObject({
        shareBasis: "collections",
        shareRate: 10,
        percentBase: "2000.00",
        percentShare: "200.00",
        due: "1200.00",
      });
    });

    it("refuses a treatments share for somebody who treats no patients", async () => {
      const response = await send(
        "PUT",
        `/payroll/share-terms/${clinic.userIds[USER_ROLE.RECEPTIONIST]}`,
        { basis: "treatments", percent: 0, effectiveMonth: THIS_MONTH },
      );

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ message: PAYROLL_ERROR.NOT_A_DOCTOR });
    });

    it("pays a share of the month's profit, worked out before profit shares", async () => {
      const technician = clinic.userIds[USER_ROLE.TECHNICIAN];

      await send("PUT", `/payroll/plans/${technician}`, {
        kind: "percentage",
        effectiveMonth: THIS_MONTH,
      });
      await send("PUT", `/payroll/share-terms/${technician}`, {
        basis: "profit",
        percent: 5,
        effectiveMonth: THIS_MONTH,
      });

      const report = await payroll();
      const line = report.lines.find((entry) => entry.userId === technician);

      expect(line?.percentBase).toBe(report.profit.beforeShares);
      expect(line?.percentShare).toBe(percentOf(report.profit.beforeShares, 5));
      expect(report.profit.profitShares).toBe(line?.percentShare);
    });
  });

  describe("the month's profit", () => {
    it("takes every cost off what patients paid, then the profit shares", async () => {
      const { profit } = await payroll();
      const costs = [
        profit.staffPay,
        profit.doctorShares,
        profit.labs,
        profit.stock,
        profit.expenses,
      ].reduce((sum, amount) => addMoney(sum, amount), "0.00");

      expect(profit.collections).toBe("2000.00");
      expect(profit.expenses).toBe("600.00");
      expect(profit.beforeShares).toBe(subtractMoney(profit.collections, costs));
      expect(profit.ownerProfit).toBe(subtractMoney(profit.beforeShares, profit.profitShares));
    });

    it("records the owner's draw when the month closes and locks its expenses", async () => {
      const before = await payroll();
      expect(before.draw).toBeNull();

      expect((await send("POST", `/payroll/${THIS_MONTH}/close`, {})).statusCode).toBe(201);

      const after = await payroll();
      expect(after.draw).toMatchObject({ month: THIS_MONTH, amount: before.profit.ownerProfit });
      expect(after.profit).toEqual(before.profit);

      const draws = (await send("GET", "/payroll/owner-draws")).json() as OwnerDraw[];
      expect(draws[0]?.month).toBe(THIS_MONTH);

      const late = await send("POST", "/expenses", {
        spentOn: TODAY,
        category: "rent",
        amount: "10",
        method: "cash",
      });
      expect(late.statusCode).toBe(409);
      expect(late.json()).toMatchObject({ message: PAYROLL_ERROR.MONTH_CLOSED });
    });
  });
});
