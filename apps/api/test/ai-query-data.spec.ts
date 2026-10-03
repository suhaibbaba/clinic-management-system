import { AI_TOOL_ERROR, RULE, USER_ROLE } from "@clinic/shared";
import type { Sql } from "postgres";
import { QueryDataService } from "@api/modules/ai/query/query-data.service";
import { ToolRefusal } from "@api/modules/ai/tools/ai-tool";
import type { CapabilityRegistry } from "@api/modules/permissions/services/capability-registry.service";
import type { PermissionsService } from "@api/modules/permissions/services/permissions.service";
import type { AppointmentAccessService } from "@api/modules/appointments/services/appointment-access.service";

const ACTOR = {
  id: "11111111-1111-4111-8111-111111111111",
  clinicId: "22222222-2222-4222-8222-222222222222",
  role: USER_ROLE.ADMIN,
};

function service(failure: unknown): QueryDataService {
  const client = { begin: () => Promise.reject(failure) } as unknown as Sql;
  const permissions = { allows: () => Promise.resolve(true) } as unknown as PermissionsService;

  return new QueryDataService(client, permissions, {} as CapabilityRegistry, access(null));
}

function access(scope: string | null): AppointmentAccessService {
  return { calendarScope: () => Promise.resolve(scope) } as unknown as AppointmentAccessService;
}

function recording(allowed: (capability: string) => boolean, scope: string | null) {
  const settings: unknown[] = [];
  const tx = Object.assign(
    (_strings: TemplateStringsArray, ...values: unknown[]) => {
      settings.push(values);
      return Promise.resolve([]);
    },
    { unsafe: () => Promise.resolve(Object.assign([], { columns: [] })) },
  );
  const client = {
    begin: (_mode: string, body: (inner: typeof tx) => Promise<unknown>) => body(tx),
  } as unknown as Sql;
  const permissions = {
    allows: (_clinic: string, _role: string, capability: string) =>
      Promise.resolve(allowed(capability)),
  } as unknown as PermissionsService;

  return {
    settings,
    service: new QueryDataService(client, permissions, {} as CapabilityRegistry, access(scope)),
  };
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

describe("who may read what through a query", () => {
  it("refuses whoever may not see every patient, since the views ignore assignments", async () => {
    const { service: query } = recording((capability) => capability !== RULE.PATIENTS_ALL, null);

    await expect(
      query.run({ ...ACTOR, role: USER_ROLE.VISITING_DOCTOR }, "SELECT id FROM ai_read.patients"),
    ).rejects.toEqual(new ToolRefusal(AI_TOOL_ERROR.QUERY_NOT_PERMITTED));
  });

  it("holds lab payments to the role the app shows them to", async () => {
    const { service: query } = recording(
      (capability) => capability !== "lab-ledger.listPayments",
      null,
    );

    await expect(query.run(ACTOR, "SELECT sum(amount) FROM ai_read.lab_payments")).rejects.toEqual(
      new ToolRefusal(AI_TOOL_ERROR.QUERY_NOT_PERMITTED, ["lab_payments"]),
    );
  });

  it("scopes a doctor's query to their own calendar, and nobody else's", async () => {
    const doctor = recording(() => true, "33333333-3333-4333-8333-333333333333");
    await doctor.service.run(
      { ...ACTOR, role: USER_ROLE.DOCTOR },
      "SELECT id FROM ai_read.appointments",
    );
    expect(doctor.settings).toContainEqual(["33333333-3333-4333-8333-333333333333"]);

    const admin = recording(() => true, null);
    await admin.service.run(ACTOR, "SELECT id FROM ai_read.appointments");
    expect(admin.settings).toContainEqual([""]);
  });
});
