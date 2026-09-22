import {
  AI_ERROR_CODE,
  AI_MESSAGE_ROLE,
  AI_OUTBOUND_TARGET,
  AI_OUTBOUND_TRIGGER,
  AI_PROPOSAL_KIND,
  AI_PROPOSAL_STATUS,
  AI_STREAM_EVENT,
  AI_TOOL,
  USER_ROLE,
  type AiProposal,
  type AiView,
} from "@clinic/shared";
import type { ConfigService } from "@nestjs/config";
import { AgentService } from "@api/ai/agent.service";
import { SYSTEM_PROMPT_VERSION, systemPrompt } from "@api/ai/system-prompt";
import type { AiConversationsService } from "@api/ai/ai-conversations.service";
import type { ChatProviderResolver } from "@api/ai/chat-provider.resolver";
import {
  ChatProviderError,
  type ChatChunk,
  type ChatProvider,
  type ChatRequest,
  type ChatToolCall,
} from "@api/ai/chat-provider";
import type { ToolRunnerService } from "@api/ai/tools/tool-runner.service";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import type { Database } from "@api/database/database.module";
import { clinics, doctors, users } from "@api/database/schema";
import type { Env } from "@api/config/env.schema";

const ACTOR: AuthenticatedUser = {
  id: "11111111-1111-4111-8111-111111111111",
  clinicId: "22222222-2222-4222-8222-222222222222",
  role: USER_ROLE.DOCTOR,
};

const CONVERSATION_ID = "33333333-3333-4333-8333-333333333333";

interface AppendedMessage {
  role: string;
  content: string;
  toolName?: string;
  usage?: { inputTokens: number; outputTokens: number };
  promptVersion?: number;
  proposalId?: string;
  view?: unknown;
}

function completed(text: string, toolCalls: ChatToolCall[] = []): ChatChunk {
  return { type: "completed", text, toolCalls, usage: { inputTokens: 10, outputTokens: 5 } };
}

// One script per call: the loop calls the provider again after every round of tools.
function scripted(scripts: ChatChunk[][]): {
  provider: ChatProvider;
  requests: ChatRequest[];
} {
  const requests: ChatRequest[] = [];
  const remaining = [...scripts];

  return {
    requests,
    provider: {
      name: "scripted",
      async *stream(request: ChatRequest): AsyncIterable<ChatChunk> {
        requests.push(request);

        for (const chunk of remaining.shift() ?? [completed("")]) {
          yield chunk;
        }
      },
    },
  };
}

function harness(
  provider: ChatProvider,
  options: {
    maxSteps?: number;
    toolContent?: string;
    proposal?: AiProposal;
    toolThrows?: boolean;
    doctorId?: string | null;
    view?: AiView;
  } = {},
): {
  agent: AgentService;
  appended: AppendedMessage[];
  toolRuns: { actor: AuthenticatedUser; call: ChatToolCall }[];
} {
  const appended: AppendedMessage[] = [];
  const toolRuns: { actor: AuthenticatedUser; call: ChatToolCall }[] = [];

  const conversations = {
    requireOwn: () => Promise.resolve({ id: CONVERSATION_ID }),
    start: () => Promise.resolve({ id: CONVERSATION_ID }),
    history: () => Promise.resolve([]),
    append: (_actor: AuthenticatedUser, _id: string, message: AppendedMessage) => {
      appended.push(message);

      return Promise.resolve({ id: `message-${appended.length}` });
    },
  } as unknown as AiConversationsService;

  const tools = {
    definitions: () => [],
    run: (actor: AuthenticatedUser, _conversationId: string, call: ChatToolCall) => {
      toolRuns.push({ actor, call });

      if (options.toolThrows) {
        return Promise.reject(new Error("relation ai_audit_log does not exist"));
      }

      return Promise.resolve({
        name: call.name,
        content: options.toolContent ?? '{"tool":"x","untrusted_clinic_data":true,"result":[]}',
        ...(options.proposal && { proposal: options.proposal }),
        ...(options.view && { view: options.view }),
      });
    },
  } as unknown as ToolRunnerService;

  const settings: Partial<Record<keyof Env, unknown>> = {
    AI_HISTORY_MESSAGES: 20,
    AI_MAX_TOOL_STEPS: options.maxSteps ?? 5,
  };

  const config = {
    get: (key: keyof Env) => settings[key],
  } as unknown as ConfigService<Env, true>;

  // The agent reads three rows directly, for the prompt: the clinic, the speaker, their doctor row.
  const rows = new Map<unknown, unknown[]>([
    [clinics, [{ nameAr: "عيادة", nameEn: "Clinic", settings: {} }]],
    [users, [{ nameAr: "سارة", nameEn: "Sara" }]],
    [doctors, options.doctorId ? [{ id: options.doctorId }] : []],
  ]);
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({ limit: () => Promise.resolve(rows.get(table) ?? []) }),
      }),
    }),
  } as unknown as Database;

  return {
    agent: new AgentService(
      db,
      { for: () => Promise.resolve(provider) } as unknown as ChatProviderResolver,
      conversations,
      tools,
      config,
    ),
    appended,
    toolRuns,
  };
}

async function collect(agent: AgentService, message = "كم موعد اليوم؟") {
  const events = [];

  for await (const event of agent.run(ACTOR, { message })) {
    events.push(event);
  }

  return events;
}

describe("the agent loop", () => {
  it("streams an answer and records it once the model stops asking for tools", async () => {
    const { provider } = scripted([
      [
        { type: "delta", text: "عندك " },
        { type: "delta", text: "٣ مواعيد" },
        completed("عندك ٣ مواعيد"),
      ],
    ]);
    const { agent, appended } = harness(provider);

    const events = await collect(agent);

    expect(events).toEqual([
      { type: AI_STREAM_EVENT.CONVERSATION, conversationId: CONVERSATION_ID },
      { type: AI_STREAM_EVENT.DELTA, text: "عندك " },
      { type: AI_STREAM_EVENT.DELTA, text: "٣ مواعيد" },
      { type: AI_STREAM_EVENT.DONE, messageId: "message-2" },
    ]);
    expect(appended).toEqual([
      { role: AI_MESSAGE_ROLE.USER, content: "كم موعد اليوم؟" },
      {
        role: AI_MESSAGE_ROLE.ASSISTANT,
        content: "عندك ٣ مواعيد",
        usage: { inputTokens: 10, outputTokens: 5 },
        // The reply records which prompt answered it.
        promptVersion: SYSTEM_PROMPT_VERSION,
      },
    ]);
  });

  it("runs the tool the model asked for and calls the model again with its answer", async () => {
    const call: ChatToolCall = {
      id: "call_1",
      name: AI_TOOL.GET_APPOINTMENTS,
      arguments: '{"date_from":"2026-09-20","date_to":"2026-09-20"}',
    };
    const { provider, requests } = scripted([[completed("", [call])], [completed("ما في مواعيد")]]);
    const { agent, appended, toolRuns } = harness(provider, { toolContent: '{"result":[]}' });

    const events = await collect(agent);

    expect(events).toContainEqual({ type: AI_STREAM_EVENT.TOOL, tool: AI_TOOL.GET_APPOINTMENTS });
    expect(toolRuns).toHaveLength(1);
    expect(toolRuns[0]?.call).toBe(call);

    // The second request carries the call and its answer, so the model can read what came back.
    expect(requests[1]?.messages).toEqual(
      expect.arrayContaining([
        { role: "assistant", content: "", toolCalls: [call] },
        { role: "tool", toolCallId: "call_1", content: '{"result":[]}' },
      ]),
    );
    expect(appended).toContainEqual({
      role: AI_MESSAGE_ROLE.TOOL,
      content: '{"result":[]}',
      toolName: AI_TOOL.GET_APPOINTMENTS,
    });
  });

  // The model writes the arguments and nothing else. Whoever it claims to be, the tool is run as
  // the token's holder.
  it("runs tools as the caller, whatever the model puts in the arguments", async () => {
    const call: ChatToolCall = {
      id: "call_1",
      name: AI_TOOL.SEARCH_PATIENTS,
      arguments:
        '{"query":"سمير","clinic_id":"99999999-9999-4999-8999-999999999999","role":"admin"}',
    };
    const { provider } = scripted([[completed("", [call])], [completed("لقيت واحد")]]);
    const { agent, toolRuns } = harness(provider);

    await collect(agent);

    expect(toolRuns[0]?.actor).toEqual(ACTOR);
  });

  it("answers with a code, never the provider's words, when the provider fails", async () => {
    const provider: ChatProvider = {
      name: "broken",
      // eslint-disable-next-line require-yield
      async *stream(): AsyncIterable<ChatChunk> {
        throw new ChatProviderError(new Error("401 Incorrect API key sk-live-abcdef"));
      },
    };
    const { agent } = harness(provider);

    const events = await collect(agent);

    expect(events.at(-1)).toEqual({
      type: AI_STREAM_EVENT.ERROR,
      code: AI_ERROR_CODE.PROVIDER_UNAVAILABLE,
    });
    expect(JSON.stringify(events)).not.toContain("sk-live");
  });

  it("gives up rather than looping when the model only ever asks for tools", async () => {
    const call: ChatToolCall = { id: "call_1", name: AI_TOOL.GET_LOW_STOCK_ITEMS, arguments: "{}" };
    const { provider } = scripted([
      [completed("", [call])],
      [completed("", [call])],
      [completed("", [call])],
    ]);
    const { agent, toolRuns } = harness(provider, { maxSteps: 2 });

    const events = await collect(agent);

    expect(toolRuns).toHaveLength(2);
    expect(events.at(-1)).toEqual({
      type: AI_STREAM_EVENT.ERROR,
      code: AI_ERROR_CODE.STEP_LIMIT,
    });
  });

  // The card is drawn from the frame and the tool row; the model only ever hears the id and a count.
  it("hands a drafted proposal to the card, and marks the row it was drafted on", async () => {
    const proposal: AiProposal = {
      id: "44444444-4444-4444-8444-444444444444",
      kind: AI_PROPOSAL_KIND.MESSAGE,
      status: AI_PROPOSAL_STATUS.DRAFT,
      trigger: AI_OUTBOUND_TRIGGER.COMMAND,
      target: AI_OUTBOUND_TARGET.UNPAID_INVOICES,
      intent: "ذكّرهم بالرصيد",
      conversationId: CONVERSATION_ID,
      createdBy: ACTOR.id,
      recipients: [
        { patientId: "55555555-5555-4555-8555-555555555555", name: "سمير", text: "مرحباً سمير" },
      ],
      expiresAt: "2026-09-23T10:15:00.000Z",
      createdAt: "2026-09-23T10:00:00.000Z",
      sentAt: null,
      sentCount: 0,
      failedCount: 0,
      tier: null,
      typedPhrase: null,
      summary: null,
      result: null,
      error: null,
    };
    const call: ChatToolCall = {
      id: "call_1",
      name: AI_TOOL.DRAFT_BULK_MESSAGE,
      arguments: '{"target":"unpaid_invoices","message_intent":"ذكّرهم بالرصيد"}',
    };
    const { provider, requests } = scripted([[completed("", [call])], [completed("جاهزة")]]);
    const { agent, appended } = harness(provider, {
      toolContent: `{"result":{"proposal_id":"${proposal.id}","recipient_count":1}}`,
      proposal,
    });

    const events = await collect(agent);

    expect(events).toContainEqual({ type: AI_STREAM_EVENT.PROPOSAL, proposal });
    expect(appended).toContainEqual(
      expect.objectContaining({ role: AI_MESSAGE_ROLE.TOOL, proposalId: proposal.id }),
    );
    expect(JSON.stringify(requests[1]?.messages)).not.toContain("مرحباً سمير");
  });

  // Every way out of a turn is a terminal frame: the page reports a stream that closes without one
  // as a lost connection.
  it("sends each tool's view as its own frame, once, and stores it on the tool row", async () => {
    const view: AiView = {
      type: "stats",
      tiles: [{ label: "assistant.view.stats.total", value: "7", kind: "number" }],
    };
    const calls: ChatToolCall[] = [
      { id: "call_1", name: AI_TOOL.GET_DAILY_STATS, arguments: "{}" },
      { id: "call_2", name: AI_TOOL.GET_DAILY_STATS, arguments: "{}" },
    ];
    const { provider } = scripted([[completed("", calls)], [completed("٧ مواعيد")]]);
    const { agent, appended } = harness(provider, { view });

    const events = await collect(agent);
    const frames = events.filter((event) => event.type === AI_STREAM_EVENT.VIEW);

    expect(frames).toEqual([
      { type: AI_STREAM_EVENT.VIEW, toolCallId: "call_1", view },
      { type: AI_STREAM_EVENT.VIEW, toolCallId: "call_2", view },
    ]);
    expect(appended.filter((message) => message.role === AI_MESSAGE_ROLE.TOOL)).toEqual([
      expect.objectContaining({ view }),
      expect.objectContaining({ view }),
    ]);
  });

  describe("ends every turn in a terminal frame", () => {
    const call: ChatToolCall = { id: "call_1", name: AI_TOOL.GET_LOW_STOCK_ITEMS, arguments: "{}" };
    const terminal = [AI_STREAM_EVENT.DONE, AI_STREAM_EVENT.ERROR] as const;

    const failing = (error: Error): ChatProvider => ({
      name: "broken",
      // eslint-disable-next-line require-yield
      async *stream(): AsyncIterable<ChatChunk> {
        throw error;
      },
    });

    it.each([
      ["the provider fails", () => harness(failing(new ChatProviderError(new Error("x"))))],
      ["the provider throws something else", () => harness(failing(new TypeError("x")))],
      [
        "a tool throws",
        () => harness(scripted([[completed("", [call])]]).provider, { toolThrows: true }),
      ],
      [
        "the step limit is reached",
        () => harness(scripted([[completed("", [call])]]).provider, { maxSteps: 1 }),
      ],
      ["the model answers", () => harness(scripted([[completed("تمام")]]).provider)],
    ])("when %s", async (_path, build) => {
      const events = await collect(build().agent);
      const ends = events.filter((event) => (terminal as readonly string[]).includes(event.type));

      expect(ends).toHaveLength(1);
      expect(events.at(-1)).toBe(ends[0]);
    });
  });

  // An admin should be told to check the key rather than to try again.
  it.each([AI_ERROR_CODE.PROVIDER_REJECTED, AI_ERROR_CODE.PROVIDER_QUOTA] as const)(
    "passes the provider failure's kind on as %s",
    async (code) => {
      const provider: ChatProvider = {
        name: "broken",
        // eslint-disable-next-line require-yield
        async *stream(): AsyncIterable<ChatChunk> {
          throw new ChatProviderError(new Error("x"), code);
        },
      };

      const events = await collect(harness(provider).agent);

      expect(events.at(-1)).toEqual({ type: AI_STREAM_EVENT.ERROR, code });
    },
  );
});

describe("who the assistant is speaking to", () => {
  const DOCTOR_ID = "66666666-6666-4666-8666-666666666666";

  it("names the speaker's doctor row when their user is linked to one", async () => {
    const { agent } = harness(scripted([]).provider, { doctorId: DOCTOR_ID });

    await expect(agent.context(ACTOR)).resolves.toMatchObject({
      user: { name: { ar: "سارة", en: "Sara" }, role: USER_ROLE.DOCTOR },
      doctor: { id: DOCTOR_ID, name: { ar: "سارة", en: "Sara" } },
    });
  });

  it("has no doctor for a speaker who is not one", async () => {
    const { agent } = harness(scripted([]).provider, { doctorId: null });

    await expect(agent.context({ ...ACTOR, role: USER_ROLE.ADMIN })).resolves.toMatchObject({
      user: { role: USER_ROLE.ADMIN },
      doctor: null,
    });
  });

  // The system prompt is the first message, and it carries the doctor's id, so "my appointments"
  // has an id to pass that came from the server rather than from the model.
  it("tells the model the speaker's doctor_id", async () => {
    const { provider, requests } = scripted([[completed("تمام")]]);
    const { agent } = harness(provider, { doctorId: DOCTOR_ID });

    await collect(agent, "مواعيدي اليوم");

    expect(requests[0]?.messages[0]?.content).toContain(`doctor_id ${DOCTOR_ID}`);
  });
});

describe("the system prompt", () => {
  const base = {
    clinicName: { ar: "عيادة النور", en: "Al Noor Clinic" },
    today: "2026-09-22",
  } as const;

  it("reads for a doctor", () => {
    expect(
      actorLines(
        systemPrompt({
          ...base,
          user: { name: { ar: "سارة", en: "Sara" }, role: USER_ROLE.DOCTOR },
          doctor: { id: "66666666-6666-4666-8666-666666666666", name: { ar: "سارة", en: "Sara" } },
        }),
      ),
    ).toMatchInlineSnapshot(`
      "The clinic is عيادة النور (Al Noor Clinic). Today is 2026-09-22 in its own time zone.
      You are speaking to سارة (Sara), whose role is "doctor".
      They are the doctor "سارة (Sara)" (doctor_id 66666666-6666-4666-8666-666666666666)."
    `);
  });

  it("reads for an admin who is not a doctor", () => {
    expect(
      actorLines(
        systemPrompt({
          ...base,
          user: { name: { ar: "منى", en: "Mona" }, role: USER_ROLE.ADMIN },
          doctor: null,
        }),
      ),
    ).toMatchInlineSnapshot(`
      "The clinic is عيادة النور (Al Noor Clinic). Today is 2026-09-22 in its own time zone.
      You are speaking to منى (Mona), whose role is "admin".
      They are not a doctor: they have no appointments, patients or schedule of their own."
    `);
  });

  // The provider caches the longest identical prefix; the speaker goes last so that is all of it.
  it("keeps everything before the speaker identical for every speaker", () => {
    const doctor = systemPrompt({
      ...base,
      user: { name: { ar: "سارة", en: "Sara" }, role: USER_ROLE.DOCTOR },
      doctor: { id: "66666666-6666-4666-8666-666666666666", name: { ar: "سارة", en: "Sara" } },
    });
    const admin = systemPrompt({
      ...base,
      user: { name: { ar: "منى", en: "Mona" }, role: USER_ROLE.ADMIN },
      doctor: null,
    });
    const prefix = (prompt: string) => prompt.slice(0, prompt.indexOf("The clinic is"));

    expect(prefix(doctor)).toBe(prefix(admin));
    expect(prefix(doctor).length).toBeGreaterThan(1000);
  });
});

/** The part of the prompt that changes per speaker, which is what the snapshots are about. */
const actorLines = (prompt: string): string => prompt.slice(prompt.indexOf("The clinic is"));
