import {
  addDays,
  APPOINTMENT_STATUS,
  BOOKING_CONFIRMATION_MODE,
  instantFromLocal,
  localDate,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_TEMPLATE,
  USER_ROLE,
} from '@clinic/shared';
import { and, desc, eq, sql } from 'drizzle-orm';

import { hashCode } from '@api/booking/booking.service';
import {
  appointments,
  bookingOtps,
  clinics,
  notificationsLog,
  patients,
} from '@api/database/schema';
import {
  createPatient,
  seedClinicFixtures,
  uniquePhone,
  type PatientFixtures,
} from '@test/helpers/patient-fixtures';
import { auth, createTestContext, type TestClinic, type TestContext } from '@test/helpers/test-app';

const TIME_ZONE = 'Asia/Damascus';

/** The clinic opens 09:00–17:00, and every booking here is 30 minutes long. */
const FIRST_SLOT_MINUTE = 9 * 60;
const SLOTS_PER_DAY = 16;

/** The next Monday, so the fixture schedule (Monday 09:00–17:00) applies. */
function nextMonday(): string {
  const today = new Date();
  const shift = (8 - today.getUTCDay()) % 7 || 7;

  return localDate(new Date(today.getTime() + shift * 86_400_000), TIME_ZONE);
}

const localDateOf = (startsAt: string): string => localDate(new Date(startsAt), TIME_ZONE);

/** The appointment a signed token stands for, so a test can look it up. */
const appointmentIdOf = (token: string): string =>
  Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8');

describe('Public booking (e2e)', () => {
  let context: TestContext;
  let clinic: TestClinic;
  let fixtures: PatientFixtures;
  let adminToken: string;
  let receptionToken: string;
  let doctorToken: string;
  let mondays: string[];

  /**
   * A slot nobody has taken yet.
   *
   * Every booking needs its own: the overlap constraint is real, and a suite
   * that reused 09:00 would be testing conflict handling by accident. Four
   * Mondays of half-hours is more than the suite gets through.
   */
  let cursor = 0;
  const freeSlot = (): string => {
    const index = cursor;
    cursor += 1;

    const day = mondays[Math.floor(index / SLOTS_PER_DAY)];

    if (!day) {
      throw new Error('The suite has run out of free slots — add another Monday');
    }

    return instantFromLocal(
      day,
      FIRST_SLOT_MINUTE + (index % SLOTS_PER_DAY) * 30,
      TIME_ZONE,
    ).toISOString();
  };

  const bookingSettings = {
    enabled: true,
    // Wide enough to cover the four Mondays the slot allocator walks through.
    maxDaysAhead: 45,
    minHoursBefore: 2,
    confirmationMode: BOOKING_CONFIRMATION_MODE.OTP,
    holdMinutes: 15,
    maxActivePerPhone: 3,
  };

  const settings = (overrides: Record<string, unknown> = {}) => ({
    timezone: TIME_ZONE,
    holidays: [] as string[],
    booking: { ...bookingSettings, ...overrides },
    notifications: {
      enabled: true,
      channel: NOTIFICATION_CHANNEL.SMS,
      remind24h: true,
      remind2h: true,
      templates: {},
    },
  });

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();

    adminToken = await context.login(clinic.phones[USER_ROLE.ADMIN]);
    receptionToken = await context.login(clinic.phones[USER_ROLE.RECEPTIONIST]);
    doctorToken = await context.login(clinic.phones[USER_ROLE.DOCTOR]);

    fixtures = await seedClinicFixtures(context, clinic, adminToken);

    await context.db
      .update(clinics)
      .set({
        workingHours: [{ weekday: 1, ranges: [{ start: '09:00', end: '17:00' }] }],
        settings: settings(),
      })
      .where(eq(clinics.id, clinic.id));

    const first = nextMonday();
    mondays = [first, addDays(first, 7), addDays(first, 14), addDays(first, 21)];
  });

  afterAll(async () => {
    await context.close();
  });

  beforeEach(() => {
    // Five bookings a minute is the right limit for the internet and far too
    // few for a suite; the throttling test is the one that lets it add up.
    context.resetThrottle();
  });

  /* ---------------------------------------------------------------------- */
  /* Helpers                                                                 */
  /* ---------------------------------------------------------------------- */

  function book(payload: Record<string, unknown> = {}) {
    return context.app.inject({
      method: 'POST',
      url: `/public/booking/${clinic.slug}`,
      payload: {
        fullName: 'زائر الحجز',
        phone: uniquePhone(),
        doctorId: fixtures.doctorId,
        startsAt: freeSlot(),
        ...payload,
      },
    });
  }

  /** The six digits that went out by SMS, read back from the log. */
  async function issuedCode(appointmentId: string): Promise<string> {
    const [row] = await context.db
      .select({ vars: notificationsLog.vars })
      .from(notificationsLog)
      .where(
        and(
          eq(notificationsLog.appointmentId, appointmentId),
          eq(notificationsLog.template, NOTIFICATION_TEMPLATE.BOOKING_OTP),
        ),
      )
      .orderBy(desc(notificationsLog.createdAt))
      .limit(1);

    const code = row?.vars['code'];

    if (!code) {
      throw new Error(`No OTP was sent for appointment ${appointmentId}`);
    }

    return code;
  }

  const verify = (token: string, code: string) =>
    context.app.inject({
      method: 'POST',
      url: `/public/booking/${clinic.slug}/verify-otp`,
      payload: { token, code },
    });

  /** A booked, unconfirmed appointment, and the token that manages it. */
  async function held(payload: Record<string, unknown> = {}): Promise<string> {
    const response = await book(payload);

    expect(response.statusCode).toBe(201);

    return (response.json() as { token: string }).token;
  }

  /** A booking carried all the way through its OTP. */
  async function confirmed(payload: Record<string, unknown> = {}): Promise<string> {
    const token = await held(payload);
    const response = await verify(token, await issuedCode(appointmentIdOf(token)));

    expect(response.statusCode).toBe(200);

    return token;
  }

  /* ---------------------------------------------------------------------- */
  /* Public reads                                                            */
  /* ---------------------------------------------------------------------- */

  describe('reads', () => {
    it('describes the clinic without needing a token', async () => {
      const response = await context.app.inject({
        method: 'GET',
        url: `/public/booking/${clinic.slug}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        slug: clinic.slug,
        bookingEnabled: true,
        confirmationMode: BOOKING_CONFIRMATION_MODE.OTP,
      });
    });

    it('does not exist for an unknown clinic', async () => {
      const response = await context.app.inject({
        method: 'GET',
        url: '/public/booking/no-such-clinic',
      });

      expect(response.statusCode).toBe(404);
    });

    it('lists doctors by name and specialty only', async () => {
      const response = await context.app.inject({
        method: 'GET',
        url: `/public/booking/${clinic.slug}/doctors`,
      });

      expect(response.statusCode).toBe(200);
      const [doctor] = response.json() as Record<string, unknown>[];

      expect(Object.keys(doctor ?? {}).sort()).toEqual(['id', 'name', 'specialty']);
      // How the clinic runs is not public: no schedule, no slot length, no user id.
      expect(doctor).not.toHaveProperty('weeklySchedule');
      expect(doctor).not.toHaveProperty('userId');
    });

    it('offers free slots only, and drops one once it is taken', async () => {
      const startsAt = freeSlot();
      const url = `/public/booking/${clinic.slug}/slots?doctorId=${fixtures.doctorId}&date=${localDateOf(startsAt)}`;

      const before = await context.app.inject({ method: 'GET', url });

      expect(before.statusCode).toBe(200);
      const offered = (before.json() as { slots: Record<string, unknown>[] }).slots;

      expect(offered.map((slot) => slot['startsAt'])).toContain(startsAt);
      // A greyed grid would say "somebody else has an appointment at ten".
      expect(offered.every((slot) => !('available' in slot))).toBe(true);

      await book({ startsAt });

      const after = await context.app.inject({ method: 'GET', url });

      expect(
        (after.json() as { slots: { startsAt: string }[] }).slots.map((slot) => slot.startsAt),
      ).not.toContain(startsAt);
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Booking and OTP                                                         */
  /* ---------------------------------------------------------------------- */

  describe('booking', () => {
    it('holds the slot and answers with nothing about the patient', async () => {
      const response = await book();

      expect(response.statusCode).toBe(201);
      const receipt = response.json() as Record<string, unknown>;

      expect(Object.keys(receipt).sort()).toEqual([
        'holdExpiresAt',
        'otpExpiresInSeconds',
        'status',
        'token',
      ]);
      expect(receipt['status']).toBe('pending_otp');
      expect(receipt['otpExpiresInSeconds']).toBe(300);

      const [appointment] = await context.db
        .select({ status: appointments.status })
        .from(appointments)
        .where(eq(appointments.id, appointmentIdOf(receipt['token'] as string)));

      expect(appointment?.status).toBe(APPOINTMENT_STATUS.REQUESTED);
    });

    it('stores the code as a digest, never as the code', async () => {
      const token = await held();
      const appointmentId = appointmentIdOf(token);
      const code = await issuedCode(appointmentId);

      const [otp] = await context.db
        .select()
        .from(bookingOtps)
        .where(eq(bookingOtps.appointmentId, appointmentId));

      expect(code).toMatch(/^\d{6}$/);
      expect(otp?.codeHash).not.toBe(code);
      expect(otp?.codeHash).not.toContain(code);
      expect(otp?.codeHash).toBe(hashCode(code));
    });

    it('confirms the appointment when the code is right', async () => {
      const token = await held();
      const appointmentId = appointmentIdOf(token);

      const response = await verify(token, await issuedCode(appointmentId));

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        status: APPOINTMENT_STATUS.CONFIRMED,
        canModify: true,
      });

      const [otp] = await context.db
        .select({ consumedAt: bookingOtps.consumedAt })
        .from(bookingOtps)
        .where(eq(bookingOtps.appointmentId, appointmentId));

      expect(otp?.consumedAt).not.toBeNull();

      const [sent] = await context.db
        .select({ id: notificationsLog.id })
        .from(notificationsLog)
        .where(
          and(
            eq(notificationsLog.appointmentId, appointmentId),
            eq(notificationsLog.template, NOTIFICATION_TEMPLATE.BOOKING_CONFIRMED),
          ),
        );

      expect(sent).toBeDefined();
    });

    it('spends the code, so a replay does not confirm twice', async () => {
      const token = await held();
      const code = await issuedCode(appointmentIdOf(token));

      expect((await verify(token, code)).statusCode).toBe(200);
      expect((await verify(token, code)).statusCode).toBe(401);
    });

    it('burns the code after three wrong guesses', async () => {
      const token = await held();
      const appointmentId = appointmentIdOf(token);
      const code = await issuedCode(appointmentId);
      const wrong = code === '000000' ? '111111' : '000000';

      for (let attempt = 0; attempt < 3; attempt += 1) {
        expect((await verify(token, wrong)).statusCode).toBe(401);
      }

      // The right code no longer helps: three guesses is the whole budget.
      expect((await verify(token, code)).statusCode).toBe(401);

      const [appointment] = await context.db
        .select({ status: appointments.status })
        .from(appointments)
        .where(eq(appointments.id, appointmentId));

      expect(appointment?.status).toBe(APPOINTMENT_STATUS.REQUESTED);
    });

    it('rejects a code that has expired, in the same words as a wrong one', async () => {
      const token = await held();
      const appointmentId = appointmentIdOf(token);
      const code = await issuedCode(appointmentId);

      await context.db
        .update(bookingOtps)
        .set({ expiresAt: new Date(Date.now() - 1_000) })
        .where(eq(bookingOtps.appointmentId, appointmentId));

      const response = await verify(token, code);

      expect(response.statusCode).toBe(401);
      // "Expired" told apart from "wrong" says a code was once issued for this
      // booking, which is a fact about somebody else's appointment.
      expect((response.json() as { message: string }).message).toBe('That code is not valid');
    });

    it('refuses a slot that was taken a moment ago', async () => {
      const startsAt = freeSlot();

      expect((await book({ startsAt })).statusCode).toBe(201);

      const second = await book({ startsAt });

      expect(second.statusCode).toBe(400);
      expect((second.json() as { message: string }).message).toBe(
        'That time is no longer available',
      );
    });

    it('refuses a time the clinic does not open at all', async () => {
      const midnight = instantFromLocal(mondays[0] ?? '', 3 * 60, TIME_ZONE).toISOString();

      const response = await book({ startsAt: midnight });

      expect(response.statusCode).toBe(400);
      expect((response.json() as { message: string }).message).toBe('That time is not offered');
    });

    it('holds the booking window at both ends', async () => {
      const tooSoon = await book({ startsAt: new Date(Date.now() + 30 * 60_000).toISOString() });
      const tooFar = await book({
        startsAt: new Date(Date.now() + 120 * 86_400_000).toISOString(),
      });

      expect(tooSoon.statusCode).toBe(400);
      expect(tooFar.statusCode).toBe(400);
    });

    it('is not there at all when the clinic has booking switched off', async () => {
      await context.db
        .update(clinics)
        .set({ settings: settings({ enabled: false }) })
        .where(eq(clinics.id, clinic.id));

      const read = await context.app.inject({
        method: 'GET',
        url: `/public/booking/${clinic.slug}/doctors`,
      });
      const write = await book();

      expect(read.statusCode).toBe(404);
      expect(write.statusCode).toBe(404);

      await context.db
        .update(clinics)
        .set({ settings: settings() })
        .where(eq(clinics.id, clinic.id));
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Enumeration                                                             */
  /* ---------------------------------------------------------------------- */

  describe('phone enumeration', () => {
    it('answers a known number exactly as it answers a stranger', async () => {
      const known = uniquePhone();

      await createPatient(context, receptionToken, {
        fullName: 'مريض مسجل',
        phone: known,
      });

      const first = await book({ phone: known, fullName: 'مريض مسجل' });
      const second = await book({ phone: uniquePhone(), fullName: 'زائر جديد' });

      const one = first.json() as Record<string, unknown>;
      const two = second.json() as Record<string, unknown>;

      expect(first.statusCode).toBe(second.statusCode);
      expect(Object.keys(one).sort()).toEqual(Object.keys(two).sort());
      expect(one['status']).toBe(two['status']);
      expect(one['otpExpiresInSeconds']).toBe(two['otpExpiresInSeconds']);
    });

    it('links a known number instead of creating a second record', async () => {
      const known = uniquePhone();
      const digits = known.replaceAll(/[^\d]/g, '');

      const patientId = await createPatient(context, receptionToken, {
        fullName: 'مريض قديم',
        phone: known,
      });

      const token = await held({ phone: known, fullName: 'اسم مختلف تماماً' });

      const [appointment] = await context.db
        .select({ patientId: appointments.patientId })
        .from(appointments)
        .where(eq(appointments.id, appointmentIdOf(token)));

      expect(appointment?.patientId).toBe(patientId);

      const rows = await context.db
        .select({ id: patients.id, fullName: patients.fullName })
        .from(patients)
        .where(
          and(
            eq(patients.clinicId, clinic.id),
            sql`regexp_replace(${patients.phone}, '[^0-9]', '', 'g') = ${digits}`,
          ),
        );

      expect(rows).toHaveLength(1);
      // A stranger typing a name against someone else's number must not rename
      // that patient.
      expect(rows[0]?.fullName).toBe('مريض قديم');
    });

    it('flags a record it created itself, and attributes it to nobody', async () => {
      const token = await held({ fullName: 'زائر مجهول' });

      const [row] = await context.db
        .select({ notes: patients.notes, createdBy: patients.createdBy })
        .from(appointments)
        .innerJoin(patients, eq(patients.id, appointments.patientId))
        .where(eq(appointments.id, appointmentIdOf(token)));

      expect(row?.createdBy).toBeNull();
      expect(row?.notes).toContain('الحجز الإلكتروني');
    });

    it('caps live bookings per number, in the same words as a closed page', async () => {
      const phone = uniquePhone();

      for (let index = 0; index < 3; index += 1) {
        expect((await book({ phone })).statusCode).toBe(201);
      }

      const fourth = await book({ phone });

      expect(fourth.statusCode).toBe(403);
      expect((fourth.json() as { message: string }).message).toBe(
        'Booking is not available right now',
      );
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Manage link                                                             */
  /* ---------------------------------------------------------------------- */

  describe('manage link', () => {
    it('shows the booking, and nothing clinical or financial, to whoever holds it', async () => {
      const token = await confirmed();

      const response = await context.app.inject({
        method: 'GET',
        url: `/public/booking/manage/${token}`,
      });

      expect(response.statusCode).toBe(200);

      expect(Object.keys(response.json() as object).sort()).toEqual([
        'canModify',
        'clinicName',
        'clinicPhone',
        'doctorName',
        'durationMinutes',
        'startsAt',
        'status',
      ]);
    });

    it('cannot be guessed, tampered with, or borrowed from another booking', async () => {
      const mine = await held();
      const theirs = await held();
      const [, payload = '', signature = ''] = mine.split('.');

      const rejected = [
        // Another booking's id under this booking's signature.
        `v1.${Buffer.from(appointmentIdOf(theirs)).toString('base64url')}.${signature}`,
        // One character of the signature changed.
        `v1.${payload}.${signature.slice(0, -1)}${signature.at(-1) === 'a' ? 'b' : 'a'}`,
        // Another booking's signature against this booking's payload.
        `v1.${payload}.${theirs.split('.')[2]}`,
        // Nonsense of roughly the right shape.
        'v1.aaaaaaaaaaaa.bbbbbbbbbbbb',
      ];

      for (const token of rejected) {
        const response = await context.app.inject({
          method: 'GET',
          url: `/public/booking/manage/${token}`,
        });

        expect(response.statusCode).toBe(401);
        expect((response.json() as { message: string }).message).toBe('Invalid booking link');
      }
    });

    it('reschedules into a free slot and refuses one that is taken', async () => {
      const token = await confirmed();
      const taken = freeSlot();

      await book({ startsAt: taken });

      const clash = await context.app.inject({
        method: 'POST',
        url: `/public/booking/manage/${token}/reschedule`,
        payload: { startsAt: taken },
      });

      expect(clash.statusCode).toBe(400);

      const moved = freeSlot();
      const response = await context.app.inject({
        method: 'POST',
        url: `/public/booking/manage/${token}/reschedule`,
        payload: { startsAt: moved },
      });

      expect(response.statusCode).toBe(200);
      expect((response.json() as { startsAt: string }).startsAt).toBe(moved);
    });

    it('spends the link on cancellation', async () => {
      const token = await confirmed();

      const cancelled = await context.app.inject({
        method: 'POST',
        url: `/public/booking/manage/${token}/cancel`,
        payload: { reason: 'ظرف طارئ' },
      });

      expect(cancelled.statusCode).toBe(200);
      expect(cancelled.json()).toMatchObject({
        status: APPOINTMENT_STATUS.CANCELLED,
        canModify: false,
      });

      const again = await context.app.inject({
        method: 'POST',
        url: `/public/booking/manage/${token}/cancel`,
        payload: {},
      });
      const reschedule = await context.app.inject({
        method: 'POST',
        url: `/public/booking/manage/${token}/reschedule`,
        payload: { startsAt: freeSlot() },
      });

      expect(again.statusCode).toBe(400);
      expect(reschedule.statusCode).toBe(400);

      // Still readable — the patient may want to see what happened — but the
      // link no longer changes anything.
      const view = await context.app.inject({
        method: 'GET',
        url: `/public/booking/manage/${token}`,
      });

      expect(view.statusCode).toBe(200);
      expect(view.json()).toMatchObject({ status: APPOINTMENT_STATUS.CANCELLED });
    });

    it('tells the patient the booking was cancelled', async () => {
      const token = await confirmed();

      await context.app.inject({
        method: 'POST',
        url: `/public/booking/manage/${token}/cancel`,
        payload: {},
      });

      const [sent] = await context.db
        .select({ id: notificationsLog.id })
        .from(notificationsLog)
        .where(
          and(
            eq(notificationsLog.appointmentId, appointmentIdOf(token)),
            eq(notificationsLog.template, NOTIFICATION_TEMPLATE.BOOKING_CANCELLED),
          ),
        );

      expect(sent).toBeDefined();
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Reception's side                                                        */
  /* ---------------------------------------------------------------------- */

  describe('pending confirmations', () => {
    it('lists what strangers booked, for reception and admin only', async () => {
      const appointmentId = appointmentIdOf(await held());

      const forReception = await context.app.inject({
        method: 'GET',
        url: '/appointments/pending-confirmation',
        headers: auth(receptionToken),
      });

      expect(forReception.statusCode).toBe(200);
      const { items } = forReception.json() as { items: { id: string; status: string }[] };

      expect(items.map((item) => item.id)).toContain(appointmentId);
      expect(items.every((item) => item.status === APPOINTMENT_STATUS.REQUESTED)).toBe(true);

      expect(
        (
          await context.app.inject({
            method: 'GET',
            url: '/appointments/pending-confirmation',
            headers: auth(adminToken),
          })
        ).statusCode,
      ).toBe(200);

      // Chasing unconfirmed bookings is front-desk work; a doctor's own
      // calendar already shows the ones that concern them.
      expect(
        (
          await context.app.inject({
            method: 'GET',
            url: '/appointments/pending-confirmation',
            headers: auth(doctorToken),
          })
        ).statusCode,
      ).toBe(403);
    });

    it('needs a token like any internal endpoint', async () => {
      const response = await context.app.inject({
        method: 'GET',
        url: '/appointments/pending-confirmation',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Anti-abuse                                                              */
  /* ---------------------------------------------------------------------- */

  describe('throttling', () => {
    it('cuts off a burst of bookings from one address', async () => {
      const statuses: number[] = [];

      // Fresh phone numbers each time, so it is the address limit that bites
      // and not the per-phone one.
      for (let index = 0; index < 7; index += 1) {
        statuses.push((await book({ phone: uniquePhone() })).statusCode);
      }

      expect(statuses.filter((status) => status === 201)).toHaveLength(5);
      expect(statuses.at(-1)).toBe(429);
    });
  });
});
