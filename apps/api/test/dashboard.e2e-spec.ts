import {
  instantFromLocal,
  localDate,
  PAYMENT_METHOD,
  PERFORMED_PROCEDURE_STATUS,
  USER_ROLE,
  type DashboardSummary,
  type UserRole,
} from "@clinic/shared";
import { eq } from "drizzle-orm";
import { clinics } from "@api/database/schema";
import {
  createPatient,
  procedurePayload,
  seedClinicFixtures,
  uniquePhone,
  type PatientFixtures,
  nameParts,
} from "@test/helpers/patient-fixtures";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

const TIME_ZONE = "Asia/Damascus";

const at = (date: string, minuteOfDay: number): string =>
  instantFromLocal(date, minuteOfDay, TIME_ZONE).toISOString();

describe("Dashboard (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let fixtures: PatientFixtures;
  const tokens = {} as Record<UserRole, string>;

  let today: string;

  const summary = async (role: UserRole): Promise<DashboardSummary> => {
    const response = await context.app.inject({
      method: "GET",
      url: "/dashboard/summary",
      headers: auth(tokens[role]),
    });

    expect(response.statusCode).toBe(200);

    return response.json() as DashboardSummary;
  };

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();

    for (const role of [
      USER_ROLE.ADMIN,
      USER_ROLE.DOCTOR,
      USER_ROLE.RECEPTIONIST,
      USER_ROLE.TECHNICIAN,
    ]) {
      tokens[role] = await context.login(clinic.phones[role]);
    }

    fixtures = await seedClinicFixtures(context, clinic, tokens[USER_ROLE.ADMIN]);

    await context.db
      .update(clinics)
      .set({
        workingHours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday,
          ranges: [{ start: "00:00", end: "23:59" }],
        })),
        settings: { timezone: TIME_ZONE },
      })
      .where(eq(clinics.id, clinic.id));

    today = localDate(new Date(), TIME_ZONE);
  });

  afterAll(async () => {
    await context.close();
  });

  it("reports today in the clinic timezone, not the server one", async () => {
    const body = await summary(USER_ROLE.ADMIN);

    expect(body.date).toBe(localDate(new Date(), TIME_ZONE));
  });

  it("counts today's appointments and lists them earliest first", async () => {
    const patientId = await createPatient(context, tokens[USER_ROLE.RECEPTIONIST], {
      ...nameParts("مريض اللوحة"),
      phone: uniquePhone(),
    });

    for (const minute of [15 * 60, 10 * 60]) {
      const booked = await context.app.inject({
        method: "POST",
        url: "/appointments",
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
        payload: {
          patientId,
          doctorId: fixtures.doctorId,
          startsAt: at(today, minute),
          durationMinutes: 30,
          type: "checkup",
        },
      });

      expect(booked.statusCode).toBe(201);
    }

    const body = await summary(USER_ROLE.ADMIN);

    expect(body.appointmentsToday).toBe(2);
    expect(body.schedule).toHaveLength(2);
    expect(new Date(body.schedule[0]!.startsAt).getTime()).toBeLessThan(
      new Date(body.schedule[1]!.startsAt).getTime(),
    );
  });

  it("agrees with the overdue list rather than computing its own total", async () => {
    const patientId = await createPatient(context, tokens[USER_ROLE.ADMIN], {
      ...nameParts("مريض مدين"),
      phone: uniquePhone(),
    });

    const procedure = await context.app.inject({
      method: "POST",
      url: "/performed-procedures",
      headers: auth(tokens[USER_ROLE.ADMIN]),
      payload: {
        ...procedurePayload({
          patientId,
          doctorId: fixtures.doctorId,
          procedureId: fixtures.catalogId,
          tooth: 16,
        }),
        status: PERFORMED_PROCEDURE_STATUS.DONE,
        price: "250.00",
      },
    });

    expect(procedure.statusCode).toBe(201);

    const before = await summary(USER_ROLE.ADMIN);

    expect(before.overduePatients).toBeGreaterThanOrEqual(1);
    expect(Number(before.overdueTotal)).toBeGreaterThanOrEqual(250);

    const list = await context.app.inject({
      method: "GET",
      url: "/billing/overdue?limit=100",
      headers: auth(tokens[USER_ROLE.ADMIN]),
    });

    const items = (list.json() as { items: { balance: string }[] }).items;
    const summed = items.reduce((total, row) => total + Number(row.balance), 0);

    expect(Number(before.overdueTotal)).toBeCloseTo(summed, 2);
    expect(before.overduePatients).toBe(items.length);

    const paid = await context.app.inject({
      method: "POST",
      url: "/payments",
      headers: auth(tokens[USER_ROLE.ADMIN]),
      payload: { patientId, amount: "250.00", method: PAYMENT_METHOD.CASH },
    });

    expect(paid.statusCode).toBe(201);

    const after = await summary(USER_ROLE.ADMIN);

    expect(Number(after.overdueTotal)).toBeCloseTo(Number(before.overdueTotal) - 250, 2);
  });

  it("excludes a patient who has paid inside the window", async () => {
    const patientId = await createPatient(context, tokens[USER_ROLE.ADMIN], {
      ...nameParts("مريض دفع حديثاً"),
      phone: uniquePhone(),
    });

    const procedure = await context.app.inject({
      method: "POST",
      url: "/performed-procedures",
      headers: auth(tokens[USER_ROLE.ADMIN]),
      payload: {
        ...procedurePayload({
          patientId,
          doctorId: fixtures.doctorId,
          procedureId: fixtures.catalogId,
          tooth: 26,
        }),
        status: PERFORMED_PROCEDURE_STATUS.DONE,
        price: "400.00",
      },
    });

    expect(procedure.statusCode).toBe(201);

    await context.app.inject({
      method: "POST",
      url: "/payments",
      headers: auth(tokens[USER_ROLE.ADMIN]),
      payload: { patientId, amount: "10.00", method: PAYMENT_METHOD.CASH },
    });

    const body = await summary(USER_ROLE.ADMIN);

    const list = await context.app.inject({
      method: "GET",
      url: "/billing/overdue?limit=100",
      headers: auth(tokens[USER_ROLE.ADMIN]),
    });

    const items = (list.json() as { items: { patientId: string }[] }).items;

    expect(items.map((row) => row.patientId)).not.toContain(patientId);
    expect(body.overduePatients).toBe(items.length);
  });

  it("counts the online bookings waiting on an answer", async () => {
    const patientId = await createPatient(context, tokens[USER_ROLE.RECEPTIONIST], {
      ...nameParts("حجز إلكتروني"),
      phone: uniquePhone(),
    });

    const requested = await context.app.inject({
      method: "POST",
      url: "/appointments",
      headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      payload: {
        patientId,
        doctorId: fixtures.doctorId,
        startsAt: at(today, 12 * 60),
        durationMinutes: 30,
        type: "checkup",
        status: "requested",
      },
    });

    expect(requested.statusCode).toBe(201);

    const body = await summary(USER_ROLE.RECEPTIONIST);

    const queue = await context.app.inject({
      method: "GET",
      url: "/appointments/pending-confirmation?limit=1",
      headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
    });

    expect(body.pendingBookings).toBe((queue.json() as { total: number }).total);
    expect(body.pendingBookings).toBeGreaterThanOrEqual(1);
  });

  it("gives a technician the overdue figure and the booking queue, as a doctor", async () => {
    const body = await summary(USER_ROLE.TECHNICIAN);

    expect(body.overdueTotal).toEqual(expect.any(String));
    expect(body.pendingBookings).toEqual(expect.any(Number));
  });

  it("gives a doctor their own day, with the overdue figure and the booking queue", async () => {
    const body = await summary(USER_ROLE.DOCTOR);

    expect(body.overdueTotal).toEqual(expect.any(String));
    expect(body.pendingBookings).toEqual(expect.any(Number));

    for (const entry of body.schedule) {
      expect(entry.doctorId).toBe(fixtures.doctorId);
    }
  });

  it("gives reception both figures", async () => {
    const body = await summary(USER_ROLE.RECEPTIONIST);

    expect(body.overdueTotal).toEqual(expect.any(String));
    expect(body.pendingBookings).toEqual(expect.any(Number));
  });
});
