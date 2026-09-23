import { AI_TOOL, USER_ROLE, type AiRiskTier } from "@clinic/shared";
import type { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { AppModule } from "@api/app.module";
import { AgentService } from "@api/ai/agent.service";
import type { AiConversationsService } from "@api/ai/ai-conversations.service";
import type { ChatChunk, ChatProvider, ChatRequest, ChatToolCall } from "@api/ai/chat-provider";
import type { ChatProviderResolver } from "@api/ai/chat-provider.resolver";
import type { AiTool } from "@api/ai/tools/ai-tool";
import { AiToolsService } from "@api/ai/tools/ai-tools.service";
import { TOOL_GROUP_NAMES } from "@api/ai/tools/tool-groups";
import { ToolRunnerService } from "@api/ai/tools/tool-runner.service";
import type { Env } from "@api/config/env.schema";
import type { Database } from "@api/database/database.module";
import { CapabilityRegistry } from "@api/permissions/capability-registry.service";
import type { PermissionsService } from "@api/permissions/permissions.service";
import { EVAL_CASES, type EvalCase } from "@test/helpers/ai-eval-cases";

// Compiling the graph queries nothing; the pool connects on its first query, which never comes.
process.env["DATABASE_URL"] ??= "postgres://nobody:nothing@127.0.0.1:1/none";

const ACTOR = {
  id: "11111111-1111-4111-8111-111111111111",
  clinicId: "22222222-2222-4222-8222-222222222222",
  role: USER_ROLE.ADMIN,
};

/** The real toolbox, each tool's body replaced: this is about routing and tiers, not data. */
async function toolbox(): Promise<AiTool[]> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  moduleRef.get(CapabilityRegistry).onApplicationBootstrap();

  return moduleRef
    .get(AiToolsService)
    .list()
    .map((tool) => ({
      ...tool,
      execute: () => Promise.resolve({ ok: true as const, data: { ran: tool.name } }),
    }));
}

function runner(tools: AiTool[]): ToolRunnerService {
  const db = {
    insert: () => ({ values: () => Promise.resolve() }),
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
  } as unknown as Database;

  return new ToolRunnerService(
    db,
    { list: () => tools } as unknown as AiToolsService,
    { allows: () => Promise.resolve(true) } as unknown as PermissionsService,
    { get: () => ({}) } as unknown as CapabilityRegistry,
  );
}

const completed = (text: string, toolCalls: ChatToolCall[] = []): ChatChunk => ({
  type: "completed",
  text,
  toolCalls,
  usage: { inputTokens: 1, outputTokens: 1 },
});

// The "model" replays what a good answer does: load the groups the question needs, call the tool.
function scripted(evalCase: EvalCase): { provider: ChatProvider; requests: ChatRequest[] } {
  const requests: ChatRequest[] = [];
  const steps: ChatChunk[] = [
    ...(evalCase.groups.length > 0
      ? [
          completed("", [
            {
              id: "call_load",
              name: AI_TOOL.LOAD_TOOLS,
              arguments: JSON.stringify({ groups: evalCase.groups }),
            },
          ]),
        ]
      : []),
    completed("", [{ id: "call_tool", name: evalCase.tool, arguments: "{}" }]),
    completed("تمام"),
  ];

  return {
    requests,
    provider: {
      name: "scripted",
      async *stream(request: ChatRequest): AsyncIterable<ChatChunk> {
        requests.push(request);
        yield steps.shift() ?? completed("");
      },
    },
  };
}

function agent(provider: ChatProvider, tools: ToolRunnerService): AgentService {
  const loaded = new Map<string, string[]>();
  const conversations = {
    start: () => Promise.resolve({ id: "c" }),
    requireOwn: () => Promise.resolve({ id: "c" }),
    history: () => Promise.resolve([]),
    append: () => Promise.resolve({ id: "m" }),
    loadedGroups: (id: string) => Promise.resolve(loaded.get(id) ?? []),
    loadGroups: (id: string, groups: string[]) => {
      loaded.set(id, [...new Set([...(loaded.get(id) ?? []), ...groups])]);

      return Promise.resolve(loaded.get(id) ?? []);
    },
  } as unknown as AiConversationsService;
  const settings: Partial<Record<keyof Env, unknown>> = {
    AI_HISTORY_MESSAGES: 60,
    AI_MAX_TOOL_STEPS: 4,
  };
  const db = {
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
  } as unknown as Database;

  return new AgentService(
    db,
    { for: () => Promise.resolve(provider) } as unknown as ChatProviderResolver,
    conversations,
    tools,
    { get: (key: keyof Env) => settings[key] } as unknown as ConfigService<Env, true>,
  );
}

describe("the toolbox answers the 25 questions it is meant to", () => {
  let tools: AiTool[];

  beforeAll(async () => {
    tools = await toolbox();
  });

  it("covers every group", () => {
    expect(EVAL_CASES).toHaveLength(25);
    expect(new Set(EVAL_CASES.flatMap((evalCase) => evalCase.groups))).toEqual(
      new Set(TOOL_GROUP_NAMES),
    );
  });

  it.each(EVAL_CASES.map((evalCase) => [evalCase.question, evalCase] as const))(
    "%s",
    async (_question, evalCase) => {
      const { provider, requests } = scripted(evalCase);
      const toolRunner = runner(tools);
      const offeredFirst = requests;

      for await (const _event of agent(provider, toolRunner).run(ACTOR, {
        message: evalCase.question,
      })) {
        // drained
      }

      const tool = tools.find((candidate) => candidate.name === evalCase.tool);
      const answer = requests.at(-1)?.messages.at(-1);

      // It exists, it ships on the tier expected, and the runner reached it once loaded.
      expect(tool?.risk ?? null).toBe(evalCase.tier satisfies AiRiskTier | null);
      expect(answer).toMatchObject({ role: "tool" });
      expect(answer?.content).toContain(`"ran":"${evalCase.tool}"`);

      // A tool outside the core is not offered before its group is loaded.
      const first = offeredFirst[0]?.tools.map((definition) => definition.name) ?? [];

      expect(first.includes(evalCase.tool)).toBe(evalCase.groups.length === 0);
    },
  );
});
