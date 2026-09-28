import {
  addDays,
  APPOINTMENT_STATUS,
  AUDIT_ACTION,
  DEFAULT_TIME_ZONE,
  localDate,
  USER_ROLE,
  type AppointmentStatus,
  type UserRole,
} from "@clinic/shared";
import { and, eq } from "drizzle-orm";
import { appointments, auditLog, clinics } from "@api/database/schema";
import { NoShowScheduler } from "@api/modules/appointments/services/no-show.scheduler";
import { atClinic } from "@test/helpers/clinic-time";
import {
  createPatient,
  nameParts,
  seedClinicFixtures,
  uniquePhone,
} from "@test/helpers/patient-fixtures";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

interface Setup {
  readonly clinic: TestClinic;
  readonly tokens: Record<UserRole, string>;
  readonly doctorId: string;
  readonly patientId: string;
}

describe("Overdue appointments and automatic no-shows (e2e)", () => {
  let context: TestContext;
  const today = (): string => localDate(new Date(), DEFAULT_TIME_ZONE);

  async function setup(): Promise<Setup> {
    const clinic = await context.createClinic();
    const tokens = {} as Record<UserRole, string>;

    for (const role of [USER_ROLE.ADMIN, USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST]) {
      tokens[role] = await context.login(clinic.phones[role]);
    }

    const fixtures = await seedClinicFixtures(context, clinic, tokens[USER_ROLE.ADMIN]);
    const patientId = await createPatient(context, tokens[USER_ROLE.RECEPTIONIST], {
      ...nameParts("مريض متأخر"),
      phone: uniquePhone(),
    });

    return { clinic, tokens, doctorId: fixtures.doctorId, patientId };
  }

  async function insert(
    at: Setup,
    day: string,
    time: string,
    status: AppointmentStatus,
  ): Promise<string> {
    const [row] = await context.db
      .insert(appointments)
      .values({
        clinicId: at.clinic.id,
        patientId: at.patientId,
        doctorId: at.doctorId,
        startsAt: atClinic(day, time),
        durationMinutes: 30,
        status,
        ...(status === APPOINTMENT_STATUS.CANCELLED && { cancelledReason: "test" }),
      })
      .returning({ id: appointments.id });

    return row?.id ?? "";
  }

  const statusOf = async (id: string) => {
    const [row] = await context.db
      .select({ status: appointments.status })
      .from(appointments)
      .where(eq(appointments.id, id));

    return row?.status;
  };

  beforeAll(async () => {
    context = await createTestContext();
  });

  afterAll(async () => {
    await context.close();
  });

  describe("the calendar with an end date", () => {
    it("covers exactly the days from date through to", async () => {
      const at = await setup();
      const start = addDays(today(), 2);
      const inside = await insert(at, addDays(start, 2), "10:00", APPOINTMENT_STATUS.CONFIRMED);
      const after = await insert(at, addDays(start, 3), "10:00", APPOINTMENT_STATUS.CONFIRMED);
      const before = await insert(at, addDays(start, -1), "10:00", APPOINTMENT_STATUS.CONFIRMED);

      const response = await context.app.inject({
        method: "GET",
        url: `/appointments/calendar?date=${start}&to=${addDays(start, 2)}&range=week`,
        headers: auth(at.tokens[USER_ROLE.RECEPTIONIST]),
      });

      expect(response.statusCode).toBe(200);

      const feed = response.json() as { from: string; to: string; appointments: { id: string }[] };
      const ids = feed.appointments.map((item) => item.id);

      expect(feed.from).toBe(start);
      expect(feed.to).toBe(addDays(start, 3));
      expect(ids).toContain(inside);
      expect(ids).not.toContain(after);
      expect(ids).not.toContain(before);
    });

    it("refuses an end before the start or beyond a month", async () => {
      const at = await setup();
      const start = today();

      for (const to of [addDays(start, -1), addDays(start, 31)]) {
        const response = await context.app.inject({
          method: "GET",
          url: `/appointments/calendar?date=${start}&to=${to}`,
          headers: auth(at.tokens[USER_ROLE.RECEPTIONIST]),
        });

        expect(response.statusCode).toBe(400);
      }
    });
  });

  describe("the overdue list", () => {
    it("lists past appointments nobody settled, newest first", async () => {
      const at = await setup();
      const older = await insert(at, addDays(today(), -2), "09:00", APPOINTMENT_STATUS.CONFIRMED);
      const newer = await insert(at, addDays(today(), -1), "09:00", APPOINTMENT_STATUS.ARRIVED);
      const requested = await insert(
        at,
        addDays(today(), -1),
        "10:00",
        APPOINTMENT_STATUS.REQUESTED,
      );

      await insert(at, addDays(today(), -1), "12:00", APPOINTMENT_STATUS.COMPLETED);
      await insert(at, addDays(today(), -1), "13:00", APPOINTMENT_STATUS.NO_SHOW);
      await insert(at, addDays(today(), -1), "14:00", APPOINTMENT_STATUS.CANCELLED);
      await insert(at, today(), "00:30", APPOINTMENT_STATUS.CONFIRMED);
      await insert(at, addDays(today(), 1), "09:00", APPOINTMENT_STATUS.CONFIRMED);

      const response = await context.app.inject({
        method: "GET",
        url: "/appointments?overdue=true",
        headers: auth(at.tokens[USER_ROLE.RECEPTIONIST]),
      });

      expect(response.statusCode).toBe(200);
      expect((response.json() as { items: { id: string }[] }).items.map((row) => row.id)).toEqual([
        requested,
        newer,
        older,
      ]);
    });
  });

  describe("the automatic no-show", () => {
    const scheduler = () => context.app.get(NoShowScheduler);

    it("marks a confirmed appointment older than the clinic's days, and audits it", async () => {
      const at = await setup();
      const stale = await insert(at, addDays(today(), -8), "10:00", APPOINTMENT_STATUS.CONFIRMED);
      const recent = await insert(at, addDays(today(), -3), "10:00", APPOINTMENT_STATUS.CONFIRMED);
      const arrived = await insert(at, addDays(today(), -8), "11:00", APPOINTMENT_STATUS.ARRIVED);

      await scheduler().markNoShows();

      expect(await statusOf(stale)).toBe(APPOINTMENT_STATUS.NO_SHOW);
      expect(await statusOf(recent)).toBe(APPOINTMENT_STATUS.CONFIRMED);
      expect(await statusOf(arrived)).toBe(APPOINTMENT_STATUS.ARRIVED);

      const entries = await context.db
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.clinicId, at.clinic.id), eq(auditLog.entityId, stale)));

      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        userId: null,
        action: AUDIT_ACTION.UPDATE,
        oldValue: { status: APPOINTMENT_STATUS.CONFIRMED },
        newValue: { status: APPOINTMENT_STATUS.NO_SHOW },
      });
    });

    it("follows a clinic's own number of days", async () => {
      const at = await setup();

      await context.db
        .update(clinics)
        .set({ settings: { appointments: { autoNoShowDays: 2 } } })
        .where(eq(clinics.id, at.clinic.id));

      const stale = await insert(at, addDays(today(), -3), "10:00", APPOINTMENT_STATUS.CONFIRMED);
      const recent = await insert(at, addDays(today(), -1), "10:00", APPOINTMENT_STATUS.CONFIRMED);

      await scheduler().markNoShows();

      expect(await statusOf(stale)).toBe(APPOINTMENT_STATUS.NO_SHOW);
      expect(await statusOf(recent)).toBe(APPOINTMENT_STATUS.CONFIRMED);
    });
  });

  describe("the setting", () => {
    it("accepts 1 to 90 days and refuses anything else", async () => {
      const at = await setup();
      const save = (autoNoShowDays: unknown) =>
        context.app.inject({
          method: "PATCH",
          url: "/clinic",
          headers: auth(at.tokens[USER_ROLE.ADMIN]),
          payload: { settings: { appointments: { autoNoShowDays } } },
        });

      expect((await save(0)).statusCode).toBe(400);
      expect((await save(91)).statusCode).toBe(400);
      expect((await save(2.5)).statusCode).toBe(400);
      expect((await save(7)).statusCode).toBe(200);
    });
  });
});
