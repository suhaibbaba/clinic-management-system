import {
  AI_ERROR_CODE,
  AI_MESSAGE_ROLE,
  AI_STREAM_EVENT,
  AI_TOOL,
  USER_ROLE,
} from "@clinic/shared";
import type { ConfigService } from "@nestjs/config";
import { AgentService } from "@api/ai/agent.service";
import { SYSTEM_PROMPT_VERSION } from "@api/ai/system-prompt";
import type { AiConversationsService } from "@api/ai/ai-conversations.service";
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
  options: { maxSteps?: number; toolContent?: string } = {},
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

      return Promise.resolve({
        name: call.name,
        content: options.toolContent ?? '{"tool":"x","untrusted_clinic_data":true,"result":[]}',
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

  // The only thing the agent reads directly: the clinic's name and time zone for the prompt.
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ nameAr: "عيادة", nameEn: "Clinic", settings: {} }]),
        }),
      }),
    }),
  } as unknown as Database;

  return {
    agent: new AgentService(db, provider, conversations, tools, config),
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
});
