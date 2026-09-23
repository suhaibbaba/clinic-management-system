import { AI_TOOL_ERROR, USER_ROLE } from "@clinic/shared";
import type { Sql } from "postgres";
import { QueryDataService } from "@api/ai/query/query-data.service";
import { ToolRefusal } from "@api/ai/tools/ai-tool";
import type { CapabilityRegistry } from "@api/permissions/capability-registry.service";
import type { PermissionsService } from "@api/permissions/permissions.service";

const ACTOR = {
  id: "11111111-1111-4111-8111-111111111111",
  clinicId: "22222222-2222-4222-8222-222222222222",
  role: USER_ROLE.ADMIN,
};

function service(failure: unknown): QueryDataService {
  const client = { begin: () => Promise.reject(failure) } as unknown as Sql;
  const permissions = { allows: () => Promise.resolve(true) } as unknown as PermissionsService;

  return new QueryDataService(client, permissions, {} as CapabilityRegistry);
}

const postgresError = (code: string, message: string) =>
  Object.assign(new Error(message), { name: "PostgresError", code });

describe("a query Postgres stops", () => {
  it("maps the statement timeout to its own code", async () => {
    await expect(
      service(postgresError("57014", "canceling statement due to statement timeout")).run(
        ACTOR,
        "SELECT count(*) FROM ai_read.patients",
      ),
    ).rejects.toEqual(new ToolRefusal(AI_TOOL_ERROR.QUERY_TIMEOUT));
  });

  it("hands back any other refusal in Postgres's words", async () => {
    const refusal = await service(postgresError("42703", 'column "x" does not exist'))
      .run(ACTOR, "SELECT x FROM ai_read.patients")
      .catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(ToolRefusal);
    expect((refusal as ToolRefusal).code).toBe(AI_TOOL_ERROR.QUERY_ERROR);
    expect((refusal as ToolRefusal).details).toEqual(['column "x" does not exist']);
  });
});
