import {
  AI_PROPOSAL_STATUS,
  AI_TOOL,
  AI_TOOL_ERROR,
  AUDIT_ACTION,
  ITEM_CATEGORY,
  ITEM_UNIT,
  LAB_ORDER_STATUS,
  MOVEMENT_TYPE,
  USER_ROLE,
  type UserRole,
} from "@clinic/shared";
import { and, eq } from "drizzle-orm";
import { AiConversationsService } from "@api/ai/ai-conversations.service";
import { ToolRunnerService } from "@api/ai/tools/tool-runner.service";
import { aiProposals, auditLog, labOrders } from "@api/database/schema";
import { createPatient, seedClinicFixtures } from "@test/helpers/patient-fixtures";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

interface ToolResult {
  error?: string;
  result?: Record<string, unknown> & {
    status?: string;
    proposal_id?: string;
    items?: { id: string; quantity?: string }[];
  };
}

describe("Assistant lab and stock actions (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let patientId: string;
  let labOrderId: string;
  let itemId: string;
  const tokens = {} as Record<UserRole, string>;

  const actor = (role: UserRole) => ({ id: clinic.userIds[role], clinicId: clinic.id, role });

  async function tool(role: UserRole, name: string, args: unknown): Promise<ToolResult> {
    const conversation = await context.app.get(AiConversationsService).start(actor(role), "مختبر");
    const run = await context.app.get(ToolRunnerService).run(actor(role), conversation.id, {
      id: "call_1",
      name,
      arguments: JSON.stringify(args),
    });

    return JSON.parse(run.content) as ToolResult;
  }

  const confirm = (id: string, role: UserRole) =>
    context.app.inject({
      method: "POST",
      url: `/ai/proposals/${id}/confirm`,
      headers: auth(tokens[role]),
      payload: {},
    });

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();

    for (const role of [
      USER_ROLE.ADMIN,
      USER_ROLE.DOCTOR,
      USER_ROLE.TECHNICIAN,
      USER_ROLE.RECEPTIONIST,
    ] as const) {
      tokens[role] = await context.login(clinic.phones[role]);
    }

    const { doctorId } = await seedClinicFixtures(context, clinic, tokens[USER_ROLE.ADMIN]);

    patientId = await createPatient(context, tokens[USER_ROLE.RECEPTIONIST], {
      fullName: "ليلى ناصر",
      phone: "0599000333",
    });

    const lab = await context.app.inject({
      method: "POST",
      url: "/labs",
      headers: auth(tokens[USER_ROLE.TECHNICIAN]),
      payload: { name: "مخبر النور", phone: "+963110000001", contactPerson: "أبو سامر" },
    });
    const labId = (lab.json() as { id: string }).id;
    const workType = await context.app.inject({
      method: "POST",
      url: `/labs/${labId}/work-types`,
      headers: auth(tokens[USER_ROLE.TECHNICIAN]),
      payload: { nameAr: "تاج زيركون", defaultPrice: "45.00" },
    });
    const order = await context.app.inject({
      method: "POST",
      url: "/lab-orders",
      headers: auth(tokens[USER_ROLE.DOCTOR]),
      payload: {
        labId,
        patientId,
        doctorId,
        workTypeId: (workType.json() as { id: string }).id,
        teeth: [26],
      },
    });

    expect(order.statusCode).toBe(201);
    labOrderId = (order.json() as { id: string }).id;

    const item = await context.app.inject({
      method: "POST",
      url: "/inventory/items",
      headers: auth(tokens[USER_ROLE.TECHNICIAN]),
      payload: {
        nameAr: "قفازات طبية",
        category: ITEM_CATEGORY.CONSUMABLE,
        unit: ITEM_UNIT.PIECE,
        minQuantity: "5",
      },
    });

    expect(item.statusCode).toBe(201);
    itemId = (item.json() as { id: string }).id;
  });

  afterAll(async () => {
    await context.close();
  });

  describe("lab orders", () => {
    it("finds the patient's order and sends it behind a card, with the domain's audit entry", async () => {
      const found = await tool(USER_ROLE.TECHNICIAN, "lab_orders_list", {
        patientId,
      });

      expect(found.result?.items?.map((item) => item.id)).toEqual([labOrderId]);

      const { result } = await tool(USER_ROLE.DOCTOR, AI_TOOL.SET_LAB_ORDER_STATUS, {
        lab_order_id: labOrderId,
        status: LAB_ORDER_STATUS.SENT,
      });

      expect(result).toMatchObject({ status: "awaiting_user_confirmation", tier: "confirm" });
      expect((await confirm(result?.proposal_id ?? "", USER_ROLE.DOCTOR)).statusCode).toBe(200);

      const [row] = await context.db
        .select({ status: labOrders.status })
        .from(labOrders)
        .where(eq(labOrders.id, labOrderId));

      expect(row?.status).toBe(LAB_ORDER_STATUS.SENT);

      const [entry] = await context.db
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.entityId, labOrderId), eq(auditLog.action, AUDIT_ACTION.UPDATE)));

      expect(entry?.oldValue).toMatchObject({ status: LAB_ORDER_STATUS.DRAFT });
      expect(entry?.newValue).toMatchObject({ status: LAB_ORDER_STATUS.SENT });
    });

    it("says a step the state machine refuses is not possible", async () => {
      const { result } = await tool(USER_ROLE.DOCTOR, AI_TOOL.SET_LAB_ORDER_STATUS, {
        lab_order_id: labOrderId,
        status: LAB_ORDER_STATUS.FITTED,
      });

      expect(result).toMatchObject({ status: "not_possible", current_status: "sent" });
    });

    it("refuses a doctor the step only the technician may take", async () => {
      const { error } = await tool(USER_ROLE.DOCTOR, AI_TOOL.SET_LAB_ORDER_STATUS, {
        lab_order_id: labOrderId,
        status: LAB_ORDER_STATUS.READY,
      });

      expect(error).toBe(AI_TOOL_ERROR.NOT_PERMITTED);
    });

    it("asks a return for its reason", async () => {
      const { error } = await tool(USER_ROLE.DOCTOR, AI_TOOL.SET_LAB_ORDER_STATUS, {
        lab_order_id: labOrderId,
        status: LAB_ORDER_STATUS.RETURNED,
      });

      expect(error).toBe(AI_TOOL_ERROR.INVALID_ARGUMENTS);
    });

    it("is not permitted to a receptionist", async () => {
      const { error } = await tool(USER_ROLE.RECEPTIONIST, "lab_orders_list", {});

      expect(error).toBe(AI_TOOL_ERROR.NOT_PERMITTED);
    });
  });

  describe("stock", () => {
    it("records a purchase, and the quantity on hand is the sum", async () => {
      const { result } = await tool(USER_ROLE.TECHNICIAN, AI_TOOL.RECORD_STOCK_MOVEMENT, {
        item_id: itemId,
        type: MOVEMENT_TYPE.PURCHASE,
        quantity: "10",
        unit_price: "2",
      });

      const id = result?.proposal_id ?? "";

      expect(result).toMatchObject({ status: "awaiting_user_confirmation" });
      expect((await confirm(id, USER_ROLE.TECHNICIAN)).statusCode).toBe(200);

      const [proposal] = await context.db.select().from(aiProposals).where(eq(aiProposals.id, id));

      expect(proposal?.status).toBe(AI_PROPOSAL_STATUS.DONE);

      const found = await tool(USER_ROLE.TECHNICIAN, "inventory_list", {
        search: "قفازات",
      });

      const [item] = found.result?.items ?? [];

      expect(item?.id).toBe(itemId);
      expect(Number(item?.quantity)).toBe(10);
    });

    it("refuses an adjustment without its reason, before any card", async () => {
      const { result } = await tool(USER_ROLE.TECHNICIAN, AI_TOOL.RECORD_STOCK_MOVEMENT, {
        item_id: itemId,
        type: MOVEMENT_TYPE.ADJUST,
        quantity: "-2",
      });

      expect(result?.status).toBe("invalid_arguments");
      expect(result?.proposal_id).toBeUndefined();
    });

    it("refuses a doctor a purchase, which the technician records", async () => {
      const { error } = await tool(USER_ROLE.DOCTOR, AI_TOOL.RECORD_STOCK_MOVEMENT, {
        item_id: itemId,
        type: MOVEMENT_TYPE.PURCHASE,
        quantity: "1",
      });

      expect(error).toBe(AI_TOOL_ERROR.NOT_PERMITTED);
    });
  });
});
