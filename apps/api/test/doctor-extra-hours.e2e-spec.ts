import {
  USER_ROLE,
  addDays,
  instantFromLocal,
  localDate,
  localWeekday,
  type Availability,
  type DoctorExtraHours,
  type UserRole,
} from "@clinic/shared";
import { eq } from "drizzle-orm";
import { clinicClosures, clinics } from "@api/database/schema";
import {
  createPatient,
  nameParts,
  seedClinicFixtures,
  uniquePhone,
  type PatientFixtures,
} from "@test/helpers/patient-fixtures";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

const TIME_ZONE = "Asia/Damascus";

function next(weekday: number): string {
  let date = localDate(new Date(), TIME_ZONE);

  do {
    date = addDays(date, 1);
  } while (localWeekday(date, TIME_ZONE) !== weekday);

  return date;
}

describe("A doctor's extra hours (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let fixtures: PatientFixtures;
  const tokens = {} as Record<UserRole, string>;
  let monday: string;
  let tuesday: string;

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();

    for (const role of [USER_ROLE.ADMIN, USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST]) {
      tokens[role] = await context.login(clinic.phones[role]);
    }

    fixtures = await seedClinicFixtures(context, clinic, tokens[USER_ROLE.ADMIN]);

    await context.db
      .update(clinics)
      .set({
        workingHours: [{ weekday: 1, ranges: [{ start: "09:00", end: "17:00" }] }],
        settings: { timezone: TIME_ZONE },
      })
      .where(eq(clinics.id, clinic.id));

    monday = next(1);
    tuesday = next(2);
  });

  afterAll(async () => {
    await context.close();
  });

  const give = (date: string, start: string, end: string, role: UserRole = USER_ROLE.ADMIN) =>
    context.app.inject({
      method: "POST",
      url: `/doctors/${fixtures.doctorId}/extra-hours`,
      headers: auth(tokens[role]),
      payload: { date, ranges: [{ start, end }], reason: "زيارة بطلب" },
    });

  const takeBack = (id: string) =>
    context.app.inject({
      method: "DELETE",
      url: `/doctor-extra-hours/${id}`,
      headers: auth(tokens[USER_ROLE.ADMIN]),
    });

  const availability = async (date: string): Promise<Availability> => {
    const response = await context.app.inject({
      method: "GET",
      url: `/appointments/availability?doctorId=${fixtures.doctorId}&date=${date}&durationMinutes=30`,
      headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
    });

    expect(response.statusCode).toBe(200);

    return response.json<Availability>();
  };

  it("opens the doctor on a day the clinic does not open, and only in those hours", async () => {
    expect((await availability(tuesday)).closedReason).toBe("clinic_closed");

    const given = await give(tuesday, "18:00", "20:00");
    expect(given.statusCode).toBe(201);

    try {
      const day = await availability(tuesday);

      expect(day.closedReason).toBeNull();
      expect(day.slots[0]?.start).toBe("18:00");
      expect(day.slots.at(-1)?.start).toBe("19:30");
    } finally {
      await takeBack(given.json<DoctorExtraHours>().id);
    }

    expect((await availability(tuesday)).closedReason).toBe("clinic_closed");
  });

  it("extends a working day past the clinic's closing time", async () => {
    const given = await give(monday, "17:00", "19:00");
    expect(given.statusCode).toBe(201);

    try {
      const day = await availability(monday);

      expect(day.slots[0]?.start).toBe("09:00");
      expect(day.slots.at(-1)?.start).toBe("18:30");
    } finally {
      await takeBack(given.json<DoctorExtraHours>().id);
    }
  });

  it("lets the front desk book an appointment in them", async () => {
    const given = await give(tuesday, "18:00", "20:00");
    const patientId = await createPatient(context, tokens[USER_ROLE.RECEPTIONIST], {
      ...nameParts("مريض مسائي"),
      phone: uniquePhone(),
    });

    try {
      const booked = await context.app.inject({
        method: "POST",
        url: "/appointments",
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
        payload: {
          patientId,
          doctorId: fixtures.doctorId,
          startsAt: instantFromLocal(tuesday, 18 * 60, TIME_ZONE).toISOString(),
          durationMinutes: 30,
          type: "checkup",
        },
      });

      expect(booked.statusCode).toBe(201);
    } finally {
      await takeBack(given.json<DoctorExtraHours>().id);
    }
  });

  it("still gives way to a clinic holiday", async () => {
    const given = await give(tuesday, "18:00", "20:00");
    const [closure] = await context.db
      .insert(clinicClosures)
      .values({
        clinicId: clinic.id,
        startsOn: tuesday,
        endsOn: tuesday,
        reason: "عطلة",
        isAnnual: false,
      })
      .returning({ id: clinicClosures.id });

    try {
      expect((await availability(tuesday)).closedReason).toBe("clinic_closure");
    } finally {
      await context.db.delete(clinicClosures).where(eq(clinicClosures.id, closure?.id ?? ""));
      await takeBack(given.json<DoctorExtraHours>().id);
    }
  });

  it("refuses a day that has passed", async () => {
    const yesterday = addDays(localDate(new Date(), TIME_ZONE), -1);

    expect((await give(yesterday, "18:00", "20:00")).statusCode).toBe(400);
  });

  it("is given by the doctor or the admin, not the front desk", async () => {
    expect((await give(tuesday, "18:00", "20:00", USER_ROLE.RECEPTIONIST)).statusCode).toBe(403);
  });
});
