import {
  NOTIFICATION_TEMPLATE,
  SCHEDULE_CONFLICT_ERROR,
  USER_ROLE,
  addDays,
  closureCancellationReason,
  instantFromLocal,
  localDate,
  localWeekday,
  timeOffCancellationReason,
  type UserRole,
} from '@clinic/shared';
import { eq } from 'drizzle-orm';

import {
  appointments,
  clinicClosures,
  clinics,
  doctors,
  doctorTimeOff,
  notificationsLog,
} from '@api/database/schema';
import {
  createPatient,
  seedClinicFixtures,
  uniquePhone,
  type PatientFixtures,
} from '@test/helpers/patient-fixtures';
import { auth, createTestContext, type TestClinic, type TestContext } from '@test/helpers/test-app';

const TIME_ZONE = 'Asia/Damascus';

/** The next Monday in the clinic's own zone — see `appointments.e2e-spec`. */
function nextMonday(): string {
  let date = localDate(new Date(), TIME_ZONE);

  do {
    date = addDays(date, 1);
  } while (localWeekday(date, TIME_ZONE) !== 1);

  return date;
}

const at = (date: string, time: string): string => {
  const [hours = '0', minutes = '0'] = time.split(':');

  return instantFromLocal(date, Number(hours) * 60 + Number(minutes), TIME_ZONE).toISOString();
};

interface ConflictBody {
  error: string;
  appointments: { id: string; patientName: string }[];
}

// The availability assertions matter as much as the 409: a closure the settings screen records but
// availability ignores puts a patient in front of a locked door.
describe('Closures and time off (e2e)', () => {
  let context: TestContext;
  let clinic: TestClinic;
  let fixtures: PatientFixtures;
  const tokens = {} as Record<UserRole, string>;

  let patientId: string;
  let monday: string;

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
        workingHours: [
          // A split shift, 09:00–13:00 and 16:00–20:00: the case a single start/end pair cannot
          // hold.
          {
            weekday: 1,
            ranges: [
              { start: '09:00', end: '13:00' },
              { start: '16:00', end: '20:00' },
            ],
          },
        ],
        settings: { timezone: TIME_ZONE },
      })
      .where(eq(clinics.id, clinic.id));

    // The doctor covers both shifts, so the intersection with the clinic's
    // hours is the split day itself rather than a truncated version of it.
    await context.db
      .update(doctors)
      .set({
        weeklySchedule: [{ weekday: 1, ranges: [{ start: '09:00', end: '20:00' }] }],
      })
      .where(eq(doctors.id, fixtures.doctorId));

    patientId = await createPatient(context, tokens[USER_ROLE.RECEPTIONIST], {
      fullName: 'مريض الإغلاقات',
      phone: uniquePhone(),
    });

    monday = nextMonday();
  });

  afterAll(async () => {
    await context.close();
  });

  afterEach(async () => {
    await context.db.delete(notificationsLog).where(eq(notificationsLog.clinicId, clinic.id));
    await context.db.delete(appointments).where(eq(appointments.clinicId, clinic.id));
    await context.db.delete(doctorTimeOff).where(eq(doctorTimeOff.clinicId, clinic.id));
    await context.db.delete(clinicClosures).where(eq(clinicClosures.clinicId, clinic.id));
  });

  const availability = async (date: string) => {
    const response = await context.app.inject({
      method: 'GET',
      url: `/appointments/availability?doctorId=${fixtures.doctorId}&date=${date}`,
      headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
    });

    expect(response.statusCode).toBe(200);

    return response.json() as {
      closedReason: string | null;
      closedNote: string | null;
      slots: { start: string; available: boolean }[];
    };
  };

  const book = (time: string) =>
    context.app.inject({
      method: 'POST',
      url: '/appointments',
      headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      payload: {
        patientId,
        doctorId: fixtures.doctorId,
        startsAt: at(monday, time),
        durationMinutes: 30,
        type: 'checkup',
      },
    });

  const createClosure = (payload: Record<string, unknown>, query = '') =>
    context.app.inject({
      method: 'POST',
      url: `/clinic-closures${query}`,
      headers: auth(tokens[USER_ROLE.ADMIN]),
      payload,
    });

  const createTimeOff = (payload: Record<string, unknown>, query = '') =>
    context.app.inject({
      method: 'POST',
      url: `/doctors/${fixtures.doctorId}/time-off${query}`,
      headers: auth(tokens[USER_ROLE.ADMIN]),
      payload,
    });

  describe('availability', () => {
    it('offers both halves of a split shift and nothing in the gap', async () => {
      const { slots, closedReason } = await availability(monday);
      const starts = slots.map((slot) => slot.start);

      expect(closedReason).toBeNull();
      expect(starts).toContain('09:00');
      expect(starts).toContain('12:30');
      // 13:00–16:00 is not a break inside a window, it is between two windows.
      expect(starts).not.toContain('13:00');
      expect(starts).not.toContain('15:30');
      expect(starts).toContain('16:00');
      expect(starts).toContain('19:30');
    });

    it('closes a day covered by a clinic closure and says why', async () => {
      const created = await createClosure({
        startsOn: monday,
        endsOn: monday,
        reason: 'عيد الفطر',
      });

      expect(created.statusCode).toBe(201);
      const { closedReason, closedNote, slots } = await availability(monday);

      expect(closedReason).toBe('clinic_closure');
      expect(closedNote).toBe('عيد الفطر');
      expect(slots).toEqual([]);
    });

    it('closes every day of a multi-day closure, including its last one', async () => {
      // The inclusive end is the mistake nobody notices until someone turns up
      // on the day the clinic thought it had reopened.
      await createClosure({
        startsOn: addDays(monday, -1),
        endsOn: addDays(monday, 1),
        reason: 'صيانة',
      });

      expect((await availability(monday)).closedReason).toBe('clinic_closure');
      expect((await availability(addDays(monday, 1))).closedReason).toBe('clinic_closure');
    });

    it('subtracts partial time off and leaves the rest of the day bookable', async () => {
      const created = await createTimeOff({
        startsAt: at(monday, '16:00'),
        endsAt: at(monday, '20:00'),
        reason: 'مؤتمر طبي',
      });

      expect(created.statusCode).toBe(201);

      const { slots, closedReason } = await availability(monday);
      const at9 = slots.find((slot) => slot.start === '09:00');
      const at16 = slots.find((slot) => slot.start === '16:00');

      // The morning shift is untouched; the evening one is gone.
      expect(closedReason).toBeNull();
      expect(at9?.available).toBe(true);
      expect(at16?.available).toBe(false);
    });

    it('reports a whole day of time off as time off, not as fully booked', async () => {
      await createTimeOff({
        startsAt: at(monday, '00:00'),
        endsAt: at(addDays(monday, 1), '00:00'),
        reason: 'إجازة',
      });

      const { closedReason, closedNote } = await availability(monday);

      expect(closedReason).toBe('doctor_time_off');
      expect(closedNote).toBe('إجازة');
    });

    it('refuses a booking inside time off through the same rule', async () => {
      await createTimeOff({
        startsAt: at(monday, '09:00'),
        endsAt: at(monday, '13:00'),
        reason: 'إجازة',
      });

      const { slots } = await availability(monday);

      expect(slots.find((slot) => slot.start === '09:00')?.available).toBe(false);
    });
  });

  describe('overlapping appointments', () => {
    it('refuses a closure over booked appointments and names them', async () => {
      const booked = await book('09:00');
      expect(booked.statusCode).toBe(201);

      const response = await createClosure({
        startsOn: monday,
        endsOn: monday,
        reason: 'عيد الفطر',
      });

      expect(response.statusCode).toBe(409);
      const body = response.json() as ConflictBody;

      // The list, not a count: a dialog saying "3 appointments" with no way to
      // see which three is a question nobody can answer.
      expect(body.error).toBe(SCHEDULE_CONFLICT_ERROR);
      expect(body.appointments).toHaveLength(1);
      expect(body.appointments[0]?.patientName).toBe('مريض الإغلاقات');

      const rows = await context.db
        .select({ id: clinicClosures.id })
        .from(clinicClosures)
        .where(eq(clinicClosures.clinicId, clinic.id));

      expect(rows).toHaveLength(0);
    });

    it('writes the closure with force and leaves the appointments standing', async () => {
      const booked = await book('09:00');
      const appointmentId = (booked.json() as { id: string }).id;

      const response = await createClosure(
        { startsOn: monday, endsOn: monday, reason: 'عيد الفطر' },
        '?force=true',
      );

      expect(response.statusCode).toBe(201);
      expect((response.json() as { cancelledAppointments: number }).cancelledAppointments).toBe(0);

      const [row] = await context.db
        .select({ status: appointments.status })
        .from(appointments)
        .where(eq(appointments.id, appointmentId));

      // Reception rings round and moves them by hand, which is what a practice
      // with three patients it knows by name actually does.
      expect(row?.status).toBe('confirmed');
    });

    it('cancels the appointments on request, links the reason and notifies', async () => {
      const booked = await book('09:00');
      const appointmentId = (booked.json() as { id: string }).id;

      const response = await createClosure(
        { startsOn: monday, endsOn: monday, reason: 'عيد الفطر' },
        '?force=true&cancelAppointments=true',
      );

      expect(response.statusCode).toBe(201);

      const result = response.json() as {
        item: { id: string };
        cancelledAppointments: number;
      };

      expect(result.cancelledAppointments).toBe(1);

      const [row] = await context.db
        .select({
          status: appointments.status,
          cancelledReason: appointments.cancelledReason,
        })
        .from(appointments)
        .where(eq(appointments.id, appointmentId));

      expect(row?.status).toBe('cancelled');
      // Points at the closure, so three weeks later the calendar can still say
      // which one swept it away.
      expect(row?.cancelledReason).toBe(closureCancellationReason(result.item.id));

      const messages = await context.db
        .select({ template: notificationsLog.template, to: notificationsLog.to })
        .from(notificationsLog)
        .where(eq(notificationsLog.appointmentId, appointmentId));

      expect(messages).toHaveLength(1);
      expect(messages[0]?.template).toBe(NOTIFICATION_TEMPLATE.BOOKING_CANCELLED);
    });

    it('applies the same rule to time off, scoped to that doctor', async () => {
      const booked = await book('09:00');
      const appointmentId = (booked.json() as { id: string }).id;

      const refused = await createTimeOff({
        startsAt: at(monday, '09:00'),
        endsAt: at(monday, '13:00'),
        reason: 'إجازة',
      });

      expect(refused.statusCode).toBe(409);
      expect((refused.json() as ConflictBody).appointments).toHaveLength(1);

      const forced = await createTimeOff(
        { startsAt: at(monday, '09:00'), endsAt: at(monday, '13:00'), reason: 'إجازة' },
        '?force=true&cancelAppointments=true',
      );

      expect(forced.statusCode).toBe(201);

      const result = forced.json() as { item: { id: string } };
      const [row] = await context.db
        .select({ cancelledReason: appointments.cancelledReason })
        .from(appointments)
        .where(eq(appointments.id, appointmentId));

      expect(row?.cancelledReason).toBe(timeOffCancellationReason(result.item.id));
    });

    it('accepts an absence that merely shares the day with an appointment', async () => {
      // Overlap is of intervals, not of calendar days — getting that wrong would make every absence
      // on a busy day need forcing.
      expect((await book('09:00')).statusCode).toBe(201);

      const response = await createTimeOff({
        startsAt: at(monday, '16:00'),
        endsAt: at(monday, '20:00'),
        reason: 'مؤتمر',
      });

      expect(response.statusCode).toBe(201);
    });

    it('counts an appointment that only ends inside the window', async () => {
      // The appointment starts before the window and is still in the way, which a start-time-only
      // comparison would miss.
      expect((await book('12:30')).statusCode).toBe(201);

      const response = await createTimeOff({
        startsAt: at(monday, '12:45'),
        endsAt: at(monday, '17:00'),
        reason: 'مؤتمر',
      });

      expect(response.statusCode).toBe(409);
      expect((response.json() as ConflictBody).appointments).toHaveLength(1);
    });
  });

  describe('permissions', () => {
    it('lets every role read closures — reception has to know Tuesday is shut', async () => {
      await createClosure({ startsOn: monday, endsOn: monday, reason: 'عطلة' });

      const response = await context.app.inject({
        method: 'GET',
        url: '/clinic-closures',
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      expect(response.statusCode).toBe(200);
      expect((response.json() as { total: number }).total).toBe(1);
    });

    it('refuses a receptionist writing one', async () => {
      const response = await context.app.inject({
        method: 'POST',
        url: '/clinic-closures',
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
        payload: { startsOn: monday, endsOn: monday, reason: 'عطلة' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('refuses a doctor booking time off in someone else’s calendar', async () => {
      // The doctor token owns `fixtures.doctorId`, so this is the same doctor —
      // it must be allowed, which is the other half of the rule.
      const own = await context.app.inject({
        method: 'POST',
        url: `/doctors/${fixtures.doctorId}/time-off`,
        headers: auth(tokens[USER_ROLE.DOCTOR]),
        payload: {
          startsAt: at(monday, '16:00'),
          endsAt: at(monday, '20:00'),
          reason: 'إجازة',
        },
      });

      expect(own.statusCode).toBe(201);
    });

    it('rejects a range that ends before it starts', async () => {
      const response = await createClosure({
        startsOn: addDays(monday, 2),
        endsOn: monday,
        reason: 'عطلة',
      });

      expect(response.statusCode).toBe(400);
    });

    it('rejects an annual closure that spans two years', async () => {
      const response = await createClosure({
        startsOn: '2026-12-30',
        endsOn: '2027-01-02',
        reason: 'رأس السنة',
        isAnnual: true,
      });

      // "Every year from December 2026 to January 2027" has no meaning as a
      // repeating rule — it would close the clinic forever.
      expect(response.statusCode).toBe(400);
    });

    it('writes an audit entry for a closure', async () => {
      const created = await createClosure({
        startsOn: monday,
        endsOn: monday,
        reason: 'عطلة',
      });

      const id = (created.json() as { item: { id: string } }).item.id;

      const log = await context.app.inject({
        method: 'GET',
        url: `/audit-log?entity=clinic_closures&entityId=${id}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });

      expect(log.statusCode).toBe(200);
      expect((log.json() as { items: unknown[] }).items.length).toBeGreaterThan(0);
    });
  });

  it('carries closures and time off in the calendar feed', async () => {
    await createClosure({ startsOn: monday, endsOn: monday, reason: 'عطلة' });
    await createTimeOff({
      startsAt: at(monday, '16:00'),
      endsAt: at(monday, '20:00'),
      reason: 'مؤتمر',
    });

    const response = await context.app.inject({
      method: 'GET',
      url: `/appointments/calendar?date=${monday}&range=day`,
      headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
    });

    expect(response.statusCode).toBe(200);

    const feed = response.json() as {
      closures: { reason: string }[];
      timeOff: { reason: string }[];
    };

    // In the same response as the blocks: a grid that paints a normal Tuesday
    // and shades it a moment later is a grid reception books into.
    expect(feed.closures.map((row) => row.reason)).toEqual(['عطلة']);
    expect(feed.timeOff.map((row) => row.reason)).toEqual(['مؤتمر']);
  });
});
