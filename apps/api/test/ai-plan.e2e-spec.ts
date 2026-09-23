import {
  AI_ACTION_ERROR,
  AI_MESSAGE_ROLE,
  AI_PROPOSAL_STATUS,
  AI_TOOL,
  USER_ROLE,
  type UserRole,
} from "@clinic/shared";
import { and, count, eq, isNull } from "drizzle-orm";
import { AiConversationsService } from "@api/ai/ai-conversations.service";
import { ToolRunnerService } from "@api/ai/tools/tool-runner.service";
import {
  aiProposals,
  appointments,
  clinics,
  doctorExtraHours,
  doctorTimeOff,
  notificationsLog,
} from "@api/database/schema";
import { createPatient, seedClinicFixtures, uniquePhone } from "@test/helpers/patient-fixtures";
import {
  auth,
  createTestContext,
  TEST_PASSWORD,
  type TestClinic,
  type TestContext,
} from "@test/helpers/test-app";

/** A Thursday far enough out to stay bookable: Basel works Thursdays, Rasha does not. */
function thursday(weeksAhead: number): string {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + ((11 - day.getUTCDay()) % 7 || 7) + weeksAhead * 7);

  return day.toISOString().slice(0, 10);
}

interface ToolResult {
  error?: string;
  result?: Record<string, unknown> & {
    status?: string;
    step?: number;
    proposal_id?: string;
    free_after_earlier_steps?: string[];
  };
}

describe("Assistant plans (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let basel: string;
  let rasha: string;
  let patients: string[];
  const tokens = {} as Record<UserRole, string>;

  const actor = () => ({
    id: clinic.userIds[USER_ROLE.ADMIN],
    clinicId: clinic.id,
    role: USER_ROLE.ADMIN,
  });

  async function tool(name: string, args: unknown): Promise<ToolResult> {
    const { id } = await context.app.get(AiConversationsService).start(actor(), "رشا بتغطي باسل");
    const run = await context.app.get(ToolRunnerService).run(actor(), id, {
      id: "call_1",
      name,
      arguments: JSON.stringify(args),
    });

    return JSON.parse(run.content) as ToolResult;
  }

  async function book(doctorId: string, patientId: string, day: string, time: string) {
    const response = await context.app.inject({
      method: "POST",
      url: "/appointments",
      headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      payload: {
        patientId,
        doctorId,
        startsAt: new Date(`${day}T${time}:00+03:00`).toISOString(),
        durationMinutes: 30,
      },
    });

    expect(response.statusCode).toBe(201);

    return (response.json() as { id: string }).id;
  }

  const confirm = (id: string, inputs?: Record<string, Record<string, string>>, path = "confirm") =>
    context.app.inject({
      method: "POST",
      url: `/ai/proposals/${id}/${path}`,
      headers: auth(tokens[USER_ROLE.ADMIN]),
      payload: inputs ? { inputs } : {},
    });

  const steps = async (id: string) => {
    const [row] = await context.db
      .select({ status: aiProposals.status, summary: aiProposals.resolvedSummary })
      .from(aiProposals)
      .where(eq(aiProposals.id, id));

    return {
      status: row?.status,
      steps: (
        (row?.summary as { steps?: { status?: string; error?: string }[] } | null)?.steps ?? []
      ).map((step) => step.error ?? step.status),
    };
  };

  const doctorOf = async (appointmentId: string) => {
    const [row] = await context.db
      .select({ doctorId: appointments.doctorId, startsAt: appointments.startsAt })
      .from(appointments)
      .where(eq(appointments.id, appointmentId));

    return row;
  };

  const rows = async (table: typeof doctorExtraHours | typeof doctorTimeOff, doctorId: string) => {
    const [row] = await context.db
      .select({ value: count() })
      .from(table)
      .where(and(eq(table.doctorId, doctorId), isNull(table.deletedAt)));

    return row?.value ?? 0;
  };

  /** Rasha works Basel's hours on `day`, both his patients move to her, and he is off. */
  const cover = (day: string, moves: { id: string; time: string | null }[]) => ({
    title: "رشا بتغطي باسل",
    steps: [
      {
        tool: AI_TOOL.ADD_DOCTOR_EXTRA_HOURS,
        args: {
          doctor_id: rasha,
          date: day,
          ranges: [{ start: "09:00", end: "17:00" }],
          reason: "تغطية",
        },
      },
      ...moves.map((move) => ({
        tool: AI_TOOL.RESCHEDULE_APPOINTMENT,
        args: { appointment_id: move.id, doctor_id: rasha, date: day, time: move.time },
      })),
      {
        tool: AI_TOOL.ADD_DOCTOR_TIME_OFF,
        args: { doctor_id: basel, date_from: day, date_to: day, reason: "إجازة" },
      },
    ],
  });

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();

    for (const role of [USER_ROLE.ADMIN, USER_ROLE.RECEPTIONIST] as const) {
      tokens[role] = await context.login(clinic.phones[role]);
    }

    await context.db
      .update(clinics)
      .set({
        workingHours: [0, 1, 2, 3, 4].map((weekday) => ({
          weekday,
          ranges: [{ start: "08:00", end: "18:00" }],
        })),
        settings: { timezone: "Asia/Hebron" },
      })
      .where(eq(clinics.id, clinic.id));

    ({ doctorId: basel } = await seedClinicFixtures(context, clinic, tokens[USER_ROLE.ADMIN]));
    await context.app.inject({
      method: "PATCH",
      url: `/doctors/${basel}/schedule`,
      headers: auth(tokens[USER_ROLE.ADMIN]),
      payload: { weeklySchedule: [{ weekday: 4, ranges: [{ start: "09:00", end: "17:00" }] }] },
    });

    const created = await context.app.inject({
      method: "POST",
      url: "/doctors",
      headers: auth(tokens[USER_ROLE.ADMIN]),
      payload: {
        specialtyId: clinic.specialtyId,
        newUser: {
          name: { ar: "د. رشا أبو عبيد", en: "Dr. Rasha" },
          phone: uniquePhone(),
          password: TEST_PASSWORD,
        },
        weeklySchedule: [{ weekday: 0, ranges: [{ start: "09:00", end: "17:00" }] }],
        defaultAppointmentDurationMinutes: 30,
      },
    });

    expect(created.statusCode).toBe(201);
    rasha = (created.json() as { id: string }).id;

    patients = [
      await createPatient(context, tokens[USER_ROLE.RECEPTIONIST], {
        fullName: "إسراء طوقان",
        phone: uniquePhone(),
      }),
      await createPatient(context, tokens[USER_ROLE.RECEPTIONIST], {
        fullName: "أحمد النابلسي",
        phone: uniquePhone(),
      }),
    ];
  });

  afterAll(async () => {
    await context.close();
  });

  it("rehearses a covering day end to end, keeps nothing, then runs it whole on the card", async () => {
    const day = thursday(2);
    const first = await book(basel, patients[0] ?? "", day, "10:00");
    const second = await book(basel, patients[1] ?? "", day, "10:30");
    const [sentBefore] = await context.db.select({ value: count() }).from(notificationsLog);

    const { result } = await tool(
      AI_TOOL.PROPOSE_PLAN,
      cover(day, [
        { id: first, time: "10:00" },
        { id: second, time: "10:30" },
      ]),
    );

    expect(result).toMatchObject({ status: "awaiting_user_confirmation", tier: "confirm" });

    // The rehearsal kept nothing and told nobody.
    expect(await rows(doctorExtraHours, rasha)).toBe(0);
    expect(await rows(doctorTimeOff, basel)).toBe(0);
    expect((await doctorOf(first))?.doctorId).toBe(basel);
    const [sentAfter] = await context.db.select({ value: count() }).from(notificationsLog);
    expect(sentAfter?.value).toBe(sentBefore?.value);

    const [proposal] = await context.db
      .select({ summary: aiProposals.resolvedSummary })
      .from(aiProposals)
      .where(eq(aiProposals.id, result?.proposal_id ?? ""));

    expect((proposal?.summary as { steps: unknown[] }).steps).toHaveLength(4);

    expect((await confirm(result?.proposal_id ?? "")).statusCode).toBe(200);

    expect(await rows(doctorExtraHours, rasha)).toBe(1);
    expect(await rows(doctorTimeOff, basel)).toBe(1);
    expect((await doctorOf(first))?.doctorId).toBe(rasha);
    expect((await doctorOf(second))?.doctorId).toBe(rasha);
    expect((await doctorOf(second))?.startsAt.toISOString()).toBe(
      new Date(`${day}T10:30:00+03:00`).toISOString(),
    );
  });

  it("names the step that cannot happen and the free times after the steps before it", async () => {
    const day = thursday(3);
    const first = await book(basel, patients[0] ?? "", day, "11:00");
    const second = await book(basel, patients[1] ?? "", day, "11:15");

    // Both at 11:00 on Rasha: the second collides with the first, which the rehearsal has moved.
    const { result } = await tool(
      AI_TOOL.PROPOSE_PLAN,
      cover(day, [
        { id: first, time: "11:00" },
        { id: second, time: "11:00" },
      ]),
    );

    expect(result).toMatchObject({ status: "slot_taken", step: 2 });
    expect(result?.free_after_earlier_steps).toContain("11:30");
    expect(result?.free_after_earlier_steps).not.toContain("11:00");
    expect(await rows(doctorExtraHours, rasha)).toBe(1);
  });

  it("keeps the steps that ran when a later one fails, and continues once it can", async () => {
    const day = thursday(4);
    const first = await book(basel, patients[0] ?? "", day, "12:00");

    const { result } = await tool(AI_TOOL.PROPOSE_PLAN, cover(day, [{ id: first, time: "12:00" }]));
    const id = result?.proposal_id ?? "";

    // Somebody books Basel after the card was drafted: the time off would now collide.
    const late = await book(basel, patients[1] ?? "", day, "15:00");

    await confirm(id);

    expect(await steps(id)).toEqual({
      status: AI_PROPOSAL_STATUS.FAILED,
      steps: ["done", "done", AI_ACTION_ERROR.SCHEDULE_CONFLICT],
    });
    expect((await doctorOf(first))?.doctorId).toBe(rasha);
    expect(await rows(doctorTimeOff, basel)).toBe(0);

    // The late patient moves too; continuing checks the time off again and runs it.
    await context.db.update(appointments).set({ doctorId: rasha }).where(eq(appointments.id, late));

    expect((await confirm(id, undefined, "continue")).statusCode).toBe(200);
    expect(await steps(id)).toEqual({
      status: AI_PROPOSAL_STATUS.DONE,
      steps: ["done", "done", "done"],
    });
    expect(await rows(doctorTimeOff, basel)).toBe(1);
  });

  it("asks the person for a time the model left open, and will not run without it", async () => {
    const day = thursday(5);
    const first = await book(basel, patients[0] ?? "", day, "09:00");

    const { result } = await tool(AI_TOOL.PROPOSE_PLAN, cover(day, [{ id: first, time: null }]));
    const id = result?.proposal_id ?? "";

    expect((await confirm(id)).statusCode).toBe(422);
    expect(await rows(doctorExtraHours, rasha)).toBe(0);

    expect((await confirm(id, { "1": { time: "11:30" } })).statusCode).toBe(200);
    expect((await doctorOf(first))?.startsAt.toISOString()).toBe(
      new Date(`${day}T11:30:00+03:00`).toISOString(),
    );
  });

  it("takes the strictest tier of its steps", async () => {
    const day = thursday(6);
    const first = await book(basel, patients[0] ?? "", day, "10:00");

    const { result } = await tool(AI_TOOL.PROPOSE_PLAN, {
      title: "إجازة وإلغاء",
      steps: [
        {
          tool: AI_TOOL.ADD_DOCTOR_TIME_OFF,
          args: {
            doctor_id: basel,
            date_from: day,
            date_to: day,
            reason: "إجازة",
            on_conflict: "cancel_appointments",
          },
        },
      ],
    });

    expect(result).toMatchObject({ status: "awaiting_user_confirmation", tier: "typed" });
    expect((await doctorOf(first))?.doctorId).toBe(basel);
  });

  it("refuses a read inside a plan, and a reference to a later step", async () => {
    const read = await tool(AI_TOOL.PROPOSE_PLAN, {
      title: "قراءة",
      steps: [{ tool: "lab_orders_list", args: {} }],
    });
    const dangling = await tool(AI_TOOL.PROPOSE_PLAN, {
      title: "مرجع",
      steps: [
        { tool: AI_TOOL.DELETE_DOCTOR_TIME_OFF, args: { time_off_id: { $ref: "steps[1].id" } } },
        {
          tool: AI_TOOL.ADD_DOCTOR_TIME_OFF,
          args: { doctor_id: basel, date_from: thursday(9), date_to: thursday(9), reason: "إجازة" },
        },
      ],
    });

    expect(read.result).toMatchObject({ status: "read_tool_in_plan", step: 0 });
    expect(dangling.result).toMatchObject({ status: "dangling_ref", step: 0 });
  });

  it("resolves a step's reference to the row an earlier step created", async () => {
    const day = thursday(8);
    const { result } = await tool(AI_TOOL.PROPOSE_PLAN, {
      title: "إجازة ثم تراجع",
      steps: [
        {
          tool: AI_TOOL.ADD_DOCTOR_TIME_OFF,
          args: { doctor_id: basel, date_from: day, date_to: day, reason: "إجازة" },
        },
        { tool: AI_TOOL.DELETE_DOCTOR_TIME_OFF, args: { time_off_id: { $ref: "steps[0].id" } } },
      ],
    });
    const before = await rows(doctorTimeOff, basel);

    expect((await confirm(result?.proposal_id ?? "")).statusCode).toBe(200);
    expect(await steps(result?.proposal_id ?? "")).toMatchObject({ steps: ["done", "done"] });
    expect(await rows(doctorTimeOff, basel)).toBe(before);
  });

  it("remembers earlier tool results, and what became of their cards", async () => {
    const conversations = context.app.get(AiConversationsService);
    const conversation = await conversations.start(actor(), "من هو باسل؟");

    await conversations.append(actor(), conversation.id, {
      role: AI_MESSAGE_ROLE.USER,
      content: "من هو باسل؟",
    });
    await conversations.append(actor(), conversation.id, {
      role: AI_MESSAGE_ROLE.TOOL,
      toolName: AI_TOOL.FIND_DOCTORS,
      content: JSON.stringify({ tool: AI_TOOL.FIND_DOCTORS, result: { items: [{ id: rasha }] } }),
    });
    await conversations.append(actor(), conversation.id, {
      role: AI_MESSAGE_ROLE.ASSISTANT,
      content: "د. رشا",
    });

    const history = await conversations.history(conversation.id, 60);

    expect(history.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "tool",
      "assistant",
    ]);
    expect(history[2]).toMatchObject({ role: "tool", content: expect.stringContaining(rasha) });
  });
});
