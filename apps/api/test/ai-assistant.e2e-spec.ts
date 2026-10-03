import {
  AI_MESSAGE_ROLE,
  AI_STREAM_EVENT,
  AI_TOOL,
  USER_ROLE,
  aiViewSchema,
  type AiStreamEvent,
  type UserRole,
} from "@clinic/shared";
import { AgentService } from "@api/modules/ai/services/agent.service";
import { AiConversationsService } from "@api/modules/ai/services/ai-conversations.service";
import { AiToolsService } from "@api/modules/ai/tools/ai-tools.service";
import { ToolRunnerService } from "@api/modules/ai/tools/tool-runner.service";
import { doctors } from "@api/database/schema";
import { PermissionsService } from "@api/modules/permissions/services/permissions.service";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

const ROLES = [
  USER_ROLE.ADMIN,
  USER_ROLE.DOCTOR,
  USER_ROLE.RECEPTIONIST,
  USER_ROLE.TECHNICIAN,
] as const;

const PERMITTED_TOOLS: Record<(typeof ROLES)[number], string[]> = {
  [USER_ROLE.ADMIN]: [
    "add_clinic_closure",
    "add_doctor_extra_hours",
    "add_doctor_time_off",
    "add_patient_note",
    "appointments_find_one",
    "billing_list",
    "cancel_appointments",
    "clinic_closures_list",
    "clinic_closures_remove",
    "clinic_closures_update",
    "create_appointment",
    "create_patient",
    "dashboard_summary",
    "delete_doctor_time_off",
    "doctor_extra_hours_list",
    "doctor_extra_hours_remove",
    "doctor_time_off_list",
    "doctors_find_one",
    "doctors_update",
    "draft_bulk_message",
    "find_available_slots",
    "find_doctors",
    "get_appointments",
    "get_daily_stats",
    "get_financial_summary",
    "get_low_stock_items",
    "get_overdue_lab_orders",
    "get_patient_summary",
    "inventory_batches",
    "inventory_create",
    "inventory_find_one",
    "inventory_item_movements",
    "inventory_list",
    "inventory_list_movements",
    "inventory_remove",
    "inventory_shopping_list",
    "inventory_update",
    "lab_ledger_balance",
    "lab_ledger_list_payments",
    "lab_ledger_statement",
    "lab_orders_create",
    "lab_orders_find_one",
    "lab_orders_list",
    "lab_orders_remove",
    "lab_orders_update",
    "labs_create",
    "labs_create_work_type",
    "labs_find_one",
    "labs_list",
    "labs_list_work_types",
    "labs_remove",
    "labs_remove_work_type",
    "labs_update",
    "labs_update_work_type",
    "medical_histories_allergy_flags",
    "medical_histories_get",
    "medical_histories_update",
    "patient_billing_balance",
    "patient_billing_statement",
    "patients_remove",
    "patients_update",
    "payments_find_one",
    "payments_list",
    "prescriptions_create",
    "prescriptions_find_one",
    "prescriptions_list",
    "prescriptions_remove",
    "prescriptions_update",
    "procedure_catalog_create",
    "procedure_catalog_find_one",
    "procedure_catalog_list",
    "procedure_catalog_remove",
    "procedure_catalog_update",
    "procedures_create",
    "procedures_find_one",
    "procedures_list",
    "procedures_remove",
    "procedures_update",
    "propose_plan",
    "query_data",
    "record_lab_payment",
    "record_payment",
    "record_stock_movement",
    "reschedule_appointment",
    "reverse_lab_payment",
    "reverse_payment",
    "reverse_stock_movement",
    "search_patients",
    "set_appointment_status",
    "set_doctor_schedule",
    "set_lab_order_status",
    "suppliers_create",
    "suppliers_find_one",
    "suppliers_list",
    "suppliers_remove",
    "suppliers_statement",
    "suppliers_update",
    "timeline_list",
    "tooth_history_get",
    "update_doctor_time_off",
    "visits_create",
    "visits_find_one",
    "visits_list",
    "visits_remove",
    "visits_update",
    "waiting_list_create",
    "waiting_list_decline",
    "waiting_list_find_one",
    "waiting_list_list",
    "waiting_list_mark_contacted",
    "waiting_list_promote",
    "waiting_list_remove",
    "waiting_list_update",
  ],
  [USER_ROLE.DOCTOR]: [
    "add_doctor_extra_hours",
    "add_doctor_time_off",
    "add_patient_note",
    "appointments_find_one",
    "billing_list",
    "cancel_appointments",
    "clinic_closures_list",
    "create_appointment",
    "create_patient",
    "dashboard_summary",
    "delete_doctor_time_off",
    "doctor_extra_hours_list",
    "doctor_extra_hours_remove",
    "doctor_time_off_list",
    "doctors_find_one",
    "draft_bulk_message",
    "find_available_slots",
    "find_doctors",
    "get_appointments",
    "get_daily_stats",
    "get_financial_summary",
    "get_low_stock_items",
    "get_overdue_lab_orders",
    "get_patient_summary",
    "inventory_batches",
    "inventory_create",
    "inventory_find_one",
    "inventory_item_movements",
    "inventory_list",
    "inventory_list_movements",
    "inventory_shopping_list",
    "inventory_update",
    "lab_ledger_balance",
    "lab_ledger_list_payments",
    "lab_ledger_statement",
    "lab_orders_create",
    "lab_orders_find_one",
    "lab_orders_list",
    "lab_orders_update",
    "labs_create",
    "labs_create_work_type",
    "labs_find_one",
    "labs_list",
    "labs_list_work_types",
    "labs_update",
    "labs_update_work_type",
    "medical_histories_allergy_flags",
    "medical_histories_get",
    "medical_histories_update",
    "patient_billing_balance",
    "patient_billing_statement",
    "patients_update",
    "payments_find_one",
    "payments_list",
    "prescriptions_create",
    "prescriptions_find_one",
    "prescriptions_list",
    "prescriptions_remove",
    "prescriptions_update",
    "procedure_catalog_find_one",
    "procedure_catalog_list",
    "procedures_create",
    "procedures_find_one",
    "procedures_list",
    "procedures_remove",
    "procedures_update",
    "propose_plan",
    "query_data",
    "record_lab_payment",
    "record_payment",
    "record_stock_movement",
    "reschedule_appointment",
    "reverse_stock_movement",
    "search_patients",
    "set_appointment_status",
    "set_doctor_schedule",
    "set_lab_order_status",
    "suppliers_create",
    "suppliers_find_one",
    "suppliers_list",
    "suppliers_statement",
    "suppliers_update",
    "timeline_list",
    "tooth_history_get",
    "update_doctor_time_off",
    "visits_create",
    "visits_find_one",
    "visits_list",
    "visits_update",
    "waiting_list_create",
    "waiting_list_decline",
    "waiting_list_find_one",
    "waiting_list_list",
    "waiting_list_mark_contacted",
    "waiting_list_promote",
    "waiting_list_update",
  ],
  [USER_ROLE.RECEPTIONIST]: [
    "add_patient_note",
    "appointments_find_one",
    "billing_list",
    "cancel_appointments",
    "clinic_closures_list",
    "create_appointment",
    "create_patient",
    "dashboard_summary",
    "doctor_extra_hours_list",
    "doctor_time_off_list",
    "doctors_find_one",
    "draft_bulk_message",
    "find_available_slots",
    "find_doctors",
    "get_appointments",
    "get_daily_stats",
    "get_financial_summary",
    "get_patient_summary",
    "patient_billing_balance",
    "patient_billing_statement",
    "patients_update",
    "payments_find_one",
    "payments_list",
    "procedure_catalog_find_one",
    "procedure_catalog_list",
    "propose_plan",
    "record_payment",
    "reschedule_appointment",
    "search_patients",
    "set_appointment_status",
    "timeline_list",
    "waiting_list_create",
    "waiting_list_decline",
    "waiting_list_find_one",
    "waiting_list_list",
    "waiting_list_mark_contacted",
    "waiting_list_promote",
    "waiting_list_update",
  ],
  [USER_ROLE.TECHNICIAN]: [
    "add_patient_note",
    "appointments_find_one",
    "billing_list",
    "cancel_appointments",
    "clinic_closures_list",
    "create_appointment",
    "create_patient",
    "dashboard_summary",
    "doctor_extra_hours_list",
    "doctor_time_off_list",
    "doctors_find_one",
    "draft_bulk_message",
    "find_available_slots",
    "find_doctors",
    "get_appointments",
    "get_daily_stats",
    "get_financial_summary",
    "get_low_stock_items",
    "get_overdue_lab_orders",
    "get_patient_summary",
    "inventory_batches",
    "inventory_create",
    "inventory_find_one",
    "inventory_item_movements",
    "inventory_list",
    "inventory_list_movements",
    "inventory_shopping_list",
    "inventory_update",
    "lab_ledger_balance",
    "lab_ledger_list_payments",
    "lab_ledger_statement",
    "lab_orders_create",
    "lab_orders_find_one",
    "lab_orders_list",
    "lab_orders_update",
    "labs_create",
    "labs_create_work_type",
    "labs_find_one",
    "labs_list",
    "labs_list_work_types",
    "labs_update",
    "labs_update_work_type",
    "medical_histories_allergy_flags",
    "medical_histories_get",
    "medical_histories_update",
    "patient_billing_balance",
    "patient_billing_statement",
    "patients_update",
    "payments_find_one",
    "payments_list",
    "prescriptions_find_one",
    "prescriptions_list",
    "procedure_catalog_find_one",
    "procedure_catalog_list",
    "procedures_create",
    "procedures_find_one",
    "procedures_list",
    "procedures_remove",
    "procedures_update",
    "propose_plan",
    "query_data",
    "record_lab_payment",
    "record_payment",
    "record_stock_movement",
    "reschedule_appointment",
    "reverse_stock_movement",
    "search_patients",
    "set_appointment_status",
    "set_lab_order_status",
    "suppliers_create",
    "suppliers_find_one",
    "suppliers_list",
    "suppliers_statement",
    "suppliers_update",
    "timeline_list",
    "tooth_history_get",
    "visits_find_one",
    "visits_list",
    "waiting_list_create",
    "waiting_list_decline",
    "waiting_list_find_one",
    "waiting_list_list",
    "waiting_list_mark_contacted",
    "waiting_list_promote",
    "waiting_list_update",
  ],
};

function events(body: string): AiStreamEvent[] {
  return body
    .split("\n\n")
    .filter((frame) => frame.startsWith("data: "))
    .map((frame) => JSON.parse(frame.slice("data: ".length)) as AiStreamEvent);
}

describe("Clinic assistant (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  const tokens = {} as Record<UserRole, string>;

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();

    for (const role of ROLES) {
      tokens[role] = await context.login(clinic.phones[role]);
    }
  });

  afterAll(async () => {
    await context.close();
  });

  describe("which tools a role may run", () => {
    it.each(ROLES)("serves %s exactly the tools its permissions allow", async (role) => {
      const tools = context.app.get(AiToolsService);
      const permissions = context.app.get(PermissionsService);

      const allowed: string[] = [];

      for (const tool of tools.list()) {
        const permitted =
          tool.capability === null || (await permissions.allows(clinic.id, role, tool.capability));

        if (permitted) {
          allowed.push(tool.name);
        }
      }

      expect(allowed.sort()).toEqual([...PERMITTED_TOOLS[role]].sort());
    });

    it("names only capabilities the route table knows", () => {
      const runner = context.app.get(ToolRunnerService);

      expect(() => runner.onApplicationBootstrap()).not.toThrow();
    });

    it("refuses a receptionist the financial tool once the clinic takes the permission away", async () => {
      const permissions = context.app.get(PermissionsService);
      const tools = context.app.get(AiToolsService);
      const financial = tools.list().find((tool) => tool.name === AI_TOOL.GET_FINANCIAL_SUMMARY);

      await permissions.set(
        clinic.id,
        USER_ROLE.RECEPTIONIST,
        financial?.capability ?? "",
        false,
        clinic.userIds[USER_ROLE.ADMIN],
      );

      await expect(
        permissions.allows(clinic.id, USER_ROLE.RECEPTIONIST, financial?.capability ?? ""),
      ).resolves.toBe(false);

      await permissions.set(
        clinic.id,
        USER_ROLE.RECEPTIONIST,
        financial?.capability ?? "",
        true,
        clinic.userIds[USER_ROLE.ADMIN],
      );
    });
  });

  describe("who is asking", () => {
    let doctorId: string;

    beforeAll(async () => {
      const [doctor] = await context.db
        .insert(doctors)
        .values({
          clinicId: clinic.id,
          userId: clinic.userIds[USER_ROLE.DOCTOR],
          specialtyId: clinic.specialtyId,
        })
        .returning({ id: doctors.id });

      doctorId = doctor?.id ?? "";
    });

    const actor = (role: UserRole) => ({ id: clinic.userIds[role], clinicId: clinic.id, role });

    it("links a doctor's account to their doctor row", async () => {
      const resolved = await context.app.get(AgentService).context(actor(USER_ROLE.DOCTOR));

      expect(resolved.doctor?.id).toBe(doctorId);
    });

    it("has no doctor for an admin who is not one", async () => {
      const resolved = await context.app.get(AgentService).context(actor(USER_ROLE.ADMIN));

      expect(resolved.doctor).toBeNull();
    });

    it("answers not_found for a doctor_id from another clinic, rather than an empty day", async () => {
      const other = await context.createClinic();
      const [foreign] = await context.db
        .insert(doctors)
        .values({
          clinicId: other.id,
          userId: other.userIds[USER_ROLE.DOCTOR],
          specialtyId: other.specialtyId,
        })
        .returning({ id: doctors.id });

      const admin = actor(USER_ROLE.ADMIN);
      const conversation = await context.app.get(AiConversationsService).start(admin, "مواعيد");
      const run = (id: string) =>
        context.app.get(ToolRunnerService).run(admin, conversation.id, {
          id: "call_1",
          name: AI_TOOL.GET_APPOINTMENTS,
          arguments: JSON.stringify({
            date_from: "2026-09-22",
            date_to: "2026-09-22",
            doctor_id: id,
          }),
        });

      expect(JSON.parse((await run(foreign?.id ?? "")).content)).toMatchObject({
        error: "not_found",
      });
      const own = await run(doctorId);

      expect(JSON.parse(own.content)).toMatchObject({ result: { items: [], truncated: false } });
      expect(aiViewSchema.parse(own.view)).toMatchObject({
        type: "table",
        rows: [],
        href: `/appointments?view=day&date=2026-09-22&doctor=${doctorId}`,
      });
    });
  });

  describe("a conversation", () => {
    it("streams an answer, records it, and lists it afterwards", async () => {
      const response = await context.app.inject({
        method: "POST",
        url: "/ai/chat",
        headers: auth(tokens[USER_ROLE.DOCTOR]),
        payload: { message: "كم موعد اليوم؟" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/event-stream");

      const frames = events(response.body);
      const opened = frames[0];

      expect(opened?.type).toBe(AI_STREAM_EVENT.CONVERSATION);
      expect(frames.at(-1)?.type).toBe(AI_STREAM_EVENT.DONE);

      const conversationId =
        opened?.type === AI_STREAM_EVENT.CONVERSATION ? opened.conversationId : "";

      const listed = await context.app.inject({
        method: "GET",
        url: "/ai/conversations",
        headers: auth(tokens[USER_ROLE.DOCTOR]),
      });

      expect(listed.json()).toMatchObject({
        items: [expect.objectContaining({ id: conversationId, title: "كم موعد اليوم؟" })],
      });

      const messages = await context.app.inject({
        method: "GET",
        url: `/ai/conversations/${conversationId}`,
        headers: auth(tokens[USER_ROLE.DOCTOR]),
      });

      expect(messages.json()).toMatchObject([
        { role: "user", content: "كم موعد اليوم؟" },
        { role: "tool", toolName: "get_appointments" },
        { role: "assistant" },
      ]);
    });

    it("serves a tool row's view, and never its envelope", async () => {
      const doctor = {
        id: clinic.userIds[USER_ROLE.DOCTOR],
        clinicId: clinic.id,
        role: USER_ROLE.DOCTOR,
      };
      const conversations = context.app.get(AiConversationsService);
      const conversation = await conversations.start(doctor, "إحصائيات");
      const view = {
        type: "stats" as const,
        tiles: [{ label: "assistant.view.stats.total", value: "3", kind: "number" as const }],
      };

      await conversations.append(doctor, conversation.id, {
        role: AI_MESSAGE_ROLE.TOOL,
        content: '{"tool":"get_daily_stats","result":{"total":3}}',
        toolName: AI_TOOL.GET_DAILY_STATS,
        view,
      });

      await expect(conversations.messages(doctor, conversation.id)).resolves.toEqual([
        expect.objectContaining({
          role: AI_MESSAGE_ROLE.TOOL,
          content: "",
          toolName: AI_TOOL.GET_DAILY_STATS,
          view,
        }),
      ]);
    });

    it("is the caller's own: another user in the clinic gets a 404, not a 403", async () => {
      const mine = await context.app.inject({
        method: "POST",
        url: "/ai/chat",
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
        payload: { message: "مواعيد بكرا" },
      });

      const opened = events(mine.body)[0];
      const conversationId =
        opened?.type === AI_STREAM_EVENT.CONVERSATION ? opened.conversationId : "";

      for (const role of [USER_ROLE.ADMIN, USER_ROLE.DOCTOR] as const) {
        const response = await context.app.inject({
          method: "GET",
          url: `/ai/conversations/${conversationId}`,
          headers: auth(tokens[role]),
        });

        expect(response.statusCode).toBe(404);
      }
    });

    it("cannot be continued from another clinic", async () => {
      const other = await context.createClinic();
      const stranger = await context.login(other.phones[USER_ROLE.ADMIN]);

      const mine = await context.app.inject({
        method: "POST",
        url: "/ai/chat",
        headers: auth(tokens[USER_ROLE.DOCTOR]),
        payload: { message: "الوضع المالي" },
      });

      const opened = events(mine.body)[0];
      const conversationId =
        opened?.type === AI_STREAM_EVENT.CONVERSATION ? opened.conversationId : "";

      const response = await context.app.inject({
        method: "GET",
        url: `/ai/conversations/${conversationId}`,
        headers: auth(stranger),
      });

      expect(response.statusCode).toBe(404);
    });

    it("refuses an unsigned caller", async () => {
      const response = await context.app.inject({
        method: "POST",
        url: "/ai/chat",
        payload: { message: "مرحبا" },
      });

      expect(response.statusCode).toBe(401);
    });

    it("refuses a question longer than the limit", async () => {
      const response = await context.app.inject({
        method: "POST",
        url: "/ai/chat",
        headers: auth(tokens[USER_ROLE.DOCTOR]),
        payload: { message: "ا".repeat(2_001) },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
