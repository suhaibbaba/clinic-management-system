import { AI_TOOL, AI_TOOL_ERROR, USER_ROLE, type UserRole } from "@clinic/shared";
import { AiConversationsService } from "@api/ai/ai-conversations.service";
import { ToolRunnerService } from "@api/ai/tools/tool-runner.service";
import { PermissionsService } from "@api/permissions/permissions.service";
import { createPatient } from "@test/helpers/patient-fixtures";
import { createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

interface ToolResult {
  error?: string;
  result?: { columns: string[]; rows: Record<string, unknown>[]; truncated: boolean };
}

describe("query_data (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let other: TestClinic;

  async function query(target: TestClinic, role: UserRole, sql: string): Promise<ToolResult> {
    const actor = { id: target.userIds[role], clinicId: target.id, role };
    const { id } = await context.app.get(AiConversationsService).start(actor, "سؤال");
    const run = await context.app.get(ToolRunnerService).run(actor, id, {
      id: "call_1",
      name: AI_TOOL.QUERY_DATA,
      arguments: JSON.stringify({ sql, purpose: "test" }),
    });

    return JSON.parse(run.content) as ToolResult;
  }

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();
    other = await context.createClinic();

    await createPatient(context, await context.login(clinic.phones[USER_ROLE.RECEPTIONIST]), {
      fullName: "مريض هذه العيادة",
      phone: "0599000555",
    });
    await createPatient(context, await context.login(other.phones[USER_ROLE.RECEPTIONIST]), {
      fullName: "مريض عيادة أخرى",
      phone: "0599000666",
    });
  });

  afterAll(async () => {
    await context.close();
  });

  it("sees only its own clinic's rows, though the SQL names no clinic", async () => {
    const { result } = await query(
      clinic,
      USER_ROLE.ADMIN,
      "SELECT full_name, phone_last4 FROM ai_read.patients",
    );

    expect(result?.rows).toEqual([{ full_name: "مريض هذه العيادة", phone_last4: "0555" }]);
  });

  it("never reaches a table, only the views", async () => {
    const { error } = await query(clinic, USER_ROLE.ADMIN, "SELECT * FROM patients");

    expect(error).toBe(AI_TOOL_ERROR.QUERY_RELATION_NOT_ALLOWED);
  });

  it("is not a receptionist's by default", async () => {
    const { error } = await query(
      clinic,
      USER_ROLE.RECEPTIONIST,
      "SELECT count(*) FROM ai_read.patients",
    );

    expect(error).toBe(AI_TOOL_ERROR.NOT_PERMITTED);
  });

  it("keeps the clinical views from a role that may not read visits", async () => {
    await context.app
      .get(PermissionsService)
      .set(
        clinic.id,
        USER_ROLE.RECEPTIONIST,
        "reports.list",
        true,
        clinic.userIds[USER_ROLE.ADMIN],
      );

    const plain = await query(
      clinic,
      USER_ROLE.RECEPTIONIST,
      "SELECT count(*) AS n FROM ai_read.patients",
    );
    const clinical = await query(
      clinic,
      USER_ROLE.RECEPTIONIST,
      "SELECT count(*) FROM ai_read.visit_clinical",
    );

    expect(plain.result?.rows).toEqual([{ n: "1" }]);
    expect(clinical.error).toBe(AI_TOOL_ERROR.QUERY_CLINICAL_NOT_PERMITTED);
  });

  it("answers a column that does not exist with Postgres's own words", async () => {
    const { error } = await query(
      clinic,
      USER_ROLE.ADMIN,
      "SELECT national_id FROM ai_read.patients",
    );

    expect(error).toBe(AI_TOOL_ERROR.QUERY_ERROR);
  });
});
