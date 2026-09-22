import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { AI_TOOL, AI_TOOL_ERROR, USER_ROLE } from "@clinic/shared";
import { z } from "zod";
import { defineTool, Viewed, type AiTool } from "@api/ai/tools/ai-tool";
import type { AiToolsService } from "@api/ai/tools/ai-tools.service";
import { ToolRunnerService } from "@api/ai/tools/tool-runner.service";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import type { Database } from "@api/database/database.module";
import type { CapabilityRegistry } from "@api/permissions/capability-registry.service";
import type { PermissionsService } from "@api/permissions/permissions.service";

const ACTOR: AuthenticatedUser = {
  id: "11111111-1111-4111-8111-111111111111",
  clinicId: "22222222-2222-4222-8222-222222222222",
  role: USER_ROLE.RECEPTIONIST,
};

const CONVERSATION_ID = "33333333-3333-4333-8333-333333333333";
const CAPABILITY = "billing.list";

interface AuditRow {
  toolName: string;
  outcome: string;
  argsJson: unknown;
  clinicId: string;
  userId: string;
}

function harness(
  tools: AiTool[],
  options: { allows?: boolean; knownCapabilities?: string[] } = {},
): { runner: ToolRunnerService; audit: AuditRow[] } {
  const audit: AuditRow[] = [];

  const db = {
    insert: () => ({
      values: (row: AuditRow) => {
        audit.push(row);

        return Promise.resolve();
      },
    }),
  } as unknown as Database;

  const permissions = {
    allows: () => Promise.resolve(options.allows ?? true),
  } as unknown as PermissionsService;

  const known = options.knownCapabilities ?? [CAPABILITY];
  const registry = {
    get: (key: string) => (known.includes(key) ? { key } : undefined),
  } as unknown as CapabilityRegistry;

  const toolsService = { list: () => tools } as unknown as AiToolsService;

  return { runner: new ToolRunnerService(db, toolsService, permissions, registry), audit };
}

const echoTool = (capability: string | null = CAPABILITY): AiTool =>
  defineTool({
    name: AI_TOOL.GET_FINANCIAL_SUMMARY,
    description: "test",
    capability,
    schema: z.object({ period: z.enum(["today", "this_month"]) }),
    run: (actor, args) => Promise.resolve({ clinicId: actor.clinicId, role: actor.role, ...args }),
  });

const parse = (content: string): Record<string, unknown> =>
  JSON.parse(content) as Record<string, unknown>;

describe("running a tool the model asked for", () => {
  it("wraps a result in an envelope that marks it untrusted, and logs the call", async () => {
    const { runner, audit } = harness([echoTool()]);

    const run = await runner.run(ACTOR, CONVERSATION_ID, {
      id: "call_1",
      name: AI_TOOL.GET_FINANCIAL_SUMMARY,
      arguments: '{"period":"today"}',
    });

    expect(parse(run.content)).toEqual({
      tool: AI_TOOL.GET_FINANCIAL_SUMMARY,
      untrusted_clinic_data: true,
      result: { clinicId: ACTOR.clinicId, role: USER_ROLE.RECEPTIONIST, period: "today" },
    });
    expect(audit).toEqual([
      expect.objectContaining({
        toolName: AI_TOOL.GET_FINANCIAL_SUMMARY,
        outcome: "ok",
        clinicId: ACTOR.clinicId,
        userId: ACTOR.id,
      }),
    ]);
  });

  // The page draws the table; the model reads the result and nothing of the view.
  it("hands the view to the page and keeps it out of what the model reads", async () => {
    const view = {
      type: "stats" as const,
      tiles: [{ label: "assistant.view.stats.total", value: "7", kind: "number" as const }],
    };
    const tool = defineTool({
      name: AI_TOOL.GET_DAILY_STATS,
      description: "test",
      capability: null,
      schema: z.object({}),
      run: () => Promise.resolve(new Viewed({ total: 7 }, view)),
    });
    const { runner } = harness([tool]);

    const run = await runner.run(ACTOR, CONVERSATION_ID, {
      id: "call_1",
      name: AI_TOOL.GET_DAILY_STATS,
      arguments: "{}",
    });

    expect(parse(run.content)).toEqual({
      tool: AI_TOOL.GET_DAILY_STATS,
      untrusted_clinic_data: true,
      result: { total: 7 },
    });
    expect(run.content).not.toContain("assistant.view");
    expect(run.view).toEqual(view);
  });

  it("refuses a tool the clinic has not granted this role, without running it", async () => {
    let ran = false;
    const tool = defineTool({
      name: AI_TOOL.GET_FINANCIAL_SUMMARY,
      description: "test",
      capability: CAPABILITY,
      schema: z.object({}),
      run: () => {
        ran = true;

        return Promise.resolve({});
      },
    });
    const { runner, audit } = harness([tool], { allows: false });

    const run = await runner.run(ACTOR, CONVERSATION_ID, {
      id: "call_1",
      name: AI_TOOL.GET_FINANCIAL_SUMMARY,
      arguments: "{}",
    });

    expect(parse(run.content)).toEqual({
      tool: AI_TOOL.GET_FINANCIAL_SUMMARY,
      error: AI_TOOL_ERROR.NOT_PERMITTED,
    });
    expect(ran).toBe(false);
    expect(audit[0]?.outcome).toBe(AI_TOOL_ERROR.NOT_PERMITTED);
  });

  it("rejects malformed arguments and tells the model which field was wrong", async () => {
    const { runner, audit } = harness([echoTool()]);

    const run = await runner.run(ACTOR, CONVERSATION_ID, {
      id: "call_1",
      name: AI_TOOL.GET_FINANCIAL_SUMMARY,
      arguments: '{"period":"last_decade"}',
    });

    const envelope = parse(run.content);

    expect(envelope["error"]).toBe(AI_TOOL_ERROR.INVALID_ARGUMENTS);
    expect(envelope["details"]).toEqual([expect.stringContaining("period")]);
    expect(audit[0]?.outcome).toBe(AI_TOOL_ERROR.INVALID_ARGUMENTS);
  });

  it("treats arguments that are not JSON at all as empty ones", async () => {
    const { runner } = harness([echoTool()]);

    const run = await runner.run(ACTOR, CONVERSATION_ID, {
      id: "call_1",
      name: AI_TOOL.GET_FINANCIAL_SUMMARY,
      arguments: "not json",
    });

    expect(parse(run.content)["error"]).toBe(AI_TOOL_ERROR.INVALID_ARGUMENTS);
  });

  it("answers a tool the model invented rather than failing the turn", async () => {
    const { runner } = harness([echoTool()]);

    const run = await runner.run(ACTOR, CONVERSATION_ID, {
      id: "call_1",
      name: "delete_all_patients",
      arguments: "{}",
    });

    expect(parse(run.content)).toEqual({
      tool: "delete_all_patients",
      error: AI_TOOL_ERROR.NOT_FOUND,
    });
  });

  it("keeps a free-text search out of the audit row", async () => {
    const tool = defineTool({
      name: AI_TOOL.SEARCH_PATIENTS,
      description: "test",
      capability: null,
      schema: z.object({ query: z.string() }),
      run: () => Promise.resolve([]),
    });
    const { runner, audit } = harness([tool]);

    await runner.run(ACTOR, CONVERSATION_ID, {
      id: "call_1",
      name: AI_TOOL.SEARCH_PATIENTS,
      arguments: '{"query":"سمير عبد الله"}',
    });

    expect(audit[0]?.argsJson).toEqual({ query: "<redacted>" });
  });

  it("turns a service's own refusal into a code, never its message", async () => {
    const cases = [
      {
        thrown: new NotFoundException("patient 42 not in clinic 7"),
        expected: AI_TOOL_ERROR.NOT_FOUND,
      },
      {
        thrown: new ForbiddenException("Insufficient role"),
        expected: AI_TOOL_ERROR.NOT_PERMITTED,
      },
      { thrown: new Error("relation ai_messages does not exist"), expected: AI_TOOL_ERROR.FAILED },
    ];

    for (const { thrown, expected } of cases) {
      const tool = defineTool({
        name: AI_TOOL.GET_PATIENT_SUMMARY,
        description: "test",
        capability: null,
        schema: z.object({}),
        run: () => Promise.reject(thrown),
      });
      const { runner } = harness([tool]);

      const run = await runner.run(ACTOR, CONVERSATION_ID, {
        id: "call_1",
        name: AI_TOOL.GET_PATIENT_SUMMARY,
        arguments: "{}",
      });

      expect(parse(run.content)).toEqual({ tool: AI_TOOL.GET_PATIENT_SUMMARY, error: expected });
      expect(run.content).not.toContain("ai_messages");
      expect(run.content).not.toContain("clinic 7");
    }
  });

  // A renamed controller would turn a tool's capability into one nobody holds, locking the
  // assistant out of it silently.
  it("refuses to boot when a tool names a capability no endpoint declares", () => {
    const { runner } = harness([echoTool("billing.renamed")], { knownCapabilities: [CAPABILITY] });

    expect(() => runner.onApplicationBootstrap()).toThrow("billing.renamed");
  });

  it("boots when every capability resolves", () => {
    const { runner } = harness([echoTool(), echoTool(null)]);

    expect(() => runner.onApplicationBootstrap()).not.toThrow();
  });
});
