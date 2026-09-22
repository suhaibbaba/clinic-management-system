import {
  addDays,
  AI_AUTOMATION_MODE,
  AI_AUTOMATION_RUN_STATUS,
  AI_OUTBOUND_ERROR,
  AI_OUTBOUND_TARGET,
  AI_OUTBOUND_TRIGGER,
  AI_PROPOSAL_STATUS,
  APPOINTMENT_STATUS,
  DEFAULT_TIME_ZONE,
  instantFromLocal,
  LAB_ORDER_STATUS,
  localDate,
  USER_ROLE,
  type UserRole,
} from "@clinic/shared";
import { and, eq } from "drizzle-orm";
import { AutomationService } from "@api/ai/outbound/automation.service";
import { OutboundRecipientsService } from "@api/ai/outbound/outbound-recipients.service";
import {
  aiAuditLog,
  aiAutomationRuns,
  aiProposals,
  appointments,
  charges,
  labOrders,
  labs,
  payments,
} from "@api/database/schema";
import { PermissionsService } from "@api/permissions/permissions.service";
import { createPatient, seedClinicFixtures, uniquePhone } from "@test/helpers/patient-fixtures";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

const DAY_MS = 86_400_000;
const daysAgo = (days: number): Date => new Date(Date.now() - days * DAY_MS);

describe("Daily outbound automation (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let automation: AutomationService;
  let recipients: OutboundRecipientsService;
  const tokens = {} as Record<UserRole, string>;
  const patient = {} as Record<
    "lateLab" | "recentLab" | "oldDebt" | "settled" | "newDebt" | "tomorrow" | "cancelled",
    string
  >;

  const today = (): string => localDate(new Date(), DEFAULT_TIME_ZONE);

  const settings = (body: Record<string, unknown>) =>
    context.app.inject({
      method: "PUT",
      url: "/ai/automation/settings",
      headers: auth(tokens[USER_ROLE.ADMIN]),
      payload: body,
    });

  const proposalsOf = (clinicId: string) =>
    context.db.select().from(aiProposals).where(eq(aiProposals.clinicId, clinicId));

  beforeAll(async () => {
    context = await createTestContext();
    automation = context.app.get(AutomationService);
    recipients = context.app.get(OutboundRecipientsService);
    clinic = await context.createClinic();

    for (const role of [USER_ROLE.ADMIN, USER_ROLE.RECEPTIONIST] as const) {
      tokens[role] = await context.login(clinic.phones[role]);
    }

    const { doctorId } = await seedClinicFixtures(context, clinic, tokens[USER_ROLE.ADMIN]);

    for (const key of Object.keys({
      lateLab: 0,
      recentLab: 0,
      oldDebt: 0,
      settled: 0,
      newDebt: 0,
      tomorrow: 0,
      cancelled: 0,
    }) as (keyof typeof patient)[]) {
      patient[key] = await createPatient(context, tokens[USER_ROLE.ADMIN], {
        fullName: key,
        phone: uniquePhone(),
      });
    }

    const [lab] = await context.db
      .insert(labs)
      .values({ clinicId: clinic.id, name: "مختبر" })
      .returning({ id: labs.id });

    const order = (patientId: string, expectedAt: Date) => ({
      clinicId: clinic.id,
      labId: lab?.id ?? "",
      patientId,
      doctorId,
      status: LAB_ORDER_STATUS.SENT,
      expectedAt,
    });

    await context.db
      .insert(labOrders)
      .values([order(patient.lateLab, daysAgo(10)), order(patient.recentLab, daysAgo(3))]);

    const charge = (patientId: string, createdAt: Date) => ({
      clinicId: clinic.id,
      patientId,
      amount: "100.00",
      createdAt,
    });

    await context.db
      .insert(charges)
      .values([
        charge(patient.oldDebt, daysAgo(40)),
        charge(patient.settled, daysAgo(40)),
        charge(patient.newDebt, daysAgo(2)),
      ]);
    await context.db.insert(payments).values({
      clinicId: clinic.id,
      patientId: patient.settled,
      amount: "100.00",
      method: "cash",
      createdAt: daysAgo(35),
    });

    const tomorrowAt = instantFromLocal(addDays(today(), 1), 10 * 60, DEFAULT_TIME_ZONE);

    await context.db.insert(appointments).values([
      { clinicId: clinic.id, patientId: patient.tomorrow, doctorId, startsAt: tomorrowAt },
      {
        clinicId: clinic.id,
        patientId: patient.cancelled,
        doctorId,
        startsAt: new Date(tomorrowAt.getTime() + 3_600_000),
        status: APPOINTMENT_STATUS.CANCELLED,
        cancelledReason: "test",
      },
    ]);
  });

  afterAll(async () => {
    await context.close();
  });

  describe("detection", () => {
    it("finds lab work overdue by at least the threshold", async () => {
      const found = await recipients.overdueLabs(clinic.id, 7, 50);

      expect(found.map((candidate) => candidate.patientId)).toEqual([patient.lateLab]);
      expect(found[0]?.vars["days"]).toBe("10");
    });

    it("finds money charged at least the threshold ago and still unpaid", async () => {
      const found = await recipients.unpaid(clinic.id, 30, 50, "JOD");

      expect(found.map((candidate) => candidate.patientId)).toEqual([patient.oldDebt]);
      expect(found[0]?.vars["balance"]).toBe("100 د.ا");
    });

    it("finds tomorrow's confirmed appointments only", async () => {
      const found = await recipients.tomorrow(clinic.id, DEFAULT_TIME_ZONE, 50);

      expect(found.map((candidate) => candidate.patientId)).toEqual([patient.tomorrow]);
      expect(found[0]?.vars["time"]).toBe("10:00");
    });
  });

  describe("a run", () => {
    it("proposes by default, sending nothing", async () => {
      const outcomes = await automation.runClinic(clinic.id, today());

      expect(outcomes).toEqual({
        overdue_labs: "done",
        unpaid_invoices: "done",
        tomorrow_appointments: "done",
      });

      const drafted = await proposalsOf(clinic.id);

      expect(drafted).toHaveLength(3);
      expect(
        drafted.every(
          (row) =>
            row.status === AI_PROPOSAL_STATUS.DRAFT &&
            row.trigger === AI_OUTBOUND_TRIGGER.CRON &&
            row.userId === null,
        ),
      ).toBe(true);

      const sent = await context.db
        .select()
        .from(aiAuditLog)
        .where(eq(aiAuditLog.clinicId, clinic.id));

      expect(sent).toHaveLength(0);
    });

    it("runs once per clinic, rule and day, however often it is called", async () => {
      const outcomes = await automation.runClinic(clinic.id, today());

      expect(Object.values(outcomes)).toEqual(["skipped", "skipped", "skipped"]);
      await expect(proposalsOf(clinic.id)).resolves.toHaveLength(3);
    });

    it("lets whoever holds the send permission send what the automation proposed", async () => {
      const [proposal] = (await proposalsOf(clinic.id)).filter(
        (row) => row.target === AI_OUTBOUND_TARGET.TOMORROW_APPOINTMENTS,
      );

      const response = await context.app.inject({
        method: "POST",
        url: `/ai/proposals/${proposal?.id}/send`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ status: AI_PROPOSAL_STATUS.SENT, sentCount: 1 });
    });

    // The unpaid-balances proposal quotes every debt: a role kept off the billing list is kept
    // off it here too, and nobody reads an overdue-labs proposal without the labs list.
    it("shows an automation proposal only to roles that may read its list", async () => {
      const drafted = await proposalsOf(clinic.id);
      const unpaid = drafted.find((row) => row.target === AI_OUTBOUND_TARGET.UNPAID_INVOICES);
      const labs = drafted.find((row) => row.target === AI_OUTBOUND_TARGET.OVERDUE_LABS);
      const read = (id: string | undefined) =>
        context.app.inject({
          method: "GET",
          url: `/ai/proposals/${id}`,
          headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
        });

      expect((await read(unpaid?.id)).statusCode).toBe(200);
      expect((await read(labs?.id)).statusCode).toBe(404);

      const permissions = context.app.get(PermissionsService);
      const admin = clinic.userIds[USER_ROLE.ADMIN];

      await permissions.set(clinic.id, USER_ROLE.RECEPTIONIST, "billing.list", false, admin);

      try {
        expect((await read(unpaid?.id)).statusCode).toBe(404);
      } finally {
        await permissions.set(clinic.id, USER_ROLE.RECEPTIONIST, "billing.list", true, admin);
      }
    });

    it("sends by itself only for a rule set to auto-send, and still only once", async () => {
      await settings({ rules: { overdue_labs: { mode: AI_AUTOMATION_MODE.AUTO_SEND } } });

      const day = addDays(today(), 1);

      await expect(automation.runRule(clinic.id, "overdue_labs", day)).resolves.toBe("done");
      await expect(automation.runRule(clinic.id, "overdue_labs", day)).resolves.toBe("skipped");

      const sent = await context.db
        .select()
        .from(aiAuditLog)
        .where(
          and(eq(aiAuditLog.clinicId, clinic.id), eq(aiAuditLog.trigger, AI_OUTBOUND_TRIGGER.CRON)),
        );

      const late = sent.filter((row) => row.patientId === patient.lateLab);

      expect(late).toHaveLength(1);
      expect(late[0]?.userId).toBeNull();
    });

    it("does nothing, and records nothing, for a rule that is off", async () => {
      await settings({ rules: { unpaid_invoices: { mode: AI_AUTOMATION_MODE.OFF } } });

      const day = addDays(today(), 2);

      await expect(automation.runRule(clinic.id, "unpaid_invoices", day)).resolves.toBe("off");

      const runs = await context.db
        .select()
        .from(aiAutomationRuns)
        .where(and(eq(aiAutomationRuns.clinicId, clinic.id), eq(aiAutomationRuns.runDate, day)));

      expect(runs).toHaveLength(0);
    });

    // A rule over its cap fails with the code and sends nobody; the rules beside it still run.
    it("fails one rule over its cap without stopping the others", async () => {
      await settings({
        rules: {
          overdue_labs: { mode: AI_AUTOMATION_MODE.PROPOSE },
          tomorrow_appointments: { mode: AI_AUTOMATION_MODE.PROPOSE, cap: 1 },
          unpaid_invoices: { mode: AI_AUTOMATION_MODE.PROPOSE, days: 1, cap: 1 },
        },
      });

      const day = addDays(today(), 3);
      const outcomes = await automation.runClinic(clinic.id, day);

      expect(outcomes).toEqual({
        overdue_labs: "done",
        unpaid_invoices: "failed",
        tomorrow_appointments: "done",
      });

      const [failed] = await context.db
        .select()
        .from(aiAutomationRuns)
        .where(
          and(
            eq(aiAutomationRuns.clinicId, clinic.id),
            eq(aiAutomationRuns.runDate, day),
            eq(aiAutomationRuns.rule, "unpaid_invoices"),
          ),
        );

      expect(failed).toMatchObject({
        status: AI_AUTOMATION_RUN_STATUS.FAILED,
        error: AI_OUTBOUND_ERROR.RECIPIENT_CAP,
      });
    });
  });
});
