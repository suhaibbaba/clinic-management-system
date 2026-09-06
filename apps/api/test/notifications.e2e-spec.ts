import {
  APPOINTMENT_STATUS,
  BOOKING_CONFIRMATION_MODE,
  DEFAULT_NOTIFICATION_TEMPLATES,
  instantFromLocal,
  localDate,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_STATUS,
  NOTIFICATION_TEMPLATE,
  USER_ROLE,
} from '@clinic/shared';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { appointments, clinics, doctors, notificationsLog, users } from '@api/database/schema';
import {
  NOTIFICATION_PROVIDER,
  type NotificationProvider,
} from '@api/notifications/notification-provider';
import { NotificationsService } from '@api/notifications/notifications.service';
import { RemindersScheduler } from '@api/notifications/reminders.scheduler';
import {
  createPatient,
  seedClinicFixtures,
  uniquePhone,
  type PatientFixtures,
} from '@test/helpers/patient-fixtures';
import { createTestContext, type TestClinic, type TestContext } from '@test/helpers/test-app';

const TIME_ZONE = 'Asia/Damascus';
const HOUR = 3_600_000;
const MINUTE = 60_000;

/** The next Monday, the one day the fixture doctor works. */
function nextMonday(): string {
  const today = new Date();
  const shift = (8 - today.getUTCDay()) % 7 || 7;

  return localDate(new Date(today.getTime() + shift * 86_400_000), TIME_ZONE);
}

describe('Notifications and schedulers (e2e)', () => {
  let context: TestContext;
  let clinic: TestClinic;
  let fixtures: PatientFixtures;
  let scheduler: RemindersScheduler;
  let notifications: NotificationsService;
  let provider: NotificationProvider;
  let patientId: string;
  let monday: string;

  /** Every appointment inserted here needs its own time; the constraint is real. */
  let slotCursor = 0;
  const nextSlot = (): string => {
    slotCursor += 1;

    return instantFromLocal(monday, 9 * 60 + slotCursor * 30, TIME_ZONE).toISOString();
  };

  const settings = (overrides: Record<string, unknown> = {}) => ({
    timezone: TIME_ZONE,
    holidays: [] as string[],
    booking: {
      enabled: true,
      maxDaysAhead: 45,
      minHoursBefore: 2,
      confirmationMode: BOOKING_CONFIRMATION_MODE.OTP,
      holdMinutes: 15,
      maxActivePerPhone: 3,
    },
    notifications: {
      enabled: true,
      channel: NOTIFICATION_CHANNEL.SMS,
      remind24h: true,
      remind2h: true,
      templates: {},
      ...overrides,
    },
  });

  /**
   * Another doctor in the same clinic.
   *
   * The reminder window is ten minutes wide, so two appointments due for the
   * same reminder are minutes apart — which one doctor cannot have, because the
   * overlap constraint is real. A test that needs its own reminder needs its
   * own diary.
   */
  async function createDoctor(): Promise<string> {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 10);

    const [user] = await context.db
      .insert(users)
      .values({
        clinicId: clinic.id,
        name: `Test doctor ${suffix}`,
        phone: `+98${suffix}`,
        email: `doctor.${suffix}@test.local`,
        passwordHash: 'not-a-login',
        role: USER_ROLE.DOCTOR,
      })
      .returning({ id: users.id });

    const [doctor] = await context.db
      .insert(doctors)
      .values({
        clinicId: clinic.id,
        userId: user?.id ?? '',
        specialtyId: clinic.specialtyId,
        weeklySchedule: [{ weekday: 1, ranges: [{ start: '09:00', end: '17:00' }] }],
      })
      .returning({ id: doctors.id });

    if (!doctor) {
      throw new Error('Failed to insert the test doctor');
    }

    return doctor.id;
  }

  /** Puts an appointment straight into the table, at a time the test chooses. */
  async function insertAppointment(values: {
    startsAt: Date;
    doctorId?: string;
    status?: (typeof APPOINTMENT_STATUS)[keyof typeof APPOINTMENT_STATUS];
    createdAt?: Date;
  }): Promise<string> {
    const [row] = await context.db
      .insert(appointments)
      .values({
        clinicId: clinic.id,
        patientId,
        doctorId: values.doctorId ?? fixtures.doctorId,
        startsAt: values.startsAt,
        durationMinutes: 30,
        status: values.status ?? APPOINTMENT_STATUS.CONFIRMED,
        ...(values.createdAt ? { createdAt: values.createdAt } : {}),
      })
      .returning({ id: appointments.id });

    if (!row) {
      throw new Error('Failed to insert the test appointment');
    }

    return row.id;
  }

  /** Every message logged for one appointment. */
  async function logged(appointmentId: string) {
    return context.db
      .select({
        template: notificationsLog.template,
        status: notificationsLog.status,
        to: notificationsLog.to,
        channel: notificationsLog.channel,
        vars: notificationsLog.vars,
        error: notificationsLog.error,
      })
      .from(notificationsLog)
      .where(eq(notificationsLog.appointmentId, appointmentId));
  }

  beforeAll(async () => {
    context = await createTestContext();
    clinic = await context.createClinic();

    const adminToken = await context.login(clinic.phones[USER_ROLE.ADMIN]);
    const receptionToken = await context.login(clinic.phones[USER_ROLE.RECEPTIONIST]);

    fixtures = await seedClinicFixtures(context, clinic, adminToken);
    scheduler = context.app.get(RemindersScheduler);
    notifications = context.app.get(NotificationsService);
    provider = context.app.get<NotificationProvider>(NOTIFICATION_PROVIDER);

    await context.db
      .update(clinics)
      .set({
        workingHours: [{ weekday: 1, ranges: [{ start: '09:00', end: '17:00' }] }],
        settings: settings(),
      })
      .where(eq(clinics.id, clinic.id));

    patientId = await createPatient(context, receptionToken, {
      fullName: 'مريض التذكيرات',
      phone: uniquePhone(),
    });

    monday = nextMonday();
  });

  afterEach(async () => {
    jest.restoreAllMocks();

    await context.db.update(clinics).set({ settings: settings() }).where(eq(clinics.id, clinic.id));
  });

  afterAll(async () => {
    await context.close();
  });

  /* ---------------------------------------------------------------------- */
  /* The service                                                             */
  /* ---------------------------------------------------------------------- */

  describe('sending', () => {
    it('renders the clinic default and logs what went out', async () => {
      const to = uniquePhone();

      const result = await notifications.send({
        clinicId: clinic.id,
        to,
        template: NOTIFICATION_TEMPLATE.BOOKING_OTP,
        vars: { clinic: 'عيادة الاختبار', code: '123456', minutes: '5' },
      });

      expect(result?.status).toBe(NOTIFICATION_STATUS.SENT);
      expect(result?.body).toBe('رمز تأكيد حجزك في عيادة الاختبار هو 123456. صالح لمدة 5 دقائق.');

      const [row] = await context.db
        .select({ status: notificationsLog.status, channel: notificationsLog.channel })
        .from(notificationsLog)
        .where(eq(notificationsLog.id, result?.id ?? ''));

      expect(row?.status).toBe(NOTIFICATION_STATUS.SENT);
      expect(row?.channel).toBe(NOTIFICATION_CHANNEL.SMS);
    });

    it('prefers the clinic wording, and leaves a placeholder it cannot fill', async () => {
      await context.db
        .update(clinics)
        .set({
          settings: settings({
            templates: { [NOTIFICATION_TEMPLATE.REMINDER_2H]: 'موعدك مع {doctor} في {branch}' },
          }),
        })
        .where(eq(clinics.id, clinic.id));

      const result = await notifications.send({
        clinicId: clinic.id,
        to: uniquePhone(),
        template: NOTIFICATION_TEMPLATE.REMINDER_2H,
        vars: { doctor: 'د. سامي' },
      });

      // `{branch}` stays visible: a message reading "في {branch}" is a bug
      // somebody reports, where "في " is a message that looks fine and says
      // nothing.
      expect(result?.body).toBe('موعدك مع د. سامي في {branch}');
    });

    it('records a gateway failure instead of raising it', async () => {
      jest.spyOn(provider, 'send').mockRejectedValue(new Error('gateway unreachable'));

      const result = await notifications.send({
        clinicId: clinic.id,
        to: uniquePhone(),
        template: NOTIFICATION_TEMPLATE.BOOKING_CONFIRMED,
        vars: { clinic: 'عيادة الاختبار' },
      });

      expect(result?.status).toBe(NOTIFICATION_STATUS.FAILED);

      // The row exists because it is written *before* the provider is called:
      // a send that vanishes without a trace is the one failure a notification
      // log exists to prevent.
      const [row] = await context.db
        .select({ status: notificationsLog.status, error: notificationsLog.error })
        .from(notificationsLog)
        .where(eq(notificationsLog.id, result?.id ?? ''));

      expect(row?.status).toBe(NOTIFICATION_STATUS.FAILED);
      expect(row?.error).toBe('gateway unreachable');
    });

    it('sends nothing at all when the clinic has notifications off', async () => {
      await context.db
        .update(clinics)
        .set({ settings: settings({ enabled: false }) })
        .where(eq(clinics.id, clinic.id));

      const before = await context.db.select({ id: notificationsLog.id }).from(notificationsLog);

      const result = await notifications.send({
        clinicId: clinic.id,
        to: uniquePhone(),
        template: NOTIFICATION_TEMPLATE.BOOKING_OTP,
        vars: {},
      });

      const after = await context.db.select({ id: notificationsLog.id }).from(notificationsLog);

      expect(result).toBeNull();
      expect(after).toHaveLength(before.length);
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Reminders                                                               */
  /* ---------------------------------------------------------------------- */

  describe('reminders', () => {
    it('reminds a day and two hours ahead, and never twice', async () => {
      const tomorrow = await insertAppointment({
        startsAt: new Date(Date.now() + 24 * HOUR + 5 * MINUTE),
        doctorId: await createDoctor(),
      });
      const soon = await insertAppointment({
        startsAt: new Date(Date.now() + 2 * HOUR + 5 * MINUTE),
        doctorId: await createDoctor(),
      });

      await scheduler.sendReminders();
      // The job runs every five minutes against a ten-minute window, so it sees
      // the same appointment again on the next tick — and must stay quiet.
      await scheduler.sendReminders();
      await scheduler.sendReminders();

      const forTomorrow = await logged(tomorrow);
      const forSoon = await logged(soon);

      expect(forTomorrow.map((row) => row.template)).toEqual([NOTIFICATION_TEMPLATE.REMINDER_24H]);
      expect(forSoon.map((row) => row.template)).toEqual([NOTIFICATION_TEMPLATE.REMINDER_2H]);
      expect(forTomorrow[0]?.vars['doctor']).toMatch(/^Test doctor/);
      expect(forTomorrow[0]?.vars['time']).toMatch(/^\d{2}:\d{2}$/);
    });

    it('counts a failed reminder as sent, so a dead gateway is not retried forever', async () => {
      const appointmentId = await insertAppointment({
        startsAt: new Date(Date.now() + 24 * HOUR + 5 * MINUTE),
        doctorId: await createDoctor(),
      });

      const send = jest.spyOn(provider, 'send').mockRejectedValue(new Error('gateway unreachable'));

      await scheduler.sendReminders();

      send.mockRestore();

      await scheduler.sendReminders();

      const rows = await logged(appointmentId);

      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe(NOTIFICATION_STATUS.FAILED);
    });

    it('respects the per-reminder switch', async () => {
      await context.db
        .update(clinics)
        .set({ settings: settings({ remind24h: false }) })
        .where(eq(clinics.id, clinic.id));

      const appointmentId = await insertAppointment({
        startsAt: new Date(Date.now() + 24 * HOUR + 5 * MINUTE),
        doctorId: await createDoctor(),
      });

      await scheduler.sendReminders();

      expect(await logged(appointmentId)).toHaveLength(0);
    });

    it('leaves alone anything that is not a confirmed appointment', async () => {
      const requested = await insertAppointment({
        startsAt: new Date(Date.now() + 24 * HOUR + 5 * MINUTE),
        status: APPOINTMENT_STATUS.REQUESTED,
        doctorId: await createDoctor(),
      });
      const cancelled = await insertAppointment({
        startsAt: new Date(Date.now() + 24 * HOUR + 6 * MINUTE),
        status: APPOINTMENT_STATUS.CANCELLED,
        doctorId: await createDoctor(),
      });

      await scheduler.sendReminders();

      // A held booking is not a commitment yet, and reminding somebody about a
      // cancelled appointment is worse than silence.
      expect(await logged(requested)).toHaveLength(0);
      expect(await logged(cancelled)).toHaveLength(0);
    });

    it('says nothing about an appointment that is neither a day nor two hours away', async () => {
      const appointmentId = await insertAppointment({
        startsAt: new Date(Date.now() + 8 * HOUR),
        doctorId: await createDoctor(),
      });

      await scheduler.sendReminders();

      expect(await logged(appointmentId)).toHaveLength(0);
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Hold expiry                                                             */
  /* ---------------------------------------------------------------------- */

  describe('hold expiry', () => {
    it('gives back the slot of a booking nobody confirmed', async () => {
      const startsAt = nextSlot();
      const appointmentId = await insertAppointment({
        startsAt: new Date(startsAt),
        status: APPOINTMENT_STATUS.REQUESTED,
        createdAt: new Date(Date.now() - 30 * MINUTE),
      });

      const taken = await context.app.inject({
        method: 'GET',
        url: `/public/booking/${clinic.slug}/slots?doctorId=${fixtures.doctorId}&date=${monday}`,
      });

      expect(
        (taken.json() as { slots: { startsAt: string }[] }).slots.map((slot) => slot.startsAt),
      ).not.toContain(startsAt);

      expect(await scheduler.releaseExpiredHolds()).toBeGreaterThanOrEqual(1);

      const [row] = await context.db
        .select({
          status: appointments.status,
          reason: appointments.cancelledReason,
          deletedAt: appointments.deletedAt,
        })
        .from(appointments)
        .where(eq(appointments.id, appointmentId));

      // Cancelled, not deleted: reception should be able to see that somebody
      // tried to book and did not finish.
      expect(row?.status).toBe(APPOINTMENT_STATUS.CANCELLED);
      expect(row?.deletedAt).toBeNull();
      expect(row?.reason).toBe('انتهت مهلة تأكيد الحجز الإلكتروني');

      const free = await context.app.inject({
        method: 'GET',
        url: `/public/booking/${clinic.slug}/slots?doctorId=${fixtures.doctorId}&date=${monday}`,
      });

      expect(
        (free.json() as { slots: { startsAt: string }[] }).slots.map((slot) => slot.startsAt),
      ).toContain(startsAt);
    });

    it('keeps a hold that is still inside its window', async () => {
      const appointmentId = await insertAppointment({
        startsAt: new Date(nextSlot()),
        status: APPOINTMENT_STATUS.REQUESTED,
        createdAt: new Date(Date.now() - 2 * MINUTE),
      });

      await scheduler.releaseExpiredHolds();

      const [row] = await context.db
        .select({ status: appointments.status })
        .from(appointments)
        .where(eq(appointments.id, appointmentId));

      expect(row?.status).toBe(APPOINTMENT_STATUS.REQUESTED);
    });

    it('never touches a clinic that confirms by hand', async () => {
      await context.db
        .update(clinics)
        .set({
          settings: {
            ...settings(),
            booking: {
              ...settings().booking,
              confirmationMode: BOOKING_CONFIRMATION_MODE.MANUAL,
            },
          },
        })
        .where(eq(clinics.id, clinic.id));

      const appointmentId = await insertAppointment({
        startsAt: new Date(nextSlot()),
        status: APPOINTMENT_STATUS.REQUESTED,
        createdAt: new Date(Date.now() - 3 * HOUR),
      });

      await scheduler.releaseExpiredHolds();

      const [row] = await context.db
        .select({ status: appointments.status })
        .from(appointments)
        .where(eq(appointments.id, appointmentId));

      // There is no hold to expire when reception rings back — dropping these
      // would delete the clinic's own to-do list.
      expect(row?.status).toBe(APPOINTMENT_STATUS.REQUESTED);
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Templates                                                               */
  /* ---------------------------------------------------------------------- */

  describe('templates', () => {
    it('ships an Arabic default for every message the system sends', () => {
      for (const template of Object.values(NOTIFICATION_TEMPLATE)) {
        const body = DEFAULT_NOTIFICATION_TEMPLATES[template];

        expect(body).toBeDefined();
        expect(body).toMatch(/[؀-ۿ]/);
      }
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Booking's own messages                                                  */
  /* ---------------------------------------------------------------------- */

  describe('booking messages', () => {
    it('logs the OTP against the appointment it belongs to', async () => {
      const startsAt = nextSlot();

      const response = await context.app.inject({
        method: 'POST',
        url: `/public/booking/${clinic.slug}`,
        payload: {
          fullName: 'زائر التذكيرات',
          phone: uniquePhone(),
          doctorId: fixtures.doctorId,
          startsAt,
        },
      });

      expect(response.statusCode).toBe(201);
      const token = (response.json() as { token: string }).token;
      const appointmentId = Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8');

      const [row] = await logged(appointmentId);

      expect(row?.template).toBe(NOTIFICATION_TEMPLATE.BOOKING_OTP);
      expect(row?.status).toBe(NOTIFICATION_STATUS.SENT);
      expect(row?.vars['code']).toMatch(/^\d{6}$/);
    });
  });
});
