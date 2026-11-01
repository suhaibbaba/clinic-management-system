import {
  PAYROLL_ERROR,
  USER_ROLE,
  addMoney,
  subtractMoney,
  type DoctorSettlement,
  type OwnSettlement,
  type Payroll,
  type PerformedProcedure,
  type SettlementPayout,
  type SettlementTreatment,
  type TreatmentSettlementStatus,
  type UserRole,
} from "@clinic/shared";
import { doctors } from "@api/database/schema";
import {
  createPatient,
  nameParts,
  seedClinicFixtures,
  uniquePhone,
  type PatientFixtures,
} from "@test/helpers/patient-fixtures";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";
import { clinicMonth } from "@test/helpers/clinic-time";

const THIS_MONTH = clinicMonth();
const AROUND = "from=2000-01-01&to=2099-12-31";

describe("Percentage pay (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let fixtures: PatientFixtures;
  let visitorId: string;
  let patientId: string;
  let exemptId: string;
  const tokens = {} as Record<UserRole, string>;

  const as = (role: UserRole) => auth(tokens[role]);

  const send = (method: "GET" | "POST" | "PUT" | "PATCH", url: string, payload?: unknown) =>
    context.app.inject({
      method,
      url,
      headers: as(USER_ROLE.ADMIN),
      ...(payload !== undefined && { payload: payload as Record<string, unknown> }),
    });

  const rules = async (payload: Record<string, unknown>) => {
    const response = await send("PUT", "/payroll/pay-rules", {
      clinicSharePercent: 0,
      taxPercent: 0,
      overheadPercent: 0,
      basis: "done",
      labCostBearer: "shared",
      effectiveMonth: THIS_MONTH,
      ...payload,
    });

    expect(response.statusCode).toBe(200);
  };

  const treat = async (payload: Record<string, unknown>) => {
    const response = await context.app.inject({
      method: "POST",
      url: "/performed-procedures",
      headers: as(USER_ROLE.DOCTOR),
      payload: {
        patientId,
        doctorId: visitorId,
        procedureId: fixtures.catalogId,
        status: "done",
        price: "1000",
        ...payload,
      },
    });

    expect(response.statusCode).toBe(201);
    return (response.json() as PerformedProcedure).id;
  };

  const settlement = async (doctorId = visitorId, query = "") => {
    const response = await send("GET", `/doctors/${doctorId}/settlement?${AROUND}${query}`);

    expect(response.statusCode).toBe(200);
    return response.json() as DoctorSettlement;
  };

  const line = async (id: string, doctorId = visitorId): Promise<SettlementTreatment | undefined> =>
    (await settlement(doctorId)).treatments.find((row) => row.id === id);

  const adjust = (id: string, payload: Record<string, unknown>) =>
    send("PATCH", `/settlement-treatments/${id}`, payload);

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();

    for (const role of [
      USER_ROLE.ADMIN,
      USER_ROLE.DOCTOR,
      USER_ROLE.VISITING_DOCTOR,
      USER_ROLE.RECEPTIONIST,
    ]) {
      tokens[role] = await context.login(clinic.phones[role]);
    }

    fixtures = await seedClinicFixtures(context, clinic, tokens[USER_ROLE.ADMIN]);

    const [visitor] = await context.db
      .insert(doctors)
      .values({
        clinicId: clinic.id,
        userId: clinic.userIds[USER_ROLE.VISITING_DOCTOR],
        specialtyId: clinic.specialtyId,
      })
      .returning({ id: doctors.id });
    visitorId = visitor!.id;

    patientId = await createPatient(context, tokens[USER_ROLE.DOCTOR], {
      ...nameParts("رنا خالد سمير"),
      phone: uniquePhone(),
    });

    const exempt = await send("POST", "/procedure-catalog", {
      specialtyId: clinic.specialtyId,
      code: `EX${Date.now() % 100000}`,
      name: { en: "Whitening" },
      defaultPrice: "1000",
      taxExempt: true,
    });
    expect(exempt.statusCode).toBe(201);
    exemptId = (exempt.json() as { id: string }).id;

    for (const [doctorId, clinicSharePercent] of [
      [visitorId, 40],
      [fixtures.doctorId, 50],
    ] as const) {
      const terms = await send("PUT", `/doctors/${doctorId}/settlement-terms`, {
        clinicSharePercent,
        effectiveMonth: THIS_MONTH,
      });
      expect(terms.statusCode).toBe(200);
    }
  });

  afterAll(async () => {
    await context.close();
  });

  describe("what a treatment pays", () => {
    it("takes tax, operating expenses and materials off before the split", async () => {
      await rules({ taxPercent: 10, overheadPercent: 10 });
      const id = await treat({});
      expect((await adjust(id, { materialCost: "200" })).statusCode).toBe(204);

      expect(await line(id)).toMatchObject({
        revenue: "1000.00",
        tax: "100.00",
        overhead: "100.00",
        materialCost: "200.00",
        net: "600.00",
        clinicShare: "240.00",
        doctorShare: "360.00",
        status: "unpaid",
      });
    });

    it("charges no tax on a treatment type the clinic marked tax-exempt", async () => {
      await rules({ taxPercent: 10, overheadPercent: 10 });
      const id = await treat({ procedureId: exemptId });

      expect(await line(id)).toMatchObject({ tax: "0.00", overhead: "100.00", net: "900.00" });
    });

    it("charges the materials to the doctor alone when the clinic says so", async () => {
      await rules({ taxPercent: 10, overheadPercent: 10, labCostBearer: "doctor" });
      const id = await treat({});
      await adjust(id, { materialCost: "200" });

      expect(await line(id)).toMatchObject({
        net: "800.00",
        clinicShare: "320.00",
        doctorShare: "280.00",
      });
    });

    it("splits one treatment between two doctors, each at their own rate", async () => {
      await rules({});
      const plan = await send("PUT", `/payroll/plans/${clinic.userIds[USER_ROLE.DOCTOR]}`, {
        kind: "percentage",
        effectiveMonth: THIS_MONTH,
      });
      expect(plan.statusCode).toBe(200);

      const id = await treat({});
      const split = await adjust(id, {
        shareSplit: [
          { doctorId: visitorId, workPercent: 50 },
          { doctorId: fixtures.doctorId, workPercent: 50 },
        ],
      });
      expect(split.statusCode).toBe(204);

      expect(await line(id)).toMatchObject({ workPercent: 50, doctorShare: "300.00" });
      expect(await line(id, fixtures.doctorId)).toMatchObject({
        workPercent: 50,
        clinicShare: "250.00",
        doctorShare: "250.00",
      });
    });

    it("refuses a split that does not add up to the whole treatment", async () => {
      const id = await treat({});
      const split = await adjust(id, {
        shareSplit: [
          { doctorId: visitorId, workPercent: 60 },
          { doctorId: fixtures.doctorId, workPercent: 60 },
        ],
      });

      expect(split.statusCode).toBe(400);
    });

    it("pays nothing for a redo the clinic waived, and keeps the reason", async () => {
      const id = await treat({});
      await adjust(id, { shareWaivedReason: "إعادة عمل سابق" });

      expect(await line(id)).toMatchObject({
        doctorShare: "0.00",
        waivedReason: "إعادة عمل سابق",
      });
    });

    it("never lets a rate reach back into a past month", async () => {
      const response = await send("PUT", `/doctors/${visitorId}/settlement-terms`, {
        clinicSharePercent: 10,
        effectiveMonth: "2020-01",
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ message: PAYROLL_ERROR.PAST_MONTH });
    });
  });

  describe("paying a doctor for particular patients", () => {
    let paidFor: string;
    let payout: SettlementPayout;

    beforeAll(async () => {
      await rules({});
      paidFor = await treat({});
    });

    it("records which treatments a payout covers", async () => {
      const response = await send("POST", `/doctors/${visitorId}/payouts`, {
        method: "cash",
        treatmentIds: [paidFor],
      });

      expect(response.statusCode).toBe(201);
      payout = response.json() as SettlementPayout;
      expect(payout.amount).toBe("600.00");
      expect(payout.items).toEqual([
        expect.objectContaining({ treatmentId: paidFor, patientId, amount: "600.00" }),
      ]);
      expect(await line(paidFor)).toMatchObject({ status: "paid", outstanding: "0.00" });
    });

    it("refuses to pay the same treatment twice", async () => {
      const response = await send("POST", `/doctors/${visitorId}/payouts`, {
        method: "cash",
        treatmentIds: [paidFor],
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ message: PAYROLL_ERROR.NOTHING_TO_PAY });
    });

    it("turns a later change into a correction for the next payout", async () => {
      await adjust(paidFor, { materialCost: "100" });

      expect(await line(paidFor)).toMatchObject({
        payable: "540.00",
        paid: "600.00",
        outstanding: "-60.00",
        status: "adjusted",
      });
    });

    it("filters the statement by what is still to pay", async () => {
      const unpaid = await settlement(visitorId, "&status=unpaid");

      expect(unpaid.treatments.length).toBeGreaterThan(0);
      expect(unpaid.treatments.every((row) => row.status === "unpaid")).toBe(true);
    });

    it("lists the payout with its patients and prints it", async () => {
      const report = await settlement();
      expect(report.payouts.find((row) => row.id === payout.id)?.items).toHaveLength(1);

      const pdf = await send("GET", `/doctors/${visitorId}/payouts/${payout.id}/print`);
      expect(pdf.statusCode).toBe(200);
      expect(pdf.headers["content-type"]).toContain("application/pdf");
    });

    it("frees the treatments again when the payout is reversed", async () => {
      const reversed = await send("POST", `/staff-payments/${payout.id}/reverse`, {
        reason: "دفعة خاطئة",
      });
      expect(reversed.statusCode).toBe(201);

      expect(await line(paidFor)).toMatchObject({ paid: "0.00", status: "unpaid" });
    });

    it("keeps an advance on account apart from any treatment", async () => {
      const before = await settlement();
      const response = await send("POST", `/doctors/${visitorId}/payouts`, {
        method: "cash",
        amount: "100",
      });

      expect(response.statusCode).toBe(201);
      expect((response.json() as SettlementPayout).items).toEqual([]);
      expect(Number((await settlement()).balance)).toBe(Number(before.balance) - 100);
    });
  });

  describe("paying on what the patient has paid", () => {
    it("makes a treatment payable only as far as the patient's payments cover it", async () => {
      const payer = await createPatient(context, tokens[USER_ROLE.DOCTOR], {
        ...nameParts("هادي سامي يونس"),
        phone: uniquePhone(),
      });
      await rules({ basis: "collected" });
      const older = await treat({ patientId: payer });
      const newer = await treat({ patientId: payer });

      const payment = await send("POST", "/payments", {
        patientId: payer,
        amount: "1500",
        method: "cash",
      });
      expect(payment.statusCode).toBe(201);

      expect(await line(older)).toMatchObject({ collectedPercent: 100, payable: "600.00" });
      expect(await line(newer)).toMatchObject({ collectedPercent: 50, payable: "300.00" });

      await rules({});
    });
  });

  describe("pay plans", () => {
    it("pays a percentage-only doctor no salary, and shows the month's share", async () => {
      const doctorUser = clinic.userIds[USER_ROLE.DOCTOR];
      await send("PUT", `/payroll/salaries/${doctorUser}`, {
        monthlyAmount: "4000",
        effectiveMonth: THIS_MONTH,
      });

      const month = async () =>
        ((await send("GET", `/payroll/${THIS_MONTH}`)).json() as Payroll).lines.find(
          (entry) => entry.userId === doctorUser,
        );

      expect(await month()).toMatchObject({ plan: "percentage", base: "0.00" });
      expect(Number((await month())?.share)).toBeGreaterThan(0);

      await send("PUT", `/payroll/plans/${doctorUser}`, {
        kind: "salary_and_percentage",
        effectiveMonth: THIS_MONTH,
      });
      expect(await month()).toMatchObject({ plan: "salary_and_percentage", base: "4000.00" });

      const both = await month();
      expect(both?.expected).toBe(addMoney(both?.due ?? "0.00", both?.sharePayable ?? "0.00"));
      expect(both?.owed).toBe(subtractMoney(both?.expected ?? "0.00", both?.received ?? "0.00"));
    });

    it("lists a visiting doctor on their share alone", async () => {
      const report = (await send("GET", `/payroll/${THIS_MONTH}`)).json() as Payroll;
      const visitor = report.lines.find(
        (entry) => entry.userId === clinic.userIds[USER_ROLE.VISITING_DOCTOR],
      );

      expect(visitor).toMatchObject({
        plan: "percentage",
        planKinds: ["percentage"],
        employee: false,
        base: "0.00",
        due: "0.00",
      });
      expect(visitor?.expected).toBe(visitor?.sharePayable);
    });

    it("puts anybody on a percentage, but a treatments share only on who treats patients", async () => {
      const receptionist = clinic.userIds[USER_ROLE.RECEPTIONIST];
      const plan = await send("PUT", `/payroll/plans/${receptionist}`, {
        kind: "percentage",
        effectiveMonth: THIS_MONTH,
      });
      const treatments = await send("PUT", `/payroll/share-terms/${receptionist}`, {
        basis: "treatments",
        percent: 0,
        effectiveMonth: THIS_MONTH,
      });

      expect(plan.statusCode).toBe(200);
      expect(treatments.statusCode).toBe(400);
      expect(treatments.json()).toMatchObject({ message: PAYROLL_ERROR.NOT_A_DOCTOR });

      await send("PUT", `/payroll/plans/${receptionist}`, {
        kind: "salary",
        effectiveMonth: THIS_MONTH,
      });
    });

    it("keeps a visiting doctor on a percentage", async () => {
      const response = await send(
        "PUT",
        `/payroll/plans/${clinic.userIds[USER_ROLE.VISITING_DOCTOR]}`,
        { kind: "salary", effectiveMonth: THIS_MONTH },
      );

      expect(response.statusCode).toBe(400);
    });
  });

  describe("the clinic's general rate", () => {
    const rate = (clinicSharePercent: number | null) =>
      send("PUT", `/doctors/${visitorId}/settlement-terms`, {
        clinicSharePercent,
        effectiveMonth: THIS_MONTH,
      });

    afterAll(async () => {
      await rules({});
      await rate(40);
    });

    it("lets a doctor follow it, keep their own rate over it, and follow it again", async () => {
      await rules({ clinicSharePercent: 50 });
      expect((await rate(null)).statusCode).toBe(200);
      const id = await treat({});

      expect(await settlement()).toMatchObject({
        clinicSharePercent: 50,
        clinicShareOwn: null,
        clinicShareDefault: 50,
      });
      expect(await line(id)).toMatchObject({
        clinicSharePercent: 50,
        clinicSharePercentSet: false,
      });

      await rules({ clinicSharePercent: 60 });
      expect(await line(id)).toMatchObject({ clinicSharePercent: 60 });

      await rate(20);
      await rules({ clinicSharePercent: 70 });
      expect(await settlement()).toMatchObject({ clinicSharePercent: 20, clinicShareOwn: 20 });
      expect(await line(id)).toMatchObject({ clinicSharePercent: 20 });

      await rate(null);
      expect(await line(id)).toMatchObject({ clinicSharePercent: 70 });
    });
  });

  describe("who sees it", () => {
    it("shows a doctor their own statement only once the clinic allows it", async () => {
      const own = () =>
        context.app.inject({
          method: "GET",
          url: `/me/settlement?${AROUND}`,
          headers: as(USER_ROLE.VISITING_DOCTOR),
        });

      expect((await own()).statusCode).toBe(403);

      const grant = (allowed: boolean) =>
        send("PATCH", "/permissions", {
          role: USER_ROLE.VISITING_DOCTOR,
          capability: "my-settlement.statement",
          allowed,
        });

      expect((await grant(true)).statusCode).toBe(204);

      try {
        const response = await own();
        expect(response.statusCode).toBe(200);

        const statement = response.json() as OwnSettlement;
        expect(statement.lines.length).toBeGreaterThan(0);
        expect(statement.lines[0]).not.toHaveProperty("clinicShare");
        expect(statement.lines[0]).not.toHaveProperty("clinicSharePercent");
      } finally {
        await grant(false);
      }
    });

    it("shows the admin, on the patient's file, which treatments the doctor was paid for", async () => {
      const response = await send("GET", `/patients/${patientId}/settlement-status`);

      expect(response.statusCode).toBe(200);
      expect((response.json() as TreatmentSettlementStatus[]).length).toBeGreaterThan(0);

      for (const role of [USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST]) {
        const denied = await context.app.inject({
          method: "GET",
          url: `/patients/${patientId}/settlement-status`,
          headers: as(role),
        });

        expect({ role, status: denied.statusCode }).toEqual({ role, status: 403 });
      }
    });
  });
});
