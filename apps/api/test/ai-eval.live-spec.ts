import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AI_TOOL, USER_ROLE } from "@clinic/shared";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { AppModule } from "@api/app.module";
import type { ChatMessage, ChatToolCall } from "@api/ai/chat-provider";
import { OpenAiChatProvider } from "@api/ai/openai-chat.provider";
import { systemPrompt } from "@api/ai/system-prompt";
import { ToolRunnerService } from "@api/ai/tools/tool-runner.service";
import { envSchema } from "@api/config/env.schema";
import { CapabilityRegistry } from "@api/permissions/capability-registry.service";
import { EVAL_CASES } from "@test/helpers/ai-eval-cases";

// `pnpm ai:eval:live`: the 25 questions against the real provider, printing the tool it chose.
// Not in CI and not a pass/fail gate — a way to judge a model switch in one run.

function loadRootEnv(): void {
  const file = join(__dirname, "..", "..", "..", ".env");

  if (!existsSync(file)) {
    return;
  }

  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());

    if (match?.[1] && process.env[match[1]] === undefined) {
      process.env[match[1]] = (match[2] ?? "").replace(/^["']|["']$/g, "");
    }
  }
}

loadRootEnv();

const env = envSchema.safeParse(process.env);
const live = env.success && Boolean(env.data.OPENAI_API_KEY);

async function firstChoice(
  provider: OpenAiChatProvider,
  runner: ToolRunnerService,
  question: string,
): Promise<{ tool: string; loaded: string[] }> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: systemPrompt({
        clinicName: { ar: "عيادة النور", en: "Al Noor Clinic" },
        user: { name: { ar: "سائد", en: "Saed" }, role: USER_ROLE.ADMIN },
        doctor: null,
        today: new Date().toISOString().slice(0, 10),
        now: "10:00",
        weekday: "Wednesday",
      }),
    },
    { role: "user", content: question },
  ];
  const loaded = new Set<string>();

  for (let step = 0; step < 3; step += 1) {
    let calls: readonly ChatToolCall[] = [];

    for await (const chunk of provider.stream({ messages, tools: runner.definitions(loaded) })) {
      if (chunk.type === "completed") {
        calls = chunk.toolCalls;
      }
    }

    const load = calls.find((call) => call.name === AI_TOOL.LOAD_TOOLS);

    if (!load) {
      return { tool: calls[0]?.name ?? "(answered without a tool)", loaded: [...loaded] };
    }

    const groups = (JSON.parse(load.arguments || "{}") as { groups?: string[] }).groups ?? [];

    groups.forEach((group) => loaded.add(group));
    messages.push({ role: "assistant", content: "", toolCalls: [load] });
    messages.push({
      role: "tool",
      toolCallId: load.id,
      content: JSON.stringify({
        tool: AI_TOOL.LOAD_TOOLS,
        result: { loaded: runner.toolsIn(groups) },
      }),
    });
  }

  return { tool: "(only loaded tools)", loaded: [...loaded] };
}

(live ? describe : describe.skip)("the 25 questions against the real model", () => {
  it("prints what it chose", async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    moduleRef.get(CapabilityRegistry).onApplicationBootstrap();

    const runner = moduleRef.get(ToolRunnerService);
    const provider = new OpenAiChatProvider(new ConfigService(env.success ? env.data : {}));
    const rows = [];

    for (const evalCase of EVAL_CASES) {
      const choice = await firstChoice(provider, runner, evalCase.question);

      rows.push({
        question: evalCase.question,
        expected: evalCase.tool,
        chosen: choice.tool,
        loaded: choice.loaded.join(","),
        ok: choice.tool === evalCase.tool ? "✓" : "✗",
      });
    }

    // The report is the point of the run; jest's console would bury it in stack frames.
    process.stdout.write(
      [
        ...rows.map(
          (row) => `${row.ok}  ${row.expected.padEnd(28)} ${row.chosen.padEnd(28)} ${row.question}`,
        ),
        `${rows.filter((row) => row.ok === "✓").length}/${rows.length} chose the expected tool ` +
          `(model ${env.success ? env.data.AI_MODEL : "?"})`,
        "",
      ].join("\n"),
    );
  }, 600_000);
});
