import {
  USER_ROLE,
  WAITING_LIST_SOURCE,
  WAITING_LIST_STATUS,
  addDays,
  instantFromLocal,
  localDate,
  localWeekday,
  type Paginated,
  type WaitingListEntry,
} from "@clinic/shared";
import { eq } from "drizzle-orm";
import { clinics } from "@api/database/schema";
import { seedClinicFixtures, type PatientFixtures } from "@test/helpers/patient-fixtures";
import { auth, createTestContext, type TestClinic, type TestContext } from "@test/helpers/test-app";

const TIME_ZONE = "Asia/Damascus";

function nextMonday(): string {
  let date = localDate(new Date(), TIME_ZONE);

  do {
    date = addDays(date, 1);
  } while (localWeekday(date, TIME_ZONE) !== 1);

  return date;
}

// The page used to dead-end on "no times". This is the way out of it: a request for a phone call
// that lands in the queue reception already reads, and the actions that close it again.
describe("Urgent requests (e2e)", () => {
  let context: TestContext;
  let clinic: TestClinic;
  let fixtures: PatientFixtures;
  let token: string;
  let monday: string;

  const uniquePhone = (): string => `+9933${Math.floor(Math.random() * 1_000_000_000)}`;

  const request = (body: Record<string, unknown>) => {
    context.resetThrottle();

    return context.app.inject({
      method: "POST",
      url: `/public/booking/${clinic.slug}/urgent-request`,
      payload: { fullName: "طالب عاجل", complaint: "ألم شديد منذ الليل", ...body },
    });
  };

  const queue = async (query = ""): Promise<WaitingListEntry[]> => {
    const response = await context.app.inject({
      method: "GET",
      url: `/waiting-list?limit=50${query}`,
      headers: auth(token),
    });

    return (response.json() as Paginated<WaitingListEntry>).items;
  };

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();
    token = await context.login(clinic.phones[USER_ROLE.RECEPTIONIST]);

    fixtures = await seedClinicFixtures(
      context,
      clinic,
      await context.login(clinic.phones[USER_ROLE.ADMIN]),
    );

    await context.db
      .update(clinics)
      .set({
        workingHours: [{ weekday: 1, ranges: [{ start: "09:00", end: "17:00" }] }],
        settings: { timezone: TIME_ZONE, booking: { enabled: true } },
      })
      .where(eq(clinics.id, clinic.id));

    monday = nextMonday();
  });

  afterAll(async () => {
    await context.close();
  });

  it("takes a request from a stranger and puts it in the queue", async () => {
    const phone = uniquePhone();

    const response = await request({ phone, fullName: "سامي الحلبي" });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ received: true });

    const entry = (await queue()).find((row) => row.patientName === "سامي الحلبي");

    expect(entry).toMatchObject({
      source: WAITING_LIST_SOURCE.ONLINE,
      status: WAITING_LIST_STATUS.PENDING,
      priority: "urgent",
      reason: "ألم شديد منذ الليل",
    });
  });

  it("says nothing about the phone it was given", async () => {
    const known = await request({ phone: uniquePhone() });
    const stranger = await request({ phone: uniquePhone() });

    expect(known.json()).toEqual(stranger.json());
    expect(known.statusCode).toBe(stranger.statusCode);
  });

  it("caps how many one number may have open at a time", async () => {
    const phone = uniquePhone();

    for (let index = 0; index < 3; index += 1) {
      expect((await request({ phone })).statusCode).toBe(201);
    }

    const capped = await request({ phone });

    // Worded as a closed booking page, so the cap is not a signal either.
    expect(capped.statusCode).toBe(403);
    expect(capped.json()).toMatchObject({ message: "Booking is not available right now" });
  });

  describe("what reception does with one", () => {
    let entry: WaitingListEntry;

    beforeEach(async () => {
      const phone = uniquePhone();
      await request({ phone, fullName: `مريض ${phone.slice(-6)}` });

      const found = (await queue()).find((row) => row.patientPhone.endsWith(phone.slice(-6)));
      expect(found).toBeDefined();
      entry = found as WaitingListEntry;
    });

    const act = (path: string, payload: Record<string, unknown> = {}) =>
      context.app.inject({
        method: "PATCH",
        url: `/waiting-list/${entry.id}/${path}`,
        headers: auth(token),
        payload,
      });

    it("marks it contacted and leaves it in the queue", async () => {
      const response = await act("contacted");

      expect(response.json()).toMatchObject({
        status: WAITING_LIST_STATUS.CONTACTED,
        resolvedAt: null,
      });
    });

    it("declines it with a reason", async () => {
      const response = await act("decline", { reason: "حوّلناه إلى الطوارئ", notify: true });

      expect(response.json()).toMatchObject({
        status: WAITING_LIST_STATUS.DECLINED,
        declinedReason: "حوّلناه إلى الطوارئ",
      });
      expect((response.json() as WaitingListEntry).resolvedAt).not.toBeNull();
    });

    it("will not decline one it has already scheduled", async () => {
      await context.app.inject({
        method: "POST",
        url: `/waiting-list/${entry.id}/promote`,
        headers: auth(token),
        payload: {
          doctorId: fixtures.doctorId,
          startsAt: instantFromLocal(monday, 9 * 60 + 30, TIME_ZONE).toISOString(),
        },
      });

      expect((await act("decline", { reason: "بعد فوات الأوان" })).statusCode).toBe(400);
    });

    // The form reception opens is prefilled from the entry, so this asserts the entry carries what
    // it needs to prefill with and comes back scheduled and linked.
    it("schedules it, carrying the patient and the complaint into the appointment", async () => {
      const response = await context.app.inject({
        method: "POST",
        url: `/waiting-list/${entry.id}/promote`,
        headers: auth(token),
        payload: {
          doctorId: fixtures.doctorId,
          startsAt: instantFromLocal(monday, 10 * 60, TIME_ZONE).toISOString(),
          durationMinutes: 30,
          notify: true,
        },
      });

      expect(response.statusCode).toBe(201);

      const scheduled = response.json() as WaitingListEntry;
      expect(scheduled.status).toBe(WAITING_LIST_STATUS.SCHEDULED);
      expect(scheduled.appointmentId).not.toBeNull();

      const appointment = await context.app.inject({
        method: "GET",
        url: `/appointments/${scheduled.appointmentId}`,
        headers: auth(token),
      });

      expect(appointment.json()).toMatchObject({
        patientId: entry.patientId,
        reason: entry.reason,
      });
    });
  });
});
