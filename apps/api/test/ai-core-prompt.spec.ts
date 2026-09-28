import { AI_TOOL, USER_ROLE } from "@clinic/shared";
import { AiActionsService } from "@api/modules/ai/actions/ai-actions.service";
import { systemPrompt } from "@api/modules/ai/lib/system-prompt";
import { AiToolsService } from "@api/modules/ai/tools/ai-tools.service";
import { ToolRunnerService } from "@api/modules/ai/tools/tool-runner.service";
import type { CapabilityRegistry } from "@api/modules/permissions/services/capability-registry.service";
import type { PermissionsService } from "@api/modules/permissions/services/permissions.service";
import type { Database } from "@api/database/database.module";

const standIn = new Proxy({}, { get: () => () => undefined });

function runner(): ToolRunnerService {
  const construct = <T>(type: new (...args: never[]) => T): T =>
    new (type as unknown as new (...args: unknown[]) => T)(...Array<unknown>(30).fill(standIn));
  const tools = construct(AiToolsService);

  const actions = construct(AiActionsService);
  const routes = { list: () => [] };

  Object.assign(actions, { routes });
  Object.assign(tools, { actions, routes });

  return new ToolRunnerService(
    standIn as Database,
    tools,
    standIn as PermissionsService,
    standIn as CapabilityRegistry,
  );
}

const prompt = systemPrompt({
  clinicName: { ar: "عيادة النور", en: "Al Noor Clinic" },
  user: { name: { ar: "سارة", en: "Sara" }, role: USER_ROLE.ADMIN },
  doctor: null,
  today: "2026-09-24",
  now: "10:00",
  weekday: "Thursday",
});

const tokens = (text: string): number => Math.ceil(text.length / 4);

const CORE_CEILING = 4300;

describe("the request before any group is loaded", () => {
  it("stays under its ceiling", () => {
    const core = runner().definitions(new Set());

    expect(tokens(prompt) + tokens(JSON.stringify(core))).toBeLessThan(CORE_CEILING);
  });

  it("carries the core set and nothing else", () => {
    expect(
      runner()
        .definitions(new Set())
        .map((tool) => tool.name)
        .sort(),
    ).toEqual(
      [
        AI_TOOL.DRAFT_BULK_MESSAGE,
        AI_TOOL.FIND_DOCTORS,
        AI_TOOL.GET_APPOINTMENTS,
        AI_TOOL.GET_PATIENT_SUMMARY,
        AI_TOOL.LOAD_TOOLS,
        AI_TOOL.PROPOSE_PLAN,
        AI_TOOL.QUERY_DATA,
        AI_TOOL.SEARCH_PATIENTS,
      ].sort(),
    );
  });

  it("is a small part of the whole toolbox", () => {
    const core = tokens(JSON.stringify(runner().definitions(new Set())));
    const all = tokens(JSON.stringify(runner().definitions()));

    expect(core / all).toBeLessThan(0.25);
  });
});
