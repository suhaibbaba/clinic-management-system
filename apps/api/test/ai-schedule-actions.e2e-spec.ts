import {
  AI_ACTION_ERROR,
  AI_PROPOSAL_KIND,
  AI_PROPOSAL_STATUS,
  AI_SCHEDULE_CONFLICT_CHOICE,
  AI_TOOL,
  AI_TOOL_ERROR,
  APPOINTMENT_STATUS,
  AUDIT_ACTION,
  USER_ROLE,
  type UserRole,
} from "@clinic/shared";
import { and, eq, isNull } from "drizzle-orm";
import { TYPED_PHRASES } from "@api/ai/actions/ai-actions.service";
import { AiConversationsService } from "@api/ai/ai-conversations.service";
import { ToolRunnerService } from "@api/ai/tools/tool-runner.service";
import {
  aiProposals,
  appointments,
  auditLog,
  clinicClosures,
  clinics,
  doctorTimeOff,
  users,
} from "@api/database/schema";
import { createPatient, seedClinicFixtures } from "@test/helpers/patient-fixtures";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

function monday(weeksAhead: number): string {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + ((8 - day.getUTCDay()) % 7 || 7) + weeksAhead * 7);

  return day.toISOString().slice(0, 10);
}

interface ToolResult {
  error?: string;
  result?: Record<string, unknown> & {
    status?: string;
    proposal_id?: string;
    tier?: string;
    items?: { id: string }[];
    appointments?: { id: string }[];
  };
}

describe("Assistant schedule actions (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let other: TestClinic;
  let doctorId: string;
  let otherDoctorId: string;
  let patientId: string;
  const tokens = {} as Record<UserRole, string>;

  const actor = (role: UserRole) => ({ id: clinic.userIds[role], clinicId: clinic.id, role });

  async function tool(role: UserRole, name: string, args: unknown): Promise<ToolResult> {
    const conversation = await context.app.get(AiConversationsService).start(actor(role), "إجازة");
    const run = await context.app.get(ToolRunnerService).run(actor(role), conversation.id, {
      id: "call_1",
      name,
      arguments: JSON.stringify(args),
    });

    return JSON.parse(run.content) as ToolResult;
  }

  async function book(date: string, time: string): Promise<string> {
    const response = await context.app.inject({
      method: "POST",
      url: "/appointments",
      headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      payload: {
        patientId,
        doctorId,
        startsAt: new Date(`${date}T${time}:00+03:00`).toISOString(),
        durationMinutes: 30,
      },
    });

    expect(response.statusCode).toBe(201);

    return (response.json() as { id: string }).id;
  }

  const confirm = (id: string, typedPhrase?: string, role: UserRole = USER_ROLE.ADMIN) =>
    context.app.inject({
      method: "POST",
      url: `/ai/proposals/${id}/confirm`,
      headers: auth(tokens[role]),
      payload: typedPhrase === undefined ? {} : { typedPhrase },
    });

  const proposal = async (id: string) => {
    const [row] = await context.db.select().from(aiProposals).where(eq(aiProposals.id, id));

    return row;
  };

  const appointmentStatus = async (id: string) => {
    const [row] = await context.db
      .select({ status: appointments.status })
      .from(appointments)
      .where(eq(appointments.id, id));

    return row?.status;
  };

  const timeOffRows = () =>
    context.db
      .select()
      .from(doctorTimeOff)
      .where(and(eq(doctorTimeOff.doctorId, doctorId), isNull(doctorTimeOff.deletedAt)));

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();
    other = await context.createClinic();

    for (const role of [USER_ROLE.ADMIN, USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST] as const) {
      tokens[role] = await context.login(clinic.phones[role]);
    }

    ({ doctorId } = await seedClinicFixtures(context, clinic, tokens[USER_ROLE.ADMIN]));
    ({ doctorId: otherDoctorId } = await seedClinicFixtures(
      context,
      other,
      await context.login(other.phones[USER_ROLE.ADMIN]),
    ));

    for (const [target, userId] of [
      [clinic, clinic.userIds[USER_ROLE.DOCTOR]],
      [other, other.userIds[USER_ROLE.DOCTOR]],
    ] as const) {
      await context.db
        .update(users)
        .set({ nameAr: "باسل حداد", nameEn: "Basel Haddad" })
        .where(and(eq(users.id, userId), eq(users.clinicId, target.id)));
      await context.db
        .update(clinics)
        .set({
          workingHours: [{ weekday: 1, ranges: [{ start: "09:00", end: "17:00" }] }],
          settings: { timezone: "Asia/Hebron" },
        })
        .where(eq(clinics.id, target.id));
    }

    patientId = await createPatient(context, tokens[USER_ROLE.RECEPTIONIST], {
      fullName: "سمير خليل",
      phone: "0599000222",
    });
  });

  afterAll(async () => {
    await context.close();
  });

  describe("find_doctors", () => {
    it("turns an Arabic name into this clinic's doctor, never another clinic's", async () => {
      const { result } = await tool(USER_ROLE.RECEPTIONIST, AI_TOOL.FIND_DOCTORS, {
        query: "باسل",
      });

      expect(result?.items?.map((item) => item.id)).toEqual([doctorId]);
    });
  });

  describe("add_doctor_time_off", () => {
    it("drafts a card for a free day and records the time off with its audit entry", async () => {
      const day = monday(1);
      const { result } = await tool(USER_ROLE.ADMIN, AI_TOOL.ADD_DOCTOR_TIME_OFF, {
        doctor_id: doctorId,
        date_from: day,
        date_to: day,
        reason: "إجازة",
      });

      expect(result).toMatchObject({ status: "awaiting_user_confirmation", tier: "confirm" });
      expect(await timeOffRows()).toHaveLength(0);

      const response = await confirm(result?.proposal_id ?? "");

      expect(response.statusCode).toBe(200);

      const rows = await timeOffRows();

      expect(rows).toHaveLength(1);
      expect(rows[0]?.startsAt.toISOString()).toBe(new Date(`${day}T00:00:00+03:00`).toISOString());

      const [entry] = await context.db
        .select()
        .from(auditLog)
        .where(
          and(eq(auditLog.entityId, rows[0]?.id ?? ""), eq(auditLog.action, AUDIT_ACTION.CREATE)),
        );

      expect(entry?.newValue).toMatchObject({ doctorId, reason: "إجازة" });
    });

    it("asks about the appointments in the way before drafting anything", async () => {
      const day = monday(2);
      const appointmentId = await book(day, "10:00");

      const { result } = await tool(USER_ROLE.ADMIN, AI_TOOL.ADD_DOCTOR_TIME_OFF, {
        doctor_id: doctorId,
        date_from: day,
        date_to: day,
        reason: "مرض",
      });

      expect(result?.status).toBe("schedule_conflict");
      expect(result?.appointments?.map((item) => item.id)).toEqual([appointmentId]);
      expect(result?.proposal_id).toBeUndefined();
    });

    it("cancels them behind a typed phrase once the user says so", async () => {
      const day = monday(3);
      const appointmentId = await book(day, "11:00");

      const { result } = await tool(USER_ROLE.ADMIN, AI_TOOL.ADD_DOCTOR_TIME_OFF, {
        doctor_id: doctorId,
        date_from: day,
        date_to: day,
        reason: "مرض",
        on_conflict: AI_SCHEDULE_CONFLICT_CHOICE.CANCEL,
      });

      expect(result).toMatchObject({ status: "awaiting_user_confirmation", tier: "typed" });

      const id = result?.proposal_id ?? "";

      expect((await proposal(id))?.resolvedSummary).toMatchObject({
        onConflict: AI_SCHEDULE_CONFLICT_CHOICE.CANCEL,
        appointments: [{ id: appointmentId }],
      });
      expect((await confirm(id)).statusCode).toBe(422);
      expect(await appointmentStatus(appointmentId)).toBe(APPOINTMENT_STATUS.CONFIRMED);

      const phrase = TYPED_PHRASES[AI_PROPOSAL_KIND.TIME_OFF_CREATE];

      expect((await confirm(id, phrase)).statusCode).toBe(200);
      expect(await appointmentStatus(appointmentId)).toBe(APPOINTMENT_STATUS.CANCELLED);
    });

    it("keeps them booked when the user says keep", async () => {
      const day = monday(4);
      const appointmentId = await book(day, "12:00");

      const { result } = await tool(USER_ROLE.ADMIN, AI_TOOL.ADD_DOCTOR_TIME_OFF, {
        doctor_id: doctorId,
        date_from: day,
        date_to: day,
        time_from: "11:00",
        time_to: "14:00",
        reason: "اجتماع",
        on_conflict: AI_SCHEDULE_CONFLICT_CHOICE.KEEP,
      });

      expect(result).toMatchObject({ tier: "confirm" });
      expect((await confirm(result?.proposal_id ?? "")).statusCode).toBe(200);
      expect(await appointmentStatus(appointmentId)).toBe(APPOINTMENT_STATUS.CONFIRMED);
    });

    it("fails rather than cancel somebody booked after the card was drafted", async () => {
      const day = monday(5);
      const { result } = await tool(USER_ROLE.ADMIN, AI_TOOL.ADD_DOCTOR_TIME_OFF, {
        doctor_id: doctorId,
        date_from: day,
        date_to: day,
        reason: "إجازة",
        on_conflict: AI_SCHEDULE_CONFLICT_CHOICE.CANCEL,
      });
      const lateId = await book(day, "13:00");
      const before = (await timeOffRows()).length;

      await confirm(result?.proposal_id ?? "");

      expect(await proposal(result?.proposal_id ?? "")).toMatchObject({
        status: AI_PROPOSAL_STATUS.FAILED,
        errorCode: AI_ACTION_ERROR.SCHEDULE_CONFLICT,
      });
      expect(await appointmentStatus(lateId)).toBe(APPOINTMENT_STATUS.CONFIRMED);
      expect(await timeOffRows()).toHaveLength(before);
    });

    it("is not permitted to a receptionist", async () => {
      const day = monday(6);
      const { error } = await tool(USER_ROLE.RECEPTIONIST, AI_TOOL.ADD_DOCTOR_TIME_OFF, {
        doctor_id: doctorId,
        date_from: day,
        date_to: day,
        reason: "إجازة",
      });

      expect(error).toBe(AI_TOOL_ERROR.NOT_PERMITTED);
    });

    it("answers another clinic's doctor as not found", async () => {
      const day = monday(6);
      const { error } = await tool(USER_ROLE.ADMIN, AI_TOOL.ADD_DOCTOR_TIME_OFF, {
        doctor_id: otherDoctorId,
        date_from: day,
        date_to: day,
        reason: "إجازة",
      });

      expect(error).toBe(AI_TOOL_ERROR.NOT_FOUND);
    });
  });

  describe("changing and removing time off", () => {
    async function addTimeOff(day: string, from: string, to: string): Promise<string> {
      const response = await context.app.inject({
        method: "POST",
        url: `/doctors/${doctorId}/time-off`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
        payload: {
          startsAt: new Date(`${day}T${from}:00+03:00`).toISOString(),
          endsAt: new Date(`${day}T${to}:00+03:00`).toISOString(),
          reason: "اجتماع",
        },
      });

      expect(response.statusCode).toBe(201);

      return (response.json() as { item: { id: string } }).item.id;
    }

    it("finds the time off, then asks before growing it over an appointment", async () => {
      const day = monday(8);
      const timeOffId = await addTimeOff(day, "09:00", "10:00");
      const appointmentId = await book(day, "11:00");

      const listed = await tool(USER_ROLE.ADMIN, AI_TOOL.GET_DOCTOR_TIME_OFF, {
        doctor_id: doctorId,
        date_from: day,
        date_to: day,
      });

      expect(listed.result?.items?.map((item) => item.id)).toEqual([timeOffId]);

      const change = {
        time_off_id: timeOffId,
        date_from: day,
        date_to: day,
        time_from: "09:00",
        time_to: "12:00",
      };
      const asked = await tool(USER_ROLE.ADMIN, AI_TOOL.UPDATE_DOCTOR_TIME_OFF, change);

      expect(asked.result?.status).toBe("schedule_conflict");

      const { result } = await tool(USER_ROLE.ADMIN, AI_TOOL.UPDATE_DOCTOR_TIME_OFF, {
        ...change,
        on_conflict: AI_SCHEDULE_CONFLICT_CHOICE.KEEP,
      });

      expect((await confirm(result?.proposal_id ?? "")).statusCode).toBe(200);
      expect(await appointmentStatus(appointmentId)).toBe(APPOINTMENT_STATUS.CONFIRMED);

      const [row] = await context.db
        .select()
        .from(doctorTimeOff)
        .where(eq(doctorTimeOff.id, timeOffId));

      expect(row?.endsAt.toISOString()).toBe(new Date(`${day}T12:00:00+03:00`).toISOString());
    });

    it("removes it behind a card", async () => {
      const day = monday(9);
      const timeOffId = await addTimeOff(day, "09:00", "10:00");

      const { result } = await tool(USER_ROLE.ADMIN, AI_TOOL.DELETE_DOCTOR_TIME_OFF, {
        time_off_id: timeOffId,
      });

      expect(result).toMatchObject({ status: "awaiting_user_confirmation", tier: "confirm" });
      expect((await confirm(result?.proposal_id ?? "")).statusCode).toBe(200);

      const [row] = await context.db
        .select({ deletedAt: doctorTimeOff.deletedAt })
        .from(doctorTimeOff)
        .where(eq(doctorTimeOff.id, timeOffId));

      expect(row?.deletedAt).not.toBeNull();
    });
  });

  describe("add_clinic_closure", () => {
    it("closes the clinic and cancels the appointments the user agreed to", async () => {
      const day = monday(7);
      const appointmentId = await book(day, "09:30");

      const asked = await tool(USER_ROLE.ADMIN, AI_TOOL.ADD_CLINIC_CLOSURE, {
        date_from: day,
        date_to: day,
        reason: "عطلة رسمية",
      });

      expect(asked.result?.status).toBe("schedule_conflict");

      const { result } = await tool(USER_ROLE.ADMIN, AI_TOOL.ADD_CLINIC_CLOSURE, {
        date_from: day,
        date_to: day,
        reason: "عطلة رسمية",
        on_conflict: AI_SCHEDULE_CONFLICT_CHOICE.CANCEL,
      });
      const phrase = TYPED_PHRASES[AI_PROPOSAL_KIND.CLOSURE_CREATE];

      expect((await confirm(result?.proposal_id ?? "", phrase)).statusCode).toBe(200);
      expect(await appointmentStatus(appointmentId)).toBe(APPOINTMENT_STATUS.CANCELLED);

      const closures = await context.db
        .select()
        .from(clinicClosures)
        .where(and(eq(clinicClosures.clinicId, clinic.id), eq(clinicClosures.startsOn, day)));

      expect(closures).toHaveLength(1);
    });
  });
});
