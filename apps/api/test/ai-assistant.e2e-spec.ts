import {
  AI_MESSAGE_ROLE,
  AI_STREAM_EVENT,
  AI_TOOL,
  USER_ROLE,
  aiViewSchema,
  type AiStreamEvent,
  type UserRole,
} from "@clinic/shared";
import { AgentService } from "@api/ai/agent.service";
import { AiConversationsService } from "@api/ai/ai-conversations.service";
import { AiToolsService } from "@api/ai/tools/ai-tools.service";
import { ToolRunnerService } from "@api/ai/tools/tool-runner.service";
import { doctors } from "@api/database/schema";
import { PermissionsService } from "@api/permissions/permissions.service";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

const ROLES = [
  USER_ROLE.ADMIN,
  USER_ROLE.DOCTOR,
  USER_ROLE.RECEPTIONIST,
  USER_ROLE.TECHNICIAN,
] as const;

// Asserted as whole sets, not one membership at a time: the failure that matters is a tool
// appearing for somebody it was never meant for.
// A visiting doctor is not listed: the assistant's own endpoints refuse the role outright.
const PERMITTED_TOOLS: Record<(typeof ROLES)[number], string[]> = {
  [USER_ROLE.ADMIN]: [
    AI_TOOL.GET_APPOINTMENTS,
    AI_TOOL.SEARCH_PATIENTS,
    AI_TOOL.GET_PATIENT_SUMMARY,
    AI_TOOL.GET_DAILY_STATS,
    AI_TOOL.GET_FINANCIAL_SUMMARY,
    AI_TOOL.GET_OVERDUE_LAB_ORDERS,
    AI_TOOL.GET_LOW_STOCK_ITEMS,
    AI_TOOL.DRAFT_BULK_MESSAGE,
    AI_TOOL.SET_APPOINTMENT_STATUS,
    AI_TOOL.ADD_PATIENT_NOTE,
    AI_TOOL.CREATE_APPOINTMENT,
    AI_TOOL.RESCHEDULE_APPOINTMENT,
    AI_TOOL.CANCEL_APPOINTMENTS,
    AI_TOOL.CREATE_PATIENT,
    AI_TOOL.RECORD_PAYMENT,
  ],
  [USER_ROLE.DOCTOR]: [
    AI_TOOL.GET_APPOINTMENTS,
    AI_TOOL.SEARCH_PATIENTS,
    AI_TOOL.GET_PATIENT_SUMMARY,
    AI_TOOL.GET_DAILY_STATS,
    AI_TOOL.GET_OVERDUE_LAB_ORDERS,
    AI_TOOL.GET_LOW_STOCK_ITEMS,
    AI_TOOL.SET_APPOINTMENT_STATUS,
    AI_TOOL.ADD_PATIENT_NOTE,
    AI_TOOL.CREATE_APPOINTMENT,
    AI_TOOL.RESCHEDULE_APPOINTMENT,
    AI_TOOL.CANCEL_APPOINTMENTS,
    AI_TOOL.CREATE_PATIENT,
  ],
  [USER_ROLE.RECEPTIONIST]: [
    AI_TOOL.GET_APPOINTMENTS,
    AI_TOOL.SEARCH_PATIENTS,
    AI_TOOL.GET_PATIENT_SUMMARY,
    AI_TOOL.GET_DAILY_STATS,
    AI_TOOL.GET_FINANCIAL_SUMMARY,
    AI_TOOL.DRAFT_BULK_MESSAGE,
    AI_TOOL.SET_APPOINTMENT_STATUS,
    AI_TOOL.ADD_PATIENT_NOTE,
    AI_TOOL.CREATE_APPOINTMENT,
    AI_TOOL.RESCHEDULE_APPOINTMENT,
    AI_TOOL.CANCEL_APPOINTMENTS,
    AI_TOOL.CREATE_PATIENT,
    AI_TOOL.RECORD_PAYMENT,
  ],
  [USER_ROLE.TECHNICIAN]: [
    AI_TOOL.GET_APPOINTMENTS,
    AI_TOOL.SEARCH_PATIENTS,
    AI_TOOL.GET_DAILY_STATS,
    AI_TOOL.GET_OVERDUE_LAB_ORDERS,
    AI_TOOL.GET_LOW_STOCK_ITEMS,
  ],
};

function events(body: string): AiStreamEvent[] {
  return body
    .split("\n\n")
    .filter((frame) => frame.startsWith("data: "))
    .map((frame) => JSON.parse(frame.slice("data: ".length)) as AiStreamEvent);
}

describe("Clinic assistant (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  const tokens = {} as Record<UserRole, string>;

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();

    for (const role of ROLES) {
      tokens[role] = await context.login(clinic.phones[role]);
    }
  });

  afterAll(async () => {
    await context.close();
  });

  describe("which tools a role may run", () => {
    it.each(ROLES)("serves %s exactly the tools its permissions allow", async (role) => {
      const tools = context.app.get(AiToolsService);
      const permissions = context.app.get(PermissionsService);

      const allowed: string[] = [];

      for (const tool of tools.list()) {
        const permitted =
          tool.capability === null || (await permissions.allows(clinic.id, role, tool.capability));

        if (permitted) {
          allowed.push(tool.name);
        }
      }

      expect(allowed.sort()).toEqual([...PERMITTED_TOOLS[role]].sort());
    });

    // Every key is one an endpoint declares, so a clinic editing its permission matrix moves the
    // assistant with the screen.
    it("names only capabilities the route table knows", () => {
      const runner = context.app.get(ToolRunnerService);

      expect(() => runner.onApplicationBootstrap()).not.toThrow();
    });

    it("refuses a receptionist the financial tool once the clinic takes the permission away", async () => {
      const permissions = context.app.get(PermissionsService);
      const tools = context.app.get(AiToolsService);
      const financial = tools.list().find((tool) => tool.name === AI_TOOL.GET_FINANCIAL_SUMMARY);

      await permissions.set(
        clinic.id,
        USER_ROLE.RECEPTIONIST,
        financial?.capability ?? "",
        false,
        clinic.userIds[USER_ROLE.ADMIN],
      );

      await expect(
        permissions.allows(clinic.id, USER_ROLE.RECEPTIONIST, financial?.capability ?? ""),
      ).resolves.toBe(false);

      await permissions.set(
        clinic.id,
        USER_ROLE.RECEPTIONIST,
        financial?.capability ?? "",
        true,
        clinic.userIds[USER_ROLE.ADMIN],
      );
    });
  });

  // From the database, never the request: an admin asking for "my appointments" must not be
  // answered with the clinic's whole day.
  describe("who is asking", () => {
    let doctorId: string;

    beforeAll(async () => {
      const [doctor] = await context.db
        .insert(doctors)
        .values({
          clinicId: clinic.id,
          userId: clinic.userIds[USER_ROLE.DOCTOR],
          specialtyId: clinic.specialtyId,
        })
        .returning({ id: doctors.id });

      doctorId = doctor?.id ?? "";
    });

    const actor = (role: UserRole) => ({ id: clinic.userIds[role], clinicId: clinic.id, role });

    it("links a doctor's account to their doctor row", async () => {
      const resolved = await context.app.get(AgentService).context(actor(USER_ROLE.DOCTOR));

      expect(resolved.doctor?.id).toBe(doctorId);
    });

    it("has no doctor for an admin who is not one", async () => {
      const resolved = await context.app.get(AgentService).context(actor(USER_ROLE.ADMIN));

      expect(resolved.doctor).toBeNull();
    });

    it("answers not_found for a doctor_id from another clinic, rather than an empty day", async () => {
      const other = await context.createClinic();
      const [foreign] = await context.db
        .insert(doctors)
        .values({
          clinicId: other.id,
          userId: other.userIds[USER_ROLE.DOCTOR],
          specialtyId: other.specialtyId,
        })
        .returning({ id: doctors.id });

      const admin = actor(USER_ROLE.ADMIN);
      const conversation = await context.app.get(AiConversationsService).start(admin, "مواعيد");
      const run = (id: string) =>
        context.app.get(ToolRunnerService).run(admin, conversation.id, {
          id: "call_1",
          name: AI_TOOL.GET_APPOINTMENTS,
          arguments: JSON.stringify({
            date_from: "2026-09-22",
            date_to: "2026-09-22",
            doctor_id: id,
          }),
        });

      expect(JSON.parse((await run(foreign?.id ?? "")).content)).toMatchObject({
        error: "not_found",
      });
      const own = await run(doctorId);

      expect(JSON.parse(own.content)).toMatchObject({ result: { items: [], truncated: false } });
      // The page's copy: the day's calendar for that doctor, as the screen's own address.
      expect(aiViewSchema.parse(own.view)).toMatchObject({
        type: "table",
        rows: [],
        href: `/appointments?view=day&date=2026-09-22&doctor=${doctorId}`,
      });
    });
  });

  describe("a conversation", () => {
    it("streams an answer, records it, and lists it afterwards", async () => {
      const response = await context.app.inject({
        method: "POST",
        url: "/ai/chat",
        headers: auth(tokens[USER_ROLE.DOCTOR]),
        payload: { message: "كم موعد اليوم؟" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/event-stream");

      const frames = events(response.body);
      const opened = frames[0];

      expect(opened?.type).toBe(AI_STREAM_EVENT.CONVERSATION);
      expect(frames.at(-1)?.type).toBe(AI_STREAM_EVENT.DONE);

      const conversationId =
        opened?.type === AI_STREAM_EVENT.CONVERSATION ? opened.conversationId : "";

      const listed = await context.app.inject({
        method: "GET",
        url: "/ai/conversations",
        headers: auth(tokens[USER_ROLE.DOCTOR]),
      });

      expect(listed.json()).toMatchObject({
        items: [expect.objectContaining({ id: conversationId, title: "كم موعد اليوم؟" })],
      });

      const messages = await context.app.inject({
        method: "GET",
        url: `/ai/conversations/${conversationId}`,
        headers: auth(tokens[USER_ROLE.DOCTOR]),
      });

      expect(messages.json()).toMatchObject([
        { role: "user", content: "كم موعد اليوم؟" },
        { role: "assistant" },
      ]);
    });

    // A reloaded thread redraws the table where the tool ran; the envelope the model read stays.
    it("serves a tool row's view, and never its envelope", async () => {
      const doctor = {
        id: clinic.userIds[USER_ROLE.DOCTOR],
        clinicId: clinic.id,
        role: USER_ROLE.DOCTOR,
      };
      const conversations = context.app.get(AiConversationsService);
      const conversation = await conversations.start(doctor, "إحصائيات");
      const view = {
        type: "stats" as const,
        tiles: [{ label: "assistant.view.stats.total", value: "3", kind: "number" as const }],
      };

      await conversations.append(doctor, conversation.id, {
        role: AI_MESSAGE_ROLE.TOOL,
        content: '{"tool":"get_daily_stats","result":{"total":3}}',
        toolName: AI_TOOL.GET_DAILY_STATS,
        view,
      });

      await expect(conversations.messages(doctor, conversation.id)).resolves.toEqual([
        expect.objectContaining({
          role: AI_MESSAGE_ROLE.TOOL,
          content: "",
          toolName: AI_TOOL.GET_DAILY_STATS,
          view,
        }),
      ]);
    });

    it("is the caller's own: another user in the clinic gets a 404, not a 403", async () => {
      const mine = await context.app.inject({
        method: "POST",
        url: "/ai/chat",
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
        payload: { message: "مواعيد بكرا" },
      });

      const opened = events(mine.body)[0];
      const conversationId =
        opened?.type === AI_STREAM_EVENT.CONVERSATION ? opened.conversationId : "";

      for (const role of [USER_ROLE.ADMIN, USER_ROLE.DOCTOR] as const) {
        const response = await context.app.inject({
          method: "GET",
          url: `/ai/conversations/${conversationId}`,
          headers: auth(tokens[role]),
        });

        expect(response.statusCode).toBe(404);
      }
    });

    it("cannot be continued from another clinic", async () => {
      const other = await context.createClinic();
      const stranger = await context.login(other.phones[USER_ROLE.ADMIN]);

      const mine = await context.app.inject({
        method: "POST",
        url: "/ai/chat",
        headers: auth(tokens[USER_ROLE.DOCTOR]),
        payload: { message: "الوضع المالي" },
      });

      const opened = events(mine.body)[0];
      const conversationId =
        opened?.type === AI_STREAM_EVENT.CONVERSATION ? opened.conversationId : "";

      const response = await context.app.inject({
        method: "GET",
        url: `/ai/conversations/${conversationId}`,
        headers: auth(stranger),
      });

      expect(response.statusCode).toBe(404);
    });

    it("refuses an unsigned caller", async () => {
      const response = await context.app.inject({
        method: "POST",
        url: "/ai/chat",
        payload: { message: "مرحبا" },
      });

      expect(response.statusCode).toBe(401);
    });

    it("refuses a question longer than the limit", async () => {
      const response = await context.app.inject({
        method: "POST",
        url: "/ai/chat",
        headers: auth(tokens[USER_ROLE.DOCTOR]),
        payload: { message: "ا".repeat(2_001) },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
