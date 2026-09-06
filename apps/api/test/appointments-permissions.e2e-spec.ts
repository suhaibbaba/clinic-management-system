import {
  USER_ROLE,
  addDays,
  instantFromLocal,
  localDate,
  localWeekday,
  type UserRole,
} from '@clinic/shared';
import { eq } from 'drizzle-orm';

import { clinics, users } from '@api/database/schema';
import {
  createPatient,
  seedClinicFixtures,
  uniquePhone,
  type PatientFixtures,
} from '@test/helpers/patient-fixtures';
import { auth, createTestContext, type TestClinic, type TestContext } from '@test/helpers/test-app';

const TIME_ZONE = 'Asia/Damascus';

/**
 * The next Monday **in the clinic's own zone**.
 *
 * Stepping a UTC date forward is wrong for three hours out of every day: at
 * 22:00 UTC on a Sunday it is already Monday in Damascus, so "one day ahead"
 * lands on Tuesday and the fixture schedule does not apply — which turned this
 * whole suite red every evening. Walking local dates is right at every hour.
 */
function nextMonday(): string {
  let date = localDate(new Date(), TIME_ZONE);

  do {
    date = addDays(date, 1);
  } while (localWeekday(date, TIME_ZONE) !== 1);

  return date;
}

/**
 * The ROLES.md appointments matrix, one request per cell that matters.
 *
 * | Resource     | admin | doctor    | technician | receptionist |
 * | Calendar     | R     | R (own)   | R          | R            |
 * | Appointments | CRUD  | CRU (own) | —          | CRUD         |
 * | Waiting list | CRUD  | R         | —          | CRUD         |
 *
 * "Own" is an object-level rule, so it is asserted against a second doctor's
 * calendar rather than against a role.
 */
describe('Appointments permission boundaries (e2e)', () => {
  let context: TestContext;
  let clinic: TestClinic;
  let fixtures: PatientFixtures;
  const tokens = {} as Record<UserRole, string>;

  let patientId: string;
  let monday: string;
  let ownAppointmentId: string;
  let otherDoctorId: string;
  let otherDoctorAppointmentId: string;

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
        workingHours: [{ weekday: 1, ranges: [{ start: '09:00', end: '17:00' }] }],
        settings: { timezone: TIME_ZONE, holidays: [] },
      })
      .where(eq(clinics.id, clinic.id));

    patientId = await createPatient(context, tokens[USER_ROLE.RECEPTIONIST], {
      fullName: 'مريض الصلاحيات',
      phone: uniquePhone(),
    });

    monday = nextMonday();

    // A second doctor, purely so there is a calendar the logged-in doctor does
    // not own. Its user account is inserted rather than created through the
    // API because a doctor profile may only link a user whose role is doctor,
    // and the test clinic ships exactly one of those.
    const [secondDoctorUser] = await context.db
      .insert(users)
      .values({
        clinicId: clinic.id,
        name: 'طبيب آخر',
        phone: uniquePhone(),
        passwordHash: 'unused — this account never signs in',
        role: USER_ROLE.DOCTOR,
      })
      .returning({ id: users.id });

    const otherDoctor = await context.app.inject({
      method: 'POST',
      url: '/doctors',
      headers: auth(tokens[USER_ROLE.ADMIN]),
      payload: {
        userId: secondDoctorUser?.id,
        specialtyId: clinic.specialtyId,
        weeklySchedule: [{ weekday: 1, ranges: [{ start: '09:00', end: '17:00' }] }],
        defaultAppointmentDurationMinutes: 30,
      },
    });

    if (otherDoctor.statusCode !== 201) {
      throw new Error(`Failed to create the second doctor: ${otherDoctor.body}`);
    }

    otherDoctorId = (otherDoctor.json() as { id: string }).id;

    ownAppointmentId = await bookAs(USER_ROLE.RECEPTIONIST, fixtures.doctorId, '09:00');
    otherDoctorAppointmentId = await bookAs(USER_ROLE.RECEPTIONIST, otherDoctorId, '09:00');
  });

  afterAll(async () => {
    await context.close();
  });

  async function bookAs(role: UserRole, doctorId: string, time: string): Promise<string> {
    const [hours = '0', minutes = '0'] = time.split(':');
    const response = await context.app.inject({
      method: 'POST',
      url: '/appointments',
      headers: auth(tokens[role]),
      payload: {
        patientId,
        doctorId,
        startsAt: instantFromLocal(
          monday,
          Number(hours) * 60 + Number(minutes),
          TIME_ZONE,
        ).toISOString(),
        durationMinutes: 30,
        type: 'checkup',
      },
    });

    if (response.statusCode !== 201) {
      throw new Error(`Failed to book: ${response.statusCode} ${response.body}`);
    }

    return (response.json() as { id: string }).id;
  }

  /* ---------------------------------------------------------------------- */

  describe('reading the calendar', () => {
    it.each([USER_ROLE.ADMIN, USER_ROLE.DOCTOR, USER_ROLE.RECEPTIONIST, USER_ROLE.TECHNICIAN])(
      'is open to %s',
      async (role) => {
        const response = await context.app.inject({
          method: 'GET',
          url: `/appointments/calendar?date=${monday}&range=day`,
          headers: auth(tokens[role]),
        });

        expect(response.statusCode).toBe(200);
      },
    );

    it('carries no clinical or financial field', async () => {
      // A receptionist reads the same feed a doctor does, which is only
      // acceptable because a block holds nothing they may not see.
      const response = await context.app.inject({
        method: 'GET',
        url: `/appointments/calendar?date=${monday}&range=day`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      const [first] = (response.json() as { appointments: Record<string, unknown>[] }).appointments;

      expect(first).toBeDefined();
      for (const forbidden of [
        'diagnosis',
        'examination',
        'balance',
        'allergies',
        'notes.medical',
      ]) {
        expect(first).not.toHaveProperty(forbidden);
      }
    });
  });

  describe('writing appointments', () => {
    it('refuses a technician creating one', async () => {
      const response = await context.app.inject({
        method: 'POST',
        url: '/appointments',
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
        payload: {
          patientId,
          doctorId: fixtures.doctorId,
          startsAt: instantFromLocal(monday, 10 * 60, TIME_ZONE).toISOString(),
          durationMinutes: 30,
          type: 'checkup',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('refuses a technician moving one', async () => {
      const response = await context.app.inject({
        method: 'PATCH',
        url: `/appointments/${ownAppointmentId}`,
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
        payload: { durationMinutes: 45 },
      });

      expect(response.statusCode).toBe(403);
    });

    it('lets a doctor manage their own calendar', async () => {
      const response = await context.app.inject({
        method: 'PATCH',
        url: `/appointments/${ownAppointmentId}`,
        headers: auth(tokens[USER_ROLE.DOCTOR]),
        payload: { reason: 'مراجعة' },
      });

      expect(response.statusCode).toBe(200);
    });

    it('refuses a doctor touching another doctor’s calendar', async () => {
      const response = await context.app.inject({
        method: 'PATCH',
        url: `/appointments/${otherDoctorAppointmentId}`,
        headers: auth(tokens[USER_ROLE.DOCTOR]),
        payload: { reason: 'ليس لي' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('refuses a doctor booking into another doctor’s calendar', async () => {
      const response = await context.app.inject({
        method: 'POST',
        url: '/appointments',
        headers: auth(tokens[USER_ROLE.DOCTOR]),
        payload: {
          patientId,
          doctorId: otherDoctorId,
          startsAt: instantFromLocal(monday, 11 * 60, TIME_ZONE).toISOString(),
          durationMinutes: 30,
          type: 'checkup',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('refuses a doctor changing the status on another doctor’s appointment', async () => {
      const response = await context.app.inject({
        method: 'PATCH',
        url: `/appointments/${otherDoctorAppointmentId}/arrived`,
        headers: auth(tokens[USER_ROLE.DOCTOR]),
      });

      expect(response.statusCode).toBe(403);
    });

    it('lets only an admin delete — nothing is hard-deleted by anyone', async () => {
      const receptionist = await context.app.inject({
        method: 'DELETE',
        url: `/appointments/${ownAppointmentId}`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      expect(receptionist.statusCode).toBe(403);

      const admin = await context.app.inject({
        method: 'DELETE',
        url: `/appointments/${ownAppointmentId}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });

      expect(admin.statusCode).toBe(204);

      // Soft delete: gone from the API, still in the table.
      const afterwards = await context.app.inject({
        method: 'GET',
        url: `/appointments/${ownAppointmentId}`,
        headers: auth(tokens[USER_ROLE.ADMIN]),
      });

      expect(afterwards.statusCode).toBe(404);
    });
  });

  describe('convert to visit', () => {
    it('refuses a receptionist — a visit is a clinical record', async () => {
      const id = await bookAs(USER_ROLE.RECEPTIONIST, fixtures.doctorId, '13:00');

      await context.app.inject({
        method: 'PATCH',
        url: `/appointments/${id}/arrived`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      const response = await context.app.inject({
        method: 'POST',
        url: `/appointments/${id}/visit`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('waiting list', () => {
    let entryId: string;

    beforeAll(async () => {
      const response = await context.app.inject({
        method: 'POST',
        url: '/waiting-list',
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
        payload: { patientId, priority: 'high', reason: 'ألم شديد' },
      });

      entryId = (response.json() as { id: string }).id;
    });

    it('is readable by a doctor but not writable', async () => {
      const read = await context.app.inject({
        method: 'GET',
        url: '/waiting-list',
        headers: auth(tokens[USER_ROLE.DOCTOR]),
      });
      expect(read.statusCode).toBe(200);

      const write = await context.app.inject({
        method: 'POST',
        url: '/waiting-list',
        headers: auth(tokens[USER_ROLE.DOCTOR]),
        payload: { patientId, priority: 'normal' },
      });
      expect(write.statusCode).toBe(403);
    });

    it('is closed to a technician entirely', async () => {
      const response = await context.app.inject({
        method: 'GET',
        url: '/waiting-list',
        headers: auth(tokens[USER_ROLE.TECHNICIAN]),
      });

      expect(response.statusCode).toBe(403);
    });

    it('promotes an entry into a booking and closes it', async () => {
      const response = await context.app.inject({
        method: 'POST',
        url: `/waiting-list/${entryId}/promote`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
        payload: {
          doctorId: fixtures.doctorId,
          startsAt: instantFromLocal(monday, 14 * 60, TIME_ZONE).toISOString(),
          durationMinutes: 30,
        },
      });

      expect(response.statusCode).toBe(201);
      const entry = response.json() as { resolvedAt: string | null; appointmentId: string | null };

      expect(entry.resolvedAt).not.toBeNull();
      expect(entry.appointmentId).not.toBeNull();
    });

    it('leaves the entry open when the slot was taken while they waited', async () => {
      const created = await context.app.inject({
        method: 'POST',
        url: '/waiting-list',
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
        payload: { patientId, priority: 'normal' },
      });
      const id = (created.json() as { id: string }).id;

      // 14:00 was just taken by the promotion above.
      const response = await context.app.inject({
        method: 'POST',
        url: `/waiting-list/${id}/promote`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
        payload: {
          doctorId: fixtures.doctorId,
          startsAt: instantFromLocal(monday, 14 * 60, TIME_ZONE).toISOString(),
          durationMinutes: 30,
        },
      });

      expect(response.statusCode).toBe(409);

      const still = await context.app.inject({
        method: 'GET',
        url: `/waiting-list/${id}`,
        headers: auth(tokens[USER_ROLE.RECEPTIONIST]),
      });

      // They are still waiting, which is the correct outcome.
      expect((still.json() as { resolvedAt: string | null }).resolvedAt).toBeNull();
    });
  });

  describe('cross-clinic', () => {
    it('reports another clinic’s appointment as 404, never 403', async () => {
      const other = await context.createClinic();
      const otherAdmin = await context.login(other.phones[USER_ROLE.ADMIN]);

      const response = await context.app.inject({
        method: 'GET',
        url: `/appointments/${otherDoctorAppointmentId}`,
        headers: auth(otherAdmin),
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
