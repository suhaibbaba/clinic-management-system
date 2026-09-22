import {
  AI_STREAM_EVENT,
  AI_TOOL,
  USER_ROLE,
  type AiStreamEvent,
  type UserRole,
} from "@clinic/shared";
import { AiToolsService } from "@api/ai/tools/ai-tools.service";
import { ToolRunnerService } from "@api/ai/tools/tool-runner.service";
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
const PERMITTED_TOOLS: Record<UserRole, string[]> = {
  [USER_ROLE.ADMIN]: [
    AI_TOOL.GET_APPOINTMENTS,
    AI_TOOL.SEARCH_PATIENTS,
    AI_TOOL.GET_PATIENT_SUMMARY,
    AI_TOOL.GET_DAILY_STATS,
    AI_TOOL.GET_FINANCIAL_SUMMARY,
    AI_TOOL.GET_OVERDUE_LAB_ORDERS,
    AI_TOOL.GET_LOW_STOCK_ITEMS,
    AI_TOOL.DRAFT_BULK_MESSAGE,
  ],
  [USER_ROLE.DOCTOR]: [
    AI_TOOL.GET_APPOINTMENTS,
    AI_TOOL.SEARCH_PATIENTS,
    AI_TOOL.GET_PATIENT_SUMMARY,
    AI_TOOL.GET_DAILY_STATS,
    AI_TOOL.GET_OVERDUE_LAB_ORDERS,
    AI_TOOL.GET_LOW_STOCK_ITEMS,
  ],
  [USER_ROLE.RECEPTIONIST]: [
    AI_TOOL.GET_APPOINTMENTS,
    AI_TOOL.SEARCH_PATIENTS,
    AI_TOOL.GET_PATIENT_SUMMARY,
    AI_TOOL.GET_DAILY_STATS,
    AI_TOOL.GET_FINANCIAL_SUMMARY,
    AI_TOOL.DRAFT_BULK_MESSAGE,
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
