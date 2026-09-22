import {
  AI_OUTBOUND_ERROR,
  AI_OUTBOUND_TARGET,
  AI_OUTBOUND_TRIGGER,
  AI_PROPOSAL_STATUS,
  AI_STREAM_EVENT,
  AI_TOOL,
  AI_TOOL_ERROR,
  CLINIC_SECRET_KIND,
  NOTIFICATION_STATUS,
  NOTIFICATION_TEMPLATE,
  USER_ROLE,
  type AiProposal,
  type UserRole,
} from "@clinic/shared";
import { and, eq } from "drizzle-orm";
import { AiConversationsService } from "@api/ai/ai-conversations.service";
import { OutboundError, ProposalsService } from "@api/ai/outbound/proposals.service";
import { ToolRunnerService } from "@api/ai/tools/tool-runner.service";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import {
  aiAuditLog,
  aiProposals,
  auditLog,
  clinicSecrets,
  notificationsLog,
} from "@api/database/schema";
import { PermissionsService } from "@api/permissions/permissions.service";
import { createPatient, uniquePhone } from "@test/helpers/patient-fixtures";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

const ROLES = [
  USER_ROLE.ADMIN,
  USER_ROLE.DOCTOR,
  USER_ROLE.RECEPTIONIST,
  USER_ROLE.TECHNICIAN,
] as const;

interface Fixture {
  readonly clinic: TestClinic;
  readonly tokens: Record<UserRole, string>;
  readonly patientIds: string[];
}

describe("Outbound messages (e2e)", () => {
  let context: TestContext;
  let proposals: ProposalsService;
  let main: Fixture;

  const actor = (fixture: Fixture, role: UserRole): AuthenticatedUser => ({
    id: fixture.clinic.userIds[role],
    clinicId: fixture.clinic.id,
    role,
  });

  async function fixture(patients = 2): Promise<Fixture> {
    const clinic = await context.createClinic();
    const tokens = {} as Record<UserRole, string>;

    for (const role of ROLES) {
      tokens[role] = await context.login(clinic.phones[role]);
    }

    const patientIds: string[] = [];

    for (let index = 0; index < patients; index += 1) {
      patientIds.push(
        await createPatient(context, tokens[USER_ROLE.ADMIN], {
          fullName: `مريض ${index + 1}`,
          phone: uniquePhone(),
        }),
      );
    }

    return { clinic, tokens, patientIds };
  }

  async function draft(on: Fixture, role: UserRole, ids = on.patientIds): Promise<AiProposal> {
    const author = actor(on, role);
    const conversation = await context.app.get(AiConversationsService).start(author, "رسالة");

    return proposals.draftForUser(author, conversation.id, {
      target: AI_OUTBOUND_TARGET.PATIENT_IDS,
      intent: "موعد المراجعة صار جاهز",
      patientIds: ids,
    });
  }

  const post = (token: string, id: string, action: "send" | "cancel") =>
    context.app.inject({
      method: "POST",
      url: `/ai/proposals/${id}/${action}`,
      headers: auth(token),
    });

  const outboundRows = (proposalId: string) =>
    context.db.select().from(aiAuditLog).where(eq(aiAuditLog.proposalId, proposalId));

  beforeAll(async () => {
    context = await createTestContext();
    proposals = context.app.get(ProposalsService);
    main = await fixture();
  });

  afterAll(async () => {
    await context.close();
  });

  describe("the proposal lifecycle", () => {
    it("drafts without sending, then sends when its author confirms", async () => {
      const proposal = await draft(main, USER_ROLE.RECEPTIONIST);

      expect(proposal).toMatchObject({
        status: AI_PROPOSAL_STATUS.DRAFT,
        trigger: AI_OUTBOUND_TRIGGER.COMMAND,
        createdBy: main.clinic.userIds[USER_ROLE.RECEPTIONIST],
      });
      expect(proposal.recipients).toHaveLength(2);
      expect(proposal.recipients[0]?.text).toContain(proposal.recipients[0]?.name ?? "?");
      // The card is served without numbers.
      expect(JSON.stringify(proposal)).not.toMatch(/\+9955/);
      await expect(outboundRows(proposal.id)).resolves.toHaveLength(0);

      const response = await post(main.tokens[USER_ROLE.RECEPTIONIST], proposal.id, "send");

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        type: AI_STREAM_EVENT.PROPOSAL_STATUS,
        proposalId: proposal.id,
        status: AI_PROPOSAL_STATUS.SENT,
        sentCount: 2,
        failedCount: 0,
      });

      const rows = await outboundRows(proposal.id);

      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row.renderedText).sort()).toEqual(
        proposal.recipients.map((recipient) => recipient.text).sort(),
      );
      expect(rows.every((row) => row.trigger === AI_OUTBOUND_TRIGGER.COMMAND)).toBe(true);
      expect(rows.every((row) => row.userId === main.clinic.userIds[USER_ROLE.RECEPTIONIST])).toBe(
        true,
      );

      const delivered = await context.db
        .select()
        .from(notificationsLog)
        .where(
          and(
            eq(notificationsLog.clinicId, main.clinic.id),
            eq(notificationsLog.template, NOTIFICATION_TEMPLATE.ASSISTANT_MESSAGE),
          ),
        );

      expect(delivered.filter((row) => row.status === NOTIFICATION_STATUS.SENT)).toHaveLength(2);
    });

    it("sends nothing on a second click", async () => {
      const proposal = await draft(main, USER_ROLE.RECEPTIONIST);

      await post(main.tokens[USER_ROLE.RECEPTIONIST], proposal.id, "send");
      const again = await post(main.tokens[USER_ROLE.RECEPTIONIST], proposal.id, "send");

      expect(again.statusCode).toBe(409);
      expect(again.json()).toMatchObject({ message: AI_OUTBOUND_ERROR.NOT_PENDING });
      await expect(outboundRows(proposal.id)).resolves.toHaveLength(2);
    });

    it("expires, and an expired proposal sends nothing", async () => {
      const proposal = await draft(main, USER_ROLE.RECEPTIONIST);

      await context.db
        .update(aiProposals)
        .set({ expiresAt: new Date(Date.now() - 1_000) })
        .where(eq(aiProposals.id, proposal.id));

      const read = await context.app.inject({
        method: "GET",
        url: `/ai/proposals/${proposal.id}`,
        headers: auth(main.tokens[USER_ROLE.RECEPTIONIST]),
      });

      expect(read.json()).toMatchObject({ status: AI_PROPOSAL_STATUS.EXPIRED });

      const response = await post(main.tokens[USER_ROLE.RECEPTIONIST], proposal.id, "send");

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ message: AI_OUTBOUND_ERROR.EXPIRED });
      await expect(outboundRows(proposal.id)).resolves.toHaveLength(0);
    });

    it("cannot be sent once cancelled", async () => {
      const proposal = await draft(main, USER_ROLE.RECEPTIONIST);

      const cancelled = await post(main.tokens[USER_ROLE.RECEPTIONIST], proposal.id, "cancel");

      expect(cancelled.json()).toMatchObject({ status: AI_PROPOSAL_STATUS.CANCELLED });
      expect(
        (await post(main.tokens[USER_ROLE.RECEPTIONIST], proposal.id, "send")).statusCode,
      ).toBe(409);
      await expect(outboundRows(proposal.id)).resolves.toHaveLength(0);
    });
  });

  describe("who may send", () => {
    it("is the author's alone: another user, even the admin, gets a 404", async () => {
      const proposal = await draft(main, USER_ROLE.RECEPTIONIST);

      expect((await post(main.tokens[USER_ROLE.ADMIN], proposal.id, "send")).statusCode).toBe(404);
      expect((await post(main.tokens[USER_ROLE.ADMIN], proposal.id, "cancel")).statusCode).toBe(
        404,
      );
    });

    it("cannot be reached from another clinic", async () => {
      const proposal = await draft(main, USER_ROLE.ADMIN);
      const other = await fixture(0);

      expect((await post(other.tokens[USER_ROLE.ADMIN], proposal.id, "send")).statusCode).toBe(404);
      await expect(outboundRows(proposal.id)).resolves.toHaveLength(0);
    });

    it("refuses the roles that do not hold ai-outbound.send", async () => {
      const proposal = await draft(main, USER_ROLE.ADMIN);

      for (const role of [USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN] as const) {
        expect((await post(main.tokens[role], proposal.id, "send")).statusCode).toBe(403);
      }
    });

    it("takes the button away with the permission", async () => {
      const permissions = context.app.get(PermissionsService);
      const proposal = await draft(main, USER_ROLE.RECEPTIONIST);
      const admin = main.clinic.userIds[USER_ROLE.ADMIN];

      await permissions.set(
        main.clinic.id,
        USER_ROLE.RECEPTIONIST,
        "ai-outbound.send",
        false,
        admin,
      );

      try {
        const response = await post(main.tokens[USER_ROLE.RECEPTIONIST], proposal.id, "send");

        expect(response.statusCode).toBe(403);
        await expect(outboundRows(proposal.id)).resolves.toHaveLength(0);
      } finally {
        await permissions.set(
          main.clinic.id,
          USER_ROLE.RECEPTIONIST,
          "ai-outbound.send",
          true,
          admin,
        );
      }
    });
  });

  describe("caps", () => {
    const putSettings = (on: Fixture, body: Record<string, unknown>) =>
      context.app.inject({
        method: "PUT",
        url: "/ai/automation/settings",
        headers: auth(on.tokens[USER_ROLE.ADMIN]),
        payload: body,
      });

    it("refuses a draft over the recipient cap whole, rather than drafting some", async () => {
      const capped = await fixture(3);

      expect((await putSettings(capped, { recipientCap: 2 })).statusCode).toBe(200);

      await expect(draft(capped, USER_ROLE.ADMIN)).rejects.toMatchObject({
        code: AI_OUTBOUND_ERROR.RECIPIENT_CAP,
      });
      await expect(draft(capped, USER_ROLE.ADMIN)).rejects.toBeInstanceOf(OutboundError);

      const stored = await context.db
        .select()
        .from(aiProposals)
        .where(eq(aiProposals.clinicId, capped.clinic.id));

      expect(stored).toHaveLength(0);
    });

    it("refuses a send that would pass the clinic's daily cap, and sends none of it", async () => {
      const capped = await fixture(2);

      await putSettings(capped, { dailyCap: 3 });

      const first = await draft(capped, USER_ROLE.ADMIN);
      const second = await draft(capped, USER_ROLE.ADMIN);

      expect((await post(capped.tokens[USER_ROLE.ADMIN], first.id, "send")).statusCode).toBe(200);

      const refused = await post(capped.tokens[USER_ROLE.ADMIN], second.id, "send");

      expect(refused.statusCode).toBe(422);
      expect(refused.json()).toMatchObject({ message: AI_OUTBOUND_ERROR.DAILY_CAP });
      await expect(outboundRows(second.id)).resolves.toHaveLength(0);

      const [row] = await context.db
        .select()
        .from(aiProposals)
        .where(eq(aiProposals.id, second.id));

      expect(row?.status).toBe(AI_PROPOSAL_STATUS.DRAFT);
    });
  });

  describe("the draft tool", () => {
    const call = (args: Record<string, unknown>) => ({
      id: "call_1",
      name: AI_TOOL.DRAFT_BULK_MESSAGE,
      arguments: JSON.stringify(args),
    });

    it("hands the proposal to the stream and tells the model only an id and a count", async () => {
      const author = actor(main, USER_ROLE.RECEPTIONIST);
      const conversation = await context.app.get(AiConversationsService).start(author, "رسالة");

      const run = await context.app.get(ToolRunnerService).run(
        author,
        conversation.id,
        call({
          target: AI_OUTBOUND_TARGET.PATIENT_IDS,
          patient_ids: main.patientIds,
          message_intent: "ذكّرهم بالمراجعة",
        }),
      );

      expect(run.proposal?.recipients).toHaveLength(2);
      expect(JSON.parse(run.content)).toMatchObject({
        result: { proposal_id: run.proposal?.id, recipient_count: 2 },
      });
      expect(run.content).not.toContain(run.proposal?.recipients[0]?.text ?? "?");
    });

    it("needs the list's own read permission as well as the send permission", async () => {
      const author = actor(main, USER_ROLE.RECEPTIONIST);
      const conversation = await context.app.get(AiConversationsService).start(author, "رسالة");

      // A receptionist ships without `lab-orders.overdue`.
      const run = await context.app
        .get(ToolRunnerService)
        .run(
          author,
          conversation.id,
          call({ target: AI_OUTBOUND_TARGET.OVERDUE_LABS, message_intent: "اعتذر عن التأخير" }),
        );

      expect(JSON.parse(run.content)).toMatchObject({ error: AI_TOOL_ERROR.NOT_PERMITTED });
      expect(run.proposal).toBeUndefined();
    });

    it("serves the drafting row empty, as the place its card goes", async () => {
      const author = actor(main, USER_ROLE.RECEPTIONIST);
      const conversations = context.app.get(AiConversationsService);
      const conversation = await conversations.start(author, "رسالة");
      const proposal = await draft(main, USER_ROLE.RECEPTIONIST);

      await conversations.append(author, conversation.id, {
        role: "tool",
        content: '{"tool":"draft_bulk_message","result":{"secret":"envelope"}}',
        toolName: AI_TOOL.DRAFT_BULK_MESSAGE,
        proposalId: proposal.id,
      });

      const response = await context.app.inject({
        method: "GET",
        url: `/ai/conversations/${conversation.id}`,
        headers: auth(main.tokens[USER_ROLE.RECEPTIONIST]),
      });

      expect(response.json()).toEqual([
        expect.objectContaining({ proposalId: proposal.id, content: "" }),
      ]);
      expect(response.body).not.toContain("envelope");
    });
  });

  describe("settings and the outbound log", () => {
    it("are the admin's by default", async () => {
      for (const url of ["/ai/automation/settings", "/ai/outbound", "/ai/secrets"]) {
        const response = await context.app.inject({
          method: "GET",
          url,
          headers: auth(main.tokens[USER_ROLE.RECEPTIONIST]),
        });

        expect(response.statusCode).toBe(403);
      }
    });

    it("propose everything out of the box", async () => {
      const fresh = await fixture(0);
      const response = await context.app.inject({
        method: "GET",
        url: "/ai/automation/settings",
        headers: auth(fresh.tokens[USER_ROLE.ADMIN]),
      });

      expect(response.json()).toMatchObject({
        rules: {
          overdue_labs: { mode: "propose" },
          unpaid_invoices: { mode: "propose" },
          tomorrow_appointments: { mode: "propose" },
        },
        recipientCap: 100,
      });
    });

    it("lists what was sent, filtered by trigger", async () => {
      const list = (query: string) =>
        context.app.inject({
          method: "GET",
          url: `/ai/outbound${query}`,
          headers: auth(main.tokens[USER_ROLE.ADMIN]),
        });

      const all = (await list("")).json() as { total: number; items: { trigger: string }[] };

      expect(all.total).toBeGreaterThan(0);
      expect(all.items.every((item) => item.trigger === AI_OUTBOUND_TRIGGER.COMMAND)).toBe(true);
      expect((await list("?trigger=cron")).json()).toMatchObject({ total: 0 });
    });
  });

  describe("the clinic's provider keys", () => {
    const secrets = (on: Fixture, role: UserRole, payload?: Record<string, unknown>) =>
      context.app.inject({
        method: payload ? "PUT" : "GET",
        url: "/ai/secrets",
        headers: auth(on.tokens[role]),
        ...(payload && { payload }),
      });

    const KEY = "sk-test-0123456789abcdefghijWXYZ";

    it("stores a key encrypted and never answers with it", async () => {
      const response = await secrets(main, USER_ROLE.ADMIN, {
        [CLINIC_SECRET_KIND.OPENAI_API_KEY]: KEY,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).not.toContain("0123456789");
      expect(response.json()).toMatchObject({
        encryptionAvailable: true,
        secrets: { [CLINIC_SECRET_KIND.OPENAI_API_KEY]: { set: true, hint: "WXYZ" } },
      });

      const [row] = await context.db
        .select()
        .from(clinicSecrets)
        .where(eq(clinicSecrets.clinicId, main.clinic.id));

      expect(JSON.stringify(row)).not.toContain("0123456789");

      const audited = await context.db
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.clinicId, main.clinic.id), eq(auditLog.entity, "clinic_secrets")));

      expect(audited).toHaveLength(1);
      expect(JSON.stringify(audited)).not.toContain("0123456789");
    });

    it("clears a key with null", async () => {
      const response = await secrets(main, USER_ROLE.ADMIN, {
        [CLINIC_SECRET_KIND.OPENAI_API_KEY]: null,
      });

      expect(response.json()).toMatchObject({
        secrets: { [CLINIC_SECRET_KIND.OPENAI_API_KEY]: { set: false, hint: null } },
      });
    });

    it("rejects a value that is not shaped like a key", async () => {
      const response = await secrets(main, USER_ROLE.ADMIN, {
        [CLINIC_SECRET_KIND.OPENAI_API_KEY]: "my password",
      });

      expect(response.statusCode).toBe(400);
    });

    // Held to the admin in the service too: a clinic that grants the capability does not
    // hand a receptionist its billing key.
    it("stays the admin's even when the matrix grants it to somebody else", async () => {
      const permissions = context.app.get(PermissionsService);
      const admin = main.clinic.userIds[USER_ROLE.ADMIN];

      await permissions.set(
        main.clinic.id,
        USER_ROLE.RECEPTIONIST,
        "ai-secrets.update",
        true,
        admin,
      );

      try {
        const response = await secrets(main, USER_ROLE.RECEPTIONIST, {
          [CLINIC_SECRET_KIND.OPENAI_API_KEY]: KEY,
        });

        expect(response.statusCode).toBe(403);
      } finally {
        await permissions.set(
          main.clinic.id,
          USER_ROLE.RECEPTIONIST,
          "ai-secrets.update",
          false,
          admin,
        );
      }
    });
  });
});
