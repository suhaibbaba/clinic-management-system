import {
  AI_ACTION_CHECK,
  AI_PROPOSAL_KIND,
  AI_TOOL,
  AI_TOOL_ERROR,
  APPOINTMENT_STATUS,
  ITEM_CATEGORY,
  ITEM_UNIT,
  PAYMENT_METHOD,
  USER_ROLE,
  type UserRole,
} from "@clinic/shared";
import { eq } from "drizzle-orm";
import { TYPED_PHRASES } from "@api/ai/actions/ai-actions.service";
import { AiConversationsService } from "@api/ai/ai-conversations.service";
import { ToolRunnerService } from "@api/ai/tools/tool-runner.service";
import {
  appointments,
  clinics,
  doctors,
  labPayments,
  payments,
  stockMovements,
} from "@api/database/schema";
import { createPatient, seedClinicFixtures, nameParts } from "@test/helpers/patient-fixtures";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

function monday(weeksAhead: number): string {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + ((8 - day.getUTCDay()) % 7 || 7) + weeksAhead * 7);

  return day.toISOString().slice(0, 10);
}

interface ToolResult {
  error?: string;
  result?: Record<string, unknown> & {
    status?: string;
    check?: string;
    reason?: string;
    proposal_id?: string;
    tier?: string;
    appointments?: { id: string }[];
  };
}

describe("Assistant schedule and money corrections (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let doctorId: string;
  let patientId: string;
  const tokens = {} as Record<UserRole, string>;

  const actor = (role: UserRole) => ({ id: clinic.userIds[role], clinicId: clinic.id, role });

  async function tool(role: UserRole, name: string, args: unknown): Promise<ToolResult> {
    const conversation = await context.app.get(AiConversationsService).start(actor(role), "تصحيح");
    const run = await context.app.get(ToolRunnerService).run(actor(role), conversation.id, {
      id: "call_1",
      name,
      arguments: JSON.stringify(args),
    });

    return JSON.parse(run.content) as ToolResult;
  }

  const confirm = (id: string, role: UserRole, typedPhrase?: string) =>
    context.app.inject({
      method: "POST",
      url: `/ai/proposals/${id}/confirm`,
      headers: auth(tokens[role]),
      payload: typedPhrase === undefined ? {} : { typedPhrase },
    });

  async function post(role: UserRole, url: string, payload: unknown): Promise<string> {
    const response = await context.app.inject({
      method: "POST",
      url,
      headers: auth(tokens[role]),
      payload: payload as Record<string, unknown>,
    });

    expect(response.statusCode).toBe(201);

    return (response.json() as { id: string }).id;
  }

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();

    for (const role of [
      USER_ROLE.ADMIN,
      USER_ROLE.DOCTOR,
      USER_ROLE.TECHNICIAN,
      USER_ROLE.RECEPTIONIST,
    ] as const) {
      tokens[role] = await context.login(clinic.phones[role]);
    }

    ({ doctorId } = await seedClinicFixtures(context, clinic, tokens[USER_ROLE.ADMIN]));

    await context.db
      .update(clinics)
      .set({
        workingHours: [0, 1, 2, 3, 4].map((weekday) => ({
          weekday,
          ranges: [{ start: "08:00", end: "18:00" }],
        })),
        settings: { timezone: "Asia/Hebron" },
      })
      .where(eq(clinics.id, clinic.id));

    patientId = await createPatient(context, tokens[USER_ROLE.RECEPTIONIST], {
      ...nameParts("رامي عودة"),
      phone: "0599000444",
    });
  });

  afterAll(async () => {
    await context.close();
  });

  describe("set_doctor_schedule", () => {
    it("warns about appointments the new hours leave outside, then keeps them booked", async () => {
      const day = monday(2);
      const appointmentId = await post(USER_ROLE.RECEPTIONIST, "/appointments", {
        patientId,
        doctorId,
        startsAt: new Date(`${day}T15:00:00+03:00`).toISOString(),
        durationMinutes: 30,
      });
      const change = {
        doctor_id: doctorId,
        days: [{ weekday: 1, ranges: [{ start: "09:00", end: "13:00" }] }],
      };

      const asked = await tool(USER_ROLE.ADMIN, AI_TOOL.SET_DOCTOR_SCHEDULE, change);

      expect(asked.result).toMatchObject({
        status: "sanity_check",
        check: AI_ACTION_CHECK.OUTSIDE_SCHEDULE,
      });
      expect(asked.result?.appointments?.map((item) => item.id)).toEqual([appointmentId]);

      const { result } = await tool(USER_ROLE.ADMIN, AI_TOOL.SET_DOCTOR_SCHEDULE, {
        ...change,
        acknowledge: [AI_ACTION_CHECK.OUTSIDE_SCHEDULE],
      });

      expect((await confirm(result?.proposal_id ?? "", USER_ROLE.ADMIN)).statusCode).toBe(200);

      const [doctor] = await context.db
        .select({ weeklySchedule: doctors.weeklySchedule })
        .from(doctors)
        .where(eq(doctors.id, doctorId));

      expect(doctor?.weeklySchedule).toEqual([
        { weekday: 1, ranges: [{ start: "09:00", end: "13:00" }] },
      ]);

      const [appointment] = await context.db
        .select({ status: appointments.status })
        .from(appointments)
        .where(eq(appointments.id, appointmentId));

      expect(appointment?.status).toBe(APPOINTMENT_STATUS.CONFIRMED);
    });

    it("adds a working day and leaves the others as they were", async () => {
      const { result } = await tool(USER_ROLE.ADMIN, AI_TOOL.SET_DOCTOR_SCHEDULE, {
        doctor_id: doctorId,
        days: [{ weekday: 3, ranges: [{ start: "10:00", end: "14:00" }] }],
      });

      expect(result).toMatchObject({ status: "awaiting_user_confirmation", tier: "confirm" });
      expect((await confirm(result?.proposal_id ?? "", USER_ROLE.ADMIN)).statusCode).toBe(200);

      const [doctor] = await context.db
        .select({ weeklySchedule: doctors.weeklySchedule })
        .from(doctors)
        .where(eq(doctors.id, doctorId));

      expect(doctor?.weeklySchedule.map((day) => day.weekday)).toEqual([1, 3]);
    });

    it("is not permitted to a receptionist", async () => {
      const { error } = await tool(USER_ROLE.RECEPTIONIST, AI_TOOL.SET_DOCTOR_SCHEDULE, {
        doctor_id: doctorId,
        days: [{ weekday: 2, ranges: [] }],
      });

      expect(error).toBe(AI_TOOL_ERROR.NOT_PERMITTED);
    });
  });

  describe("reverse_payment", () => {
    it("reverses behind a typed phrase, and only once", async () => {
      const paymentId = await post(USER_ROLE.RECEPTIONIST, "/payments", {
        patientId,
        amount: "100",
        method: PAYMENT_METHOD.CASH,
      });

      const { result } = await tool(USER_ROLE.ADMIN, AI_TOOL.REVERSE_PAYMENT, {
        payment_id: paymentId,
        reason: "سُجّلت مرتين",
      });

      expect(result).toMatchObject({ status: "awaiting_user_confirmation", tier: "typed" });

      const phrase = TYPED_PHRASES[AI_PROPOSAL_KIND.PAYMENT_REVERSE];

      expect((await confirm(result?.proposal_id ?? "", USER_ROLE.ADMIN, phrase)).statusCode).toBe(
        200,
      );

      const reversals = await context.db
        .select({ amount: payments.amount })
        .from(payments)
        .where(eq(payments.reversesId, paymentId));

      expect(reversals).toEqual([{ amount: "-100.00" }]);

      const again = await tool(USER_ROLE.ADMIN, AI_TOOL.REVERSE_PAYMENT, {
        payment_id: paymentId,
        reason: "مرة ثانية",
      });

      expect(again.result).toMatchObject({ status: "not_possible", reason: "already_reversed" });
    });

    it("is not permitted to a receptionist", async () => {
      const paymentId = await post(USER_ROLE.RECEPTIONIST, "/payments", {
        patientId,
        amount: "50",
        method: PAYMENT_METHOD.CASH,
      });

      const { error } = await tool(USER_ROLE.RECEPTIONIST, AI_TOOL.REVERSE_PAYMENT, {
        payment_id: paymentId,
        reason: "خطأ",
      });

      expect(error).toBe(AI_TOOL_ERROR.NOT_PERMITTED);
    });
  });

  describe("lab payments", () => {
    it("asks before paying a lab more than it is owed, then records and reverses it", async () => {
      const labId = await post(USER_ROLE.TECHNICIAN, "/labs", {
        name: "مخبر الشفاء",
        phone: "+963110000002",
      });
      const payment = { lab_id: labId, amount: 200, method: PAYMENT_METHOD.CASH };

      const asked = await tool(USER_ROLE.TECHNICIAN, AI_TOOL.RECORD_LAB_PAYMENT, payment);

      expect(asked.result).toMatchObject({
        status: "sanity_check",
        check: AI_ACTION_CHECK.EXCEEDS_BALANCE,
      });

      const drafted = await tool(USER_ROLE.TECHNICIAN, AI_TOOL.RECORD_LAB_PAYMENT, {
        ...payment,
        acknowledge: [AI_ACTION_CHECK.EXCEEDS_BALANCE],
      });

      expect(
        (await confirm(drafted.result?.proposal_id ?? "", USER_ROLE.TECHNICIAN)).statusCode,
      ).toBe(200);

      const [recorded] = await context.db
        .select({ id: labPayments.id, amount: labPayments.amount })
        .from(labPayments)
        .where(eq(labPayments.labId, labId));

      expect(recorded?.amount).toBe("200.00");

      const { result } = await tool(USER_ROLE.ADMIN, AI_TOOL.REVERSE_LAB_PAYMENT, {
        lab_payment_id: recorded?.id,
        reason: "دفعة لمختبر آخر",
      });
      const phrase = TYPED_PHRASES[AI_PROPOSAL_KIND.LAB_PAYMENT_REVERSE];

      expect((await confirm(result?.proposal_id ?? "", USER_ROLE.ADMIN, phrase)).statusCode).toBe(
        200,
      );

      const reversals = await context.db
        .select()
        .from(labPayments)
        .where(eq(labPayments.reversesId, recorded?.id ?? ""));

      expect(reversals).toHaveLength(1);
    });
  });

  describe("reverse_stock_movement", () => {
    it("reverses a purchase recorded by mistake behind a typed phrase", async () => {
      const itemId = await post(USER_ROLE.TECHNICIAN, "/inventory/items", {
        name: "إبر تخدير",
        category: ITEM_CATEGORY.CONSUMABLE,
        unit: ITEM_UNIT.PIECE,
        minQuantity: "5",
      });
      const movementId = await post(USER_ROLE.TECHNICIAN, "/inventory/movements/purchase", {
        itemId,
        quantity: "20",
      });

      const { result } = await tool(USER_ROLE.ADMIN, AI_TOOL.REVERSE_STOCK_MOVEMENT, {
        movement_id: movementId,
        reason: "الكمية لمادة أخرى",
      });

      expect(result).toMatchObject({ tier: "typed" });

      const phrase = TYPED_PHRASES[AI_PROPOSAL_KIND.STOCK_REVERSE];

      expect((await confirm(result?.proposal_id ?? "", USER_ROLE.ADMIN, phrase)).statusCode).toBe(
        200,
      );

      const reversals = await context.db
        .select({ quantity: stockMovements.quantity })
        .from(stockMovements)
        .where(eq(stockMovements.reversesId, movementId));

      expect(reversals).toHaveLength(1);
      expect(Number(reversals[0]?.quantity)).toBe(-20);
    });
  });
});
