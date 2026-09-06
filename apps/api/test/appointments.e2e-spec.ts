import {
  APPOINTMENT_STATUS,
  instantFromLocal,
  localDate,
  USER_ROLE,
  type UserRole,
} from '@clinic/shared';
import { eq } from 'drizzle-orm';

import { appointments, clinics, doctors } from '@api/database/schema';
import {
  createPatient,
  seedClinicFixtures,
  uniquePhone,
  type PatientFixtures,
} from '@test/helpers/patient-fixtures';
import { auth, createTestContext, type TestClinic, type TestContext } from '@test/helpers/test-app';

const TIME_ZONE = 'Asia/Damascus';

/** The next Monday, so the fixture schedule (Monday 09:00–17:00) applies. */
function nextMonday(): string {
  const today = new Date();
  const shift = (8 - today.getUTCDay()) % 7 || 7;

  return localDate(new Date(today.getTime() + shift * 86_400_000), TIME_ZONE);
}

const at = (date: string, time: string): string => {
  const [hours = '0', minutes = '0'] = time.split(':');

  return instantFromLocal(date, Number(hours) * 60 + Number(minutes), TIME_ZONE).toISOString();
};

describe('Appointments (e2e)', () => {
  let context: TestContext;
  let clinic: TestClinic;
  let fixtures: PatientFixtures;
  const tokens = {} as Record<UserRole, string>;

  let patientId: string;
  let monday: string;

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

    // The clinic opens 09:00–17:00 on Monday, with the timezone the slot
    // arithmetic is expressed in.
    await context.db
      .update(clinics)
      .set({
        workingHours: [{ weekday: 1, ranges: [{ start: '09:00', end: '17:00' }] }],
        settings: { timezone: TIME_ZONE, holidays: [] },
      })
      .where(eq(clinics.id, clinic.id));

    patientId = await createPatient(context, tokens[USER_ROLE.RECEPTIONIST], {
      fullName: 'مريض المواعيد',
      phone: uniquePhone(),
    });

    monday = nextMonday();
  });

  afterAll(async () => {
    await context.close();
  });

  /** Books an appointment as reception and returns the parsed body. */
  async function book(time: string, overrides: Record<string, unknown> = {}) {
    return context.app.inject({
      method: 'POST',
      url: '/appointments',
      headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      payload: {
        patientId,
        doctorId: fixtures.doctorId,
        startsAt: at(monday, time),
        durationMinutes: 30,
        type: 'checkup',
        ...overrides,
      },
    });
  }

  /* ---------------------------------------------------------------------- */

  describe('availability', () => {
    it('offers the working day, and nothing outside it', async () => {
      const response = await context.app.inject({
        method: 'GET',
        url: `/appointments/availability?doctorId=${fixtures.doctorId}&date=${monday}`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as {
        closedReason: string | null;
        slots: { start: string; available: boolean }[];
      };

      expect(body.closedReason).toBeNull();
      expect(body.slots[0]?.start).toBe('09:00');
      // 30 minutes long, so the last start that still fits before 17:00.
      expect(body.slots.at(-1)?.start).toBe('16:30');
    });

    it('says the clinic is closed on a day it does not open', async () => {
      // Tuesday: the clinic's weekly schedule has Monday only.
      const tuesday = localDate(
        new Date(new Date(`${monday}T12:00:00Z`).getTime() + 86_400_000),
        TIME_ZONE,
      );

      const response = await context.app.inject({
        method: 'GET',
        url: `/appointments/availability?doctorId=${fixtures.doctorId}&date=${tuesday}`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      expect((response.json() as { closedReason: string }).closedReason).toBe('clinic_closed');
      expect((response.json() as { slots: unknown[] }).slots).toEqual([]);
    });

    it('closes a holiday even though the weekday is a working one', async () => {
      await context.db
        .update(clinics)
        .set({ settings: { timezone: TIME_ZONE, holidays: [monday] } })
        .where(eq(clinics.id, clinic.id));

      const response = await context.app.inject({
        method: 'GET',
        url: `/appointments/availability?doctorId=${fixtures.doctorId}&date=${monday}`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      expect((response.json() as { closedReason: string }).closedReason).toBe('clinic_closed');

      await context.db
        .update(clinics)
        .set({ settings: { timezone: TIME_ZONE, holidays: [] } })
        .where(eq(clinics.id, clinic.id));
    });

    it('is off when the doctor does not work that weekday', async () => {
      await context.db
        .update(doctors)
        .set({ weeklySchedule: [{ weekday: 3, ranges: [{ start: '09:00', end: '17:00' }] }] })
        .where(eq(doctors.id, fixtures.doctorId));

      const response = await context.app.inject({
        method: 'GET',
        url: `/appointments/availability?doctorId=${fixtures.doctorId}&date=${monday}`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      expect((response.json() as { closedReason: string }).closedReason).toBe('doctor_off');

      await context.db
        .update(doctors)
        .set({ weeklySchedule: [{ weekday: 1, ranges: [{ start: '09:00', end: '17:00' }] }] })
        .where(eq(doctors.id, fixtures.doctorId));
    });

    it('drops a slot once it is booked, and frees it again when cancelled', async () => {
      const created = await book('11:00');
      expect(created.statusCode).toBe(201);
      const id = (created.json() as { id: string }).id;

      const slotAt = async (time: string) => {
        const response = await context.app.inject({
          method: 'GET',
          url: `/appointments/availability?doctorId=${fixtures.doctorId}&date=${monday}`,
          headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
        });

        return (response.json() as { slots: { start: string; available: boolean }[] }).slots.find(
          (slot) => slot.start === time,
        );
      };

      expect((await slotAt('11:00'))?.available).toBe(false);
      // Half-open ranges: an appointment ending at 11:30 does not block 11:30.
      expect((await slotAt('11:30'))?.available).toBe(true);

      await context.app.inject({
        method: 'PATCH',
        url: `/appointments/${id}/cancel`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
        payload: { reason: 'اعتذر المريض' },
      });

      // The SQL constraint and `occupiesSlot` must agree about this.
      expect((await slotAt('11:00'))?.available).toBe(true);
    });

    it('keeps an appointment’s own slot free while it is being rescheduled', async () => {
      const created = await book('15:00');
      const id = (created.json() as { id: string }).id;

      const response = await context.app.inject({
        method: 'GET',
        url: `/appointments/availability?doctorId=${fixtures.doctorId}&date=${monday}&excludeAppointmentId=${id}`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      const slots = (response.json() as { slots: { start: string; available: boolean }[] }).slots;
      expect(slots.find((slot) => slot.start === '15:00')?.available).toBe(true);

      await context.app.inject({
        method: 'PATCH',
        url: `/appointments/${id}/cancel`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
        payload: { reason: 'تنظيف' },
      });
    });
  });

  /* ---------------------------------------------------------------------- */

  describe('double booking', () => {
    it('refuses an overlapping appointment with 409', async () => {
      const first = await book('09:00');
      expect(first.statusCode).toBe(201);

      const overlapping = await book('09:15');
      expect(overlapping.statusCode).toBe(409);

      // Back to back is not an overlap.
      const adjacent = await book('09:30');
      expect(adjacent.statusCode).toBe(201);
    });

    it('holds under two genuinely concurrent inserts', async () => {
      // The check-then-act race a busy front desk actually hits: two people
      // booking the same slot at the same moment. No service-level check can
      // win this — only the exclusion constraint can, which is why the test
      // fires both requests before awaiting either.
      const bothAtOnce = await Promise.all([book('13:00'), book('13:00')]);

      const codes = bothAtOnce.map((response) => response.statusCode).sort();

      expect(codes).toEqual([201, 409]);
    });

    it('lets a cancelled appointment’s slot be rebooked', async () => {
      const first = await book('10:00');
      const id = (first.json() as { id: string }).id;

      expect((await book('10:00')).statusCode).toBe(409);

      await context.app.inject({
        method: 'PATCH',
        url: `/appointments/${id}/cancel`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
        payload: { reason: 'تغيير موعد' },
      });

      expect((await book('10:00')).statusCode).toBe(201);
    });
  });

  /* ---------------------------------------------------------------------- */

  describe('status transitions', () => {
    it('walks confirmed → arrived → in progress → completed', async () => {
      const created = await book('14:00');
      const id = (created.json() as { id: string }).id;

      const move = (step: string) =>
        context.app.inject({
          method: 'PATCH',
          url: `/appointments/${id}/${step}`,
          headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
        });

      expect((await move('arrived')).statusCode).toBe(200);
      expect((await move('start')).statusCode).toBe(200);

      const completed = await move('complete');
      expect(completed.statusCode).toBe(200);
      expect((completed.json() as { status: string }).status).toBe(APPOINTMENT_STATUS.COMPLETED);
    });

    it('refuses completing an appointment nobody turned up to', async () => {
      const created = await book('14:30');
      const id = (created.json() as { id: string }).id;

      // confirmed → completed would let a no-show be marked as seen.
      const response = await context.app.inject({
        method: 'PATCH',
        url: `/appointments/${id}/complete`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      expect(response.statusCode).toBe(400);
    });

    it('will not move an appointment out of a terminal state', async () => {
      const created = await book('16:00');
      const id = (created.json() as { id: string }).id;

      await context.app.inject({
        method: 'PATCH',
        url: `/appointments/${id}/no-show`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      const response = await context.app.inject({
        method: 'PATCH',
        url: `/appointments/${id}/arrived`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      expect(response.statusCode).toBe(400);
    });

    it('requires a reason to cancel', async () => {
      const created = await book('16:30');
      const id = (created.json() as { id: string }).id;

      const empty = await context.app.inject({
        method: 'PATCH',
        url: `/appointments/${id}/cancel`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
        payload: { reason: '' },
      });

      expect(empty.statusCode).toBe(400);

      const withReason = await context.app.inject({
        method: 'PATCH',
        url: `/appointments/${id}/cancel`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
        payload: { reason: 'المريض في السفر' },
      });

      expect(withReason.statusCode).toBe(200);
      expect((withReason.json() as { cancelledReason: string }).cancelledReason).toBe(
        'المريض في السفر',
      );
    });
  });

  /* ---------------------------------------------------------------------- */

  describe('convert to visit', () => {
    it('creates the visit and links both records', async () => {
      const created = await book('12:00', { reason: 'ألم في الضرس' });
      const id = (created.json() as { id: string }).id;

      await context.app.inject({
        method: 'PATCH',
        url: `/appointments/${id}/arrived`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      const response = await context.app.inject({
        method: 'POST',
        url: `/appointments/${id}/visit`,
        headers: auth(tokens[USER_ROLE.DOCTOR]),
      });

      expect(response.statusCode).toBe(201);
      const visit = response.json() as { id: string; patientId: string; complaint: string };

      expect(visit.patientId).toBe(patientId);
      // The reason travels into the visit as the complaint, so the doctor does
      // not retype what reception already wrote down.
      expect(visit.complaint).toBe('ألم في الضرس');

      const [row] = await context.db
        .select({ visitId: appointments.visitId, status: appointments.status })
        .from(appointments)
        .where(eq(appointments.id, id));

      expect(row?.visitId).toBe(visit.id);
      expect(row?.status).toBe(APPOINTMENT_STATUS.IN_PROGRESS);
    });

    it('refuses a second visit for one attendance', async () => {
      const created = await book('12:30');
      const id = (created.json() as { id: string }).id;

      await context.app.inject({
        method: 'PATCH',
        url: `/appointments/${id}/arrived`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      const first = await context.app.inject({
        method: 'POST',
        url: `/appointments/${id}/visit`,
        headers: auth(tokens[USER_ROLE.DOCTOR]),
      });
      expect(first.statusCode).toBe(201);

      const second = await context.app.inject({
        method: 'POST',
        url: `/appointments/${id}/visit`,
        headers: auth(tokens[USER_ROLE.DOCTOR]),
      });
      expect(second.statusCode).toBe(400);
    });

    it('refuses opening a visit before the patient has arrived', async () => {
      const created = await book('15:30');
      const id = (created.json() as { id: string }).id;

      const response = await context.app.inject({
        method: 'POST',
        url: `/appointments/${id}/visit`,
        headers: auth(tokens[USER_ROLE.DOCTOR]),
      });

      expect(response.statusCode).toBe(400);
    });
  });

  /* ---------------------------------------------------------------------- */

  describe('calendar feed', () => {
    it('returns the day, with the names a block has to draw', async () => {
      const response = await context.app.inject({
        method: 'GET',
        url: `/appointments/calendar?date=${monday}&range=day`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as {
        from: string;
        appointments: { patientName: string; doctorName: string; endsAt: string }[];
      };

      expect(body.from).toBe(monday);
      expect(body.appointments.length).toBeGreaterThan(0);
      expect(body.appointments[0]?.patientName).toBe('مريض المواعيد');
      expect(body.appointments[0]?.doctorName).toBeTruthy();
      // `endsAt` is derived, never stored.
      expect(body.appointments[0]?.endsAt).toBeTruthy();
    });

    it('snaps a week to its Sunday and covers seven days', async () => {
      const response = await context.app.inject({
        method: 'GET',
        url: `/appointments/calendar?date=${monday}&range=week`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      const { from, to } = response.json() as { from: string; to: string };

      expect(new Date(`${from}T00:00:00Z`).getUTCDay()).toBe(0);
      expect(
        (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) /
          86_400_000,
      ).toBe(7);
    });
  });
});
