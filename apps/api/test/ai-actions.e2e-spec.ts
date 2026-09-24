import {
  AI_ACTION_CHECK,
  AI_ACTION_ERROR,
  AI_MESSAGE_ROLE,
  AI_OUTBOUND_ERROR,
  AI_PROPOSAL_STATUS,
  AI_RISK_TIER,
  AI_TOOL,
  AUDIT_ACTION,
  USER_ROLE,
  type UserRole,
} from "@clinic/shared";
import { and, count, eq } from "drizzle-orm";
import { AiActionsService, TYPED_PHRASES } from "@api/ai/actions/ai-actions.service";
import { AiConversationsService } from "@api/ai/ai-conversations.service";
import { ToolRunnerService } from "@api/ai/tools/tool-runner.service";
import {
  aiAuditLog,
  aiProposals,
  appointments,
  auditLog,
  clinics,
  visits,
} from "@api/database/schema";
import { PermissionsService } from "@api/permissions/permissions.service";
import { createPatient, seedClinicFixtures, nameParts } from "@test/helpers/patient-fixtures";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

/** A Monday, the only day the test clinic and its doctor work, far enough out to stay bookable. */
function monday(weeksAhead: number): string {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + ((8 - day.getUTCDay()) % 7 || 7) + weeksAhead * 7);

  return day.toISOString().slice(0, 10);
}

interface ToolResult {
  error?: string;
  result?: Record<string, unknown> & { status?: string; check?: string; proposal_id?: string };
}

describe("Assistant actions (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let doctorId: string;
  let patientId: string;
  const tokens = {} as Record<UserRole, string>;

  const actor = (role: UserRole) => ({ id: clinic.userIds[role], clinicId: clinic.id, role });

  async function tool(role: UserRole, name: string, args: unknown): Promise<ToolResult> {
    const conversation = await context.app.get(AiConversationsService).start(actor(role), "إجراء");
    const run = await context.app.get(ToolRunnerService).run(actor(role), conversation.id, {
      id: "call_1",
      name,
      arguments: JSON.stringify(args),
    });

    return JSON.parse(run.content) as ToolResult;
  }

  async function book(date: string, time: string): Promise<string> {
    const response = await context.app.inject({
      method: "POST",
      url: "/appointments",
      headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      payload: {
        patientId,
        doctorId,
        startsAt: new Date(`${date}T${time}:00+03:00`).toISOString(),
        durationMinutes: 30,
      },
    });

    expect(response.statusCode).toBe(201);

    return (response.json() as { id: string }).id;
  }

  const confirm = (id: string, typedPhrase?: string, role: UserRole = USER_ROLE.RECEPTIONIST) =>
    context.app.inject({
      method: "POST",
      url: `/ai/proposals/${id}/confirm`,
      headers: auth(tokens[role]),
      payload: typedPhrase === undefined ? {} : { typedPhrase },
    });

  const proposalCount = async (): Promise<number> => {
    const [row] = await context.db
      .select({ value: count() })
      .from(aiProposals)
      .where(eq(aiProposals.clinicId, clinic.id));

    return row?.value ?? 0;
  };

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();

    for (const role of [USER_ROLE.ADMIN, USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST] as const) {
      tokens[role] = await context.login(clinic.phones[role]);
    }

    ({ doctorId } = await seedClinicFixtures(context, clinic, tokens[USER_ROLE.ADMIN]));

    await context.db
      .update(clinics)
      .set({
        workingHours: [{ weekday: 1, ranges: [{ start: "09:00", end: "17:00" }] }],
        settings: { timezone: "Asia/Hebron" },
      })
      .where(eq(clinics.id, clinic.id));
    patientId = await createPatient(context, tokens[USER_ROLE.RECEPTIONIST], {
      ...nameParts("سمير خليل"),
      phone: "0599000111",
    });
  });

  afterAll(async () => {
    await context.close();
  });

  describe("the tier", () => {
    it.each([
      ["the code's own", AI_RISK_TIER.CONFIRM, undefined, AI_RISK_TIER.AUTO, AI_RISK_TIER.CONFIRM],
      ["the clinic's floor", AI_RISK_TIER.AUTO, AI_RISK_TIER.CONFIRM, AI_RISK_TIER.AUTO, "confirm"],
      ["the call's escalation", AI_RISK_TIER.CONFIRM, undefined, AI_RISK_TIER.TYPED, "typed"],
      [
        "never a clinic's lower one",
        AI_RISK_TIER.TYPED,
        AI_RISK_TIER.AUTO,
        AI_RISK_TIER.AUTO,
        "typed",
      ],
    ] as const)("takes %s when it is the strictest", (_case, code, clinicFloor, call, expected) => {
      expect(AiActionsService.resolveTier(code, clinicFloor, call)).toBe(expected);
    });
  });

  describe("an action that runs at once", () => {
    it("marks an arrival, with the assistant's audit row and the domain's own entry", async () => {
      const appointmentId = await book(monday(1), "10:00");

      const { result } = await tool(USER_ROLE.RECEPTIONIST, AI_TOOL.SET_APPOINTMENT_STATUS, {
        appointment_id: appointmentId,
        status: "arrived",
      });

      expect(result?.status).toBe("done");

      const [assistantRow] = await context.db
        .select()
        .from(aiAuditLog)
        .where(
          and(
            eq(aiAuditLog.clinicId, clinic.id),
            eq(aiAuditLog.toolName, AI_TOOL.SET_APPOINTMENT_STATUS),
          ),
        );

      expect(assistantRow).toMatchObject({
        outcome: "ok",
        entity: "appointments",
        entityId: appointmentId,
      });

      const domainRows = await context.db
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.clinicId, clinic.id), eq(auditLog.entityId, appointmentId)));
      const update = domainRows.find((row) => row.action === AUDIT_ACTION.UPDATE);

      expect(update?.oldValue).toMatchObject({ status: "confirmed" });
      expect(update?.newValue).toMatchObject({ status: "arrived" });
    });

    it("waits on a card instead once the clinic raises its floor", async () => {
      const appointmentId = await book(monday(1), "11:00");
      const settings = await context.app.inject({
        method: "PUT",
        url: "/ai/actions/settings",
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { minTier: { [AI_TOOL.SET_APPOINTMENT_STATUS]: AI_RISK_TIER.CONFIRM } },
      });

      expect(settings.statusCode).toBe(200);

      const { result } = await tool(USER_ROLE.RECEPTIONIST, AI_TOOL.SET_APPOINTMENT_STATUS, {
        appointment_id: appointmentId,
        status: "arrived",
      });

      expect(result).toMatchObject({ status: "awaiting_user_confirmation", tier: "confirm" });

      await context.app.inject({
        method: "PUT",
        url: "/ai/actions/settings",
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: {},
      });
    });

    it("refuses a tool the clinic switched off", async () => {
      await context.app.inject({
        method: "PUT",
        url: "/ai/actions/settings",
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: { disabled: [AI_TOOL.ADD_PATIENT_NOTE] },
      });

      const outcome = await tool(USER_ROLE.RECEPTIONIST, AI_TOOL.ADD_PATIENT_NOTE, {
        patient_id: patientId,
        note: "يفضّل المواعيد الصباحية",
      });

      expect(outcome.error).toBe("disabled");

      await context.app.inject({
        method: "PUT",
        url: "/ai/actions/settings",
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: {},
      });
    });
  });

  describe("booking", () => {
    it("answers slot_taken for a booked time and writes nothing", async () => {
      await book(monday(2), "10:00");
      const [before] = await context.db
        .select({ value: count() })
        .from(appointments)
        .where(eq(appointments.clinicId, clinic.id));
      const proposalsBefore = await proposalCount();

      const { result } = await tool(USER_ROLE.RECEPTIONIST, AI_TOOL.CREATE_APPOINTMENT, {
        patient_id: patientId,
        doctor_id: doctorId,
        date: monday(2),
        time: "10:00",
      });

      expect(result?.status).toBe("slot_taken");
      expect(result?.["blockers"]).toEqual([expect.objectContaining({ patientName: "سمير خليل" })]);

      const [after] = await context.db
        .select({ value: count() })
        .from(appointments)
        .where(eq(appointments.clinicId, clinic.id));

      expect(after?.value).toBe(before?.value);
      await expect(proposalCount()).resolves.toBe(proposalsBefore);
    });

    it("answers slot_unavailable on a day the clinic does not work", async () => {
      const sunday = new Date(`${monday(2)}T00:00:00Z`);
      sunday.setUTCDate(sunday.getUTCDate() - 1);

      const { result } = await tool(USER_ROLE.RECEPTIONIST, AI_TOOL.CREATE_APPOINTMENT, {
        patient_id: patientId,
        doctor_id: doctorId,
        date: sunday.toISOString().slice(0, 10),
        time: "10:00",
      });

      expect(result?.status).toBe("slot_unavailable");
      expect(result?.["closed_reason"]).toEqual(expect.any(String));
    });

    it("drafts, runs on its author's click, and refuses a second click", async () => {
      const { result } = await tool(USER_ROLE.RECEPTIONIST, AI_TOOL.CREATE_APPOINTMENT, {
        patient_id: patientId,
        doctor_id: doctorId,
        date: monday(3),
        time: "12:00",
      });

      expect(result).toMatchObject({ status: "awaiting_user_confirmation", tier: "confirm" });

      const id = result?.proposal_id ?? "";

      // Somebody else's card is a 404, whoever they are.
      expect((await confirm(id, undefined, USER_ROLE.DOCTOR)).statusCode).toBe(404);

      const first = await confirm(id);

      expect(first.statusCode).toBe(200);
      expect(first.json()).toMatchObject({
        status: AI_PROPOSAL_STATUS.DONE,
        result: { entity: "appointment", patientId },
      });

      const second = await confirm(id);

      expect(second.statusCode).toBe(409);
      expect(second.json()).toMatchObject({ message: AI_OUTBOUND_ERROR.NOT_PENDING });
    });

    // The reloaded thread draws the card the tool calls for, not a message's.
    it("serves the stored row with the tool that drafted it", async () => {
      const receptionist = actor(USER_ROLE.RECEPTIONIST);
      const conversations = context.app.get(AiConversationsService);
      const conversation = await conversations.start(receptionist, "احجز موعد");
      const { result } = await tool(USER_ROLE.RECEPTIONIST, AI_TOOL.CREATE_APPOINTMENT, {
        patient_id: patientId,
        doctor_id: doctorId,
        date: monday(3),
        time: "13:00",
      });

      await conversations.append(receptionist, conversation.id, {
        role: AI_MESSAGE_ROLE.TOOL,
        content: "{}",
        toolName: AI_TOOL.CREATE_APPOINTMENT,
        proposalId: result?.proposal_id ?? "",
      });

      await expect(conversations.messages(receptionist, conversation.id)).resolves.toEqual([
        expect.objectContaining({
          toolName: AI_TOOL.CREATE_APPOINTMENT,
          proposalId: result?.proposal_id,
        }),
      ]);
    });
  });

  describe("a payment", () => {
    it("needs the exact phrase at or above the clinic's threshold", async () => {
      const { result } = await tool(USER_ROLE.RECEPTIONIST, AI_TOOL.RECORD_PAYMENT, {
        patient_id: patientId,
        amount: 600,
        acknowledge: [AI_ACTION_CHECK.EXCEEDS_BALANCE],
      });

      expect(result).toMatchObject({ status: "awaiting_user_confirmation", tier: "typed" });

      const id = result?.proposal_id ?? "";
      const wrong = await confirm(id, "تأكيد");

      expect(wrong.statusCode).toBe(422);
      expect(wrong.json()).toMatchObject({ message: AI_ACTION_ERROR.PHRASE_MISMATCH });

      const pending = await context.app.inject({
        method: "GET",
        url: `/ai/actions/${id}`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      expect(pending.json()).toMatchObject({
        status: AI_PROPOSAL_STATUS.DRAFT,
        typedPhrase: TYPED_PHRASES.payment_create,
        summary: { amount: "600.00", patient: { id: patientId } },
      });

      const right = await confirm(id, `  ${TYPED_PHRASES.payment_create} `);

      expect(right.json()).toMatchObject({
        status: AI_PROPOSAL_STATUS.DONE,
        result: { entity: "payment", patientId },
      });
    });

    it("asks the permission again at the click", async () => {
      const { result } = await tool(USER_ROLE.RECEPTIONIST, AI_TOOL.RECORD_PAYMENT, {
        patient_id: patientId,
        amount: 50,
        acknowledge: [AI_ACTION_CHECK.EXCEEDS_BALANCE],
      });
      const permissions = context.app.get(PermissionsService);
      const admin = clinic.userIds[USER_ROLE.ADMIN];

      await permissions.set(clinic.id, USER_ROLE.RECEPTIONIST, "payments.create", false, admin);

      const refused = await confirm(result?.proposal_id ?? "");

      await permissions.set(clinic.id, USER_ROLE.RECEPTIONIST, "payments.create", true, admin);

      expect(refused.statusCode).toBe(403);
      expect(refused.json()).toMatchObject({ message: AI_ACTION_ERROR.NOT_PERMITTED });
    });
  });

  // Each one is a question for the user, returned before any proposal exists.
  describe("sanity checks", () => {
    it("stops a payment above three times what the patient owes", async () => {
      const before = await proposalCount();
      const { result } = await tool(USER_ROLE.RECEPTIONIST, AI_TOOL.RECORD_PAYMENT, {
        patient_id: patientId,
        amount: 100,
      });

      expect(result).toMatchObject({ status: "sanity_check", check: "exceeds_balance" });
      await expect(proposalCount()).resolves.toBe(before);
    });

    it("stops a cancellation of more than ten appointments", async () => {
      const date = monday(4);
      const ids: string[] = [];

      for (let hour = 9; hour < 15; hour += 1) {
        ids.push(await book(date, `${String(hour).padStart(2, "0")}:00`));
        ids.push(await book(date, `${String(hour).padStart(2, "0")}:30`));
      }

      const { result } = await tool(USER_ROLE.RECEPTIONIST, AI_TOOL.CANCEL_APPOINTMENTS, {
        appointment_ids: ids.slice(0, 11),
        reason: "إغلاق طارئ",
      });

      expect(result).toMatchObject({ status: "sanity_check", check: "large_cancellation" });
      expect(result?.["count"]).toBe(11);
    });

    it("stops a cancellation that empties a whole day, and goes typed once acknowledged", async () => {
      const date = monday(5);
      const ids = [await book(date, "09:00"), await book(date, "10:00")];

      const stopped = await tool(USER_ROLE.RECEPTIONIST, AI_TOOL.CANCEL_APPOINTMENTS, {
        appointment_ids: ids,
        reason: "سفر الطبيب",
      });

      expect(stopped).toMatchObject({ result: expect.anything() });
      expect(stopped.result).toMatchObject({ check: "large_cancellation" });

      const drafted = await tool(USER_ROLE.RECEPTIONIST, AI_TOOL.CANCEL_APPOINTMENTS, {
        appointment_ids: ids,
        reason: "سفر الطبيب",
        acknowledge: [AI_ACTION_CHECK.LARGE_CANCELLATION],
      });

      // Two is more than the default of one.
      expect(drafted.result).toMatchObject({ tier: "typed" });
    });

    it("stops an action on a patient not seen for over two years", async () => {
      const dormantId = await createPatient(context, tokens[USER_ROLE.RECEPTIONIST], {
        ...nameParts("ليلى عمر"),
        phone: "0599000222",
      });

      await context.db.insert(visits).values({
        clinicId: clinic.id,
        patientId: dormantId,
        doctorId,
        visitDate: new Date(Date.now() - 3 * 365 * 86_400_000),
      });

      const { result } = await tool(USER_ROLE.RECEPTIONIST, AI_TOOL.ADD_PATIENT_NOTE, {
        patient_id: dormantId,
        note: "اتصلت للسؤال عن موعد",
      });

      expect(result).toMatchObject({ status: "sanity_check", check: "dormant_patient" });
    });

    it("stops a new patient on a phone another patient has", async () => {
      const { result } = await tool(USER_ROLE.RECEPTIONIST, AI_TOOL.CREATE_PATIENT, {
        first_name: "سمر",
        last_name: "خليل",
        phone: "0599000111",
      });

      expect(result).toMatchObject({ status: "sanity_check", check: "possible_duplicate" });
      expect(result?.["existing"]).toEqual([expect.objectContaining({ fullName: "سمير خليل" })]);
    });
  });
});
