import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  APPOINTMENT_STATUS,
  APPOINTMENT_TYPE,
  BOOKING_CONFIRMATION_MODE,
  bookingSettings,
  clinicScheduleSettings,
  DEFAULT_TIME_ZONE,
  localDate,
  minutesFromLocalMidnight,
  NOTIFICATION_TEMPLATE,
  occupiesSlot,
  type BookingReceipt,
  type BookingSettings,
  type CreateBookingInput,
  type ManagedBooking,
  type PersonName,
  type PublicClinic,
  type PublicDoctor,
  type PublicSlots,
  type PublicSlotsQuery,
} from '@clinic/shared';
import { and, asc, count, eq, gte, isNull, sql } from 'drizzle-orm';
import { createHash, randomInt } from 'node:crypto';

import { AvailabilityService } from '@api/appointments/availability.service';
import { BookingTokenService } from '@api/booking/booking-token.service';
import type { Env } from '@api/config/env.schema';
import { notificationName, toPersonName } from '@api/common/person-name';
import { DATABASE, type Database } from '@api/database/database.module';
import {
  appointments,
  bookingOtps,
  clinics,
  doctors,
  patients,
  specialties,
  users,
} from '@api/database/schema';
import { NotificationsService } from '@api/notifications/notifications.service';

const OTP_TTL_SECONDS = 5 * 60;
const OTP_MAX_ATTEMPTS = 3;

/** Postgres raises this when the overlap constraint rejects a row. */
const EXCLUSION_VIOLATION = '23P01';

const isOverlapConflict = (error: unknown): boolean => {
  for (let current = error, depth = 0; current && depth < 5; depth += 1) {
    if (
      typeof current === 'object' &&
      'code' in current &&
      (current as { code?: unknown }).code === EXCLUSION_VIOLATION
    ) {
      return true;
    }

    current = (current as { cause?: unknown }).cause;
  }

  return false;
};

/** Digits only, so `0931 000 001` and `+963931000001` are not two people. */
const normalisePhone = (phone: string): string => phone.replaceAll(/[^\d]/g, '');

interface ClinicContext {
  readonly id: string;
  readonly name: PersonName;
  readonly phone: string | null;
  readonly timeZone: string;
  readonly booking: BookingSettings;
}

// Nothing in a response may differ between a phone the clinic knows and one it has never seen —
// otherwise a stranger walks a phone book and learns who is a patient here.
@Injectable()
export class BookingService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly availability: AvailabilityService,
    private readonly tokens: BookingTokenService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async clinicBySlug(slug: string): Promise<PublicClinic> {
    const clinic = await this.requireClinic(slug);

    return {
      name: clinic.name,
      slug,
      phone: clinic.phone,
      address: null,
      bookingEnabled: clinic.booking.enabled,
      confirmationMode: clinic.booking.confirmationMode,
      maxDaysAhead: clinic.booking.maxDaysAhead,
    };
  }

  /** Name and specialty. Not the weekly schedule — that is how the clinic runs. */
  async doctors(slug: string): Promise<PublicDoctor[]> {
    const clinic = await this.requireBookingEnabled(slug);

    const rows = await this.db
      .select({
        id: doctors.id,
        nameAr: users.nameAr,
        nameEn: users.nameEn,
        specialty: specialties.name,
      })
      .from(doctors)
      .innerJoin(users, eq(users.id, doctors.userId))
      .innerJoin(specialties, eq(specialties.id, doctors.specialtyId))
      .where(
        and(
          eq(doctors.clinicId, clinic.id),
          isNull(doctors.deletedAt),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      )
      // Ordered by the Arabic spelling: the booking page is Arabic-only, so
      // that is the order a patient actually reads down the list in.
      .orderBy(asc(users.nameAr));

    return rows.map((row) => ({
      id: row.id,
      name: toPersonName(row.nameAr, row.nameEn),
      specialty: row.specialty,
    }));
  }

  /** Only bookable slots: a taken one on a public page says someone else has an appointment at ten. */
  async slots(slug: string, query: PublicSlotsQuery): Promise<PublicSlots> {
    const clinic = await this.requireBookingEnabled(slug);
    this.requireWithinWindow(clinic, `${query.date}T00:00:00.000Z`, { dateOnly: true });

    const availability = await this.availability.forDay(clinic.id, {
      doctorId: query.doctorId,
      date: query.date,
    });

    const earliest = this.earliestBookable(clinic);

    const slots = availability.slots
      .filter((slot) => slot.available && new Date(slot.startsAt) >= earliest)
      .map(({ start, end, startsAt }) => ({ start, end, startsAt }));

    // Only the two dated reasons reach a stranger: a closure and an absence
    // are on the door, and how full the diary is is the clinic's business.
    const dated =
      availability.closedReason === 'clinic_closure' ||
      availability.closedReason === 'doctor_time_off'
        ? availability.closedReason
        : null;

    return {
      date: query.date,
      slots,
      closedReason: dated,
      closedNote: dated ? availability.closedNote : null,
    };
  }

  async book(slug: string, input: CreateBookingInput): Promise<BookingReceipt> {
    const clinic = await this.requireBookingEnabled(slug);
    this.requireWithinWindow(clinic, input.startsAt);

    await this.requireOfferedSlot(clinic, input.doctorId, input.startsAt);

    const phone = normalisePhone(input.phone);
    await this.requireUnderActiveLimit(clinic, phone);

    const patientId = await this.linkOrCreatePatient(clinic.id, phone, input.fullName);
    const duration = await this.durationFor(clinic.id, input.doctorId);

    let appointmentId: string;

    try {
      const [row] = await this.db
        .insert(appointments)
        .values({
          clinicId: clinic.id,
          patientId,
          doctorId: input.doctorId,
          startsAt: new Date(input.startsAt),
          durationMinutes: duration,
          type: APPOINTMENT_TYPE.CHECKUP,
          // Held, not confirmed. The same status reception sees in the pending
          // list, and the same one the hold-expiry job releases.
          status: APPOINTMENT_STATUS.REQUESTED,
          reason: input.reason ?? null,
        })
        .returning({ id: appointments.id });

      /* istanbul ignore next -- insert ... returning always yields a row. */
      if (!row) {
        throw new Error('Failed to hold the slot');
      }

      appointmentId = row.id;
    } catch (error) {
      if (isOverlapConflict(error)) {
        throw new BadRequestException('That time is no longer available');
      }

      throw error;
    }

    const holdExpiresAt = new Date(Date.now() + clinic.booking.holdMinutes * 60_000);
    const token = this.tokens.sign(appointmentId);

    if (clinic.booking.confirmationMode === BOOKING_CONFIRMATION_MODE.MANUAL) {
      return {
        token,
        status: 'pending_confirmation',
        otpExpiresInSeconds: null,
        holdExpiresAt: holdExpiresAt.toISOString(),
      };
    }

    await this.issueOtp(clinic, appointmentId, patientId, phone);

    return {
      token,
      status: 'pending_otp',
      otpExpiresInSeconds: OTP_TTL_SECONDS,
      holdExpiresAt: holdExpiresAt.toISOString(),
    };
  }

  // Every rejection is the same message — "wrong code", "expired" and "too many attempts" told
  // apart reveal whether a code was ever issued.
  async verifyOtp(slug: string, token: string, code: string): Promise<ManagedBooking> {
    const clinic = await this.requireBookingEnabled(slug);
    const appointmentId = this.tokens.verify(token);

    const [otp] = await this.db
      .select()
      .from(bookingOtps)
      .where(and(eq(bookingOtps.appointmentId, appointmentId), eq(bookingOtps.clinicId, clinic.id)))
      .limit(1);

    const invalid = new UnauthorizedException('That code is not valid');

    if (!otp || otp.consumedAt || otp.expiresAt <= new Date() || otp.attempts >= OTP_MAX_ATTEMPTS) {
      throw invalid;
    }

    if (otp.codeHash !== hashCode(code)) {
      // The attempt is counted before the rejection, so three wrong guesses
      // burn the code whether or not the caller keeps trying.
      await this.db
        .update(bookingOtps)
        .set({ attempts: otp.attempts + 1 })
        .where(eq(bookingOtps.id, otp.id));

      throw invalid;
    }

    await this.db
      .update(bookingOtps)
      .set({ consumedAt: new Date() })
      .where(eq(bookingOtps.id, otp.id));

    await this.db
      .update(appointments)
      .set({ status: APPOINTMENT_STATUS.CONFIRMED, updatedAt: new Date() })
      .where(and(eq(appointments.id, appointmentId), eq(appointments.clinicId, clinic.id)));

    const booking = await this.loadManaged(clinic, appointmentId);

    await this.notifications.send({
      clinicId: clinic.id,
      to: await this.phoneFor(appointmentId),
      template: NOTIFICATION_TEMPLATE.BOOKING_CONFIRMED,
      appointmentId,
      vars: {
        clinic: notificationName(clinic.name),
        doctor: notificationName(booking.doctorName),
        date: localDate(new Date(booking.startsAt), clinic.timeZone),
        time: timeIn(clinic.timeZone, new Date(booking.startsAt)),
        link: this.manageLink(token),
      },
    });

    return booking;
  }

  async view(token: string): Promise<ManagedBooking> {
    const appointmentId = this.tokens.verify(token);
    const clinic = await this.clinicForAppointment(appointmentId);

    return this.loadManaged(clinic, appointmentId);
  }

  async cancel(token: string, reason: string | undefined): Promise<ManagedBooking> {
    const appointmentId = this.tokens.verify(token);
    const clinic = await this.clinicForAppointment(appointmentId);
    const existing = await this.requireOpen(clinic, appointmentId);

    this.requireWithinWindow(clinic, existing.startsAt.toISOString());

    await this.db
      .update(appointments)
      .set({
        status: APPOINTMENT_STATUS.CANCELLED,
        cancelledReason: reason?.trim() || 'ألغى المريض الحجز عبر الرابط',
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, appointmentId));

    await this.notifications.send({
      clinicId: clinic.id,
      to: await this.phoneFor(appointmentId),
      template: NOTIFICATION_TEMPLATE.BOOKING_CANCELLED,
      appointmentId,
      vars: {
        clinic: notificationName(clinic.name),
        date: localDate(existing.startsAt, clinic.timeZone),
        time: timeIn(clinic.timeZone, existing.startsAt),
      },
    });

    return this.loadManaged(clinic, appointmentId);
  }

  async reschedule(token: string, startsAt: string): Promise<ManagedBooking> {
    const appointmentId = this.tokens.verify(token);
    const clinic = await this.clinicForAppointment(appointmentId);
    const existing = await this.requireOpen(clinic, appointmentId);

    this.requireWithinWindow(clinic, startsAt);
    // Excluding itself, so moving a booking by fifteen minutes does not collide
    // with the slot it is moving out of.
    await this.requireOfferedSlot(clinic, existing.doctorId, startsAt, appointmentId);

    try {
      await this.db
        .update(appointments)
        .set({ startsAt: new Date(startsAt), updatedAt: new Date() })
        .where(eq(appointments.id, appointmentId));
    } catch (error) {
      if (isOverlapConflict(error)) {
        throw new BadRequestException('That time is no longer available');
      }

      throw error;
    }

    return this.loadManaged(clinic, appointmentId);
  }

  private async issueOtp(
    clinic: ClinicContext,
    appointmentId: string,
    patientId: string,
    phone: string,
  ): Promise<void> {
    // `randomInt` rather than `Math.random`: this is a credential, and a
    // predictable one is no credential at all.
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');

    // One live code per booking. A resend replaces the previous row rather than
    // leaving two valid codes behind.
    await this.db.delete(bookingOtps).where(eq(bookingOtps.appointmentId, appointmentId));

    await this.db.insert(bookingOtps).values({
      clinicId: clinic.id,
      appointmentId,
      patientId,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
    });

    await this.notifications.send({
      clinicId: clinic.id,
      to: phone,
      template: NOTIFICATION_TEMPLATE.BOOKING_OTP,
      appointmentId,
      vars: {
        clinic: notificationName(clinic.name),
        code,
        minutes: String(OTP_TTL_SECONDS / 60),
      },
    });
  }

  // A known number is linked, an unknown one gets a minimal unverified record — and the response is
  // identical, which is where enumeration would leak if it leaked anywhere.
  private async linkOrCreatePatient(
    clinicId: string,
    phone: string,
    fullName: string,
  ): Promise<string> {
    const [existing] = await this.db
      .select({ id: patients.id })
      .from(patients)
      .where(
        and(
          eq(patients.clinicId, clinicId),
          isNull(patients.deletedAt),
          // Compared on digits, so a number saved as +963… matches one typed
          // as 09….
          sql`regexp_replace(${patients.phone}, '[^0-9]', '', 'g') = ${phone}`,
        ),
      )
      .limit(1);

    if (existing) {
      return existing.id;
    }

    const fileNumber = await this.nextFileNumber(clinicId);

    const [created] = await this.db
      .insert(patients)
      .values({
        clinicId,
        fileNumber,
        fullName: fullName.trim(),
        phone,
        // No `created_by`: nobody on staff created this record, and attributing
        // it to one would be a lie in the audit trail.
        notes: 'أُنشئ من الحجز الإلكتروني — لم يُتحقق من الهوية بعد',
      })
      .returning({ id: patients.id });

    /* istanbul ignore next -- insert ... returning always yields a row. */
    if (!created) {
      throw new Error('Failed to create the patient');
    }

    return created.id;
  }

  private async nextFileNumber(clinicId: string): Promise<string> {
    const [row] = await this.db
      .select({ value: sql<number>`coalesce(max(${patients.fileNumber}::int), 0)::int` })
      .from(patients)
      .where(and(eq(patients.clinicId, clinicId), sql`${patients.fileNumber} ~ '^[0-9]+$'`));

    return String((row?.value ?? 0) + 1).padStart(5, '0');
  }

  // Anti-abuse, worded exactly like a closed booking page: a stranger must not learn that this
  // number is the one being limited.
  private async requireUnderActiveLimit(clinic: ClinicContext, phone: string): Promise<void> {
    const [row] = await this.db
      .select({ value: count() })
      .from(appointments)
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .where(
        and(
          eq(appointments.clinicId, clinic.id),
          isNull(appointments.deletedAt),
          eq(appointments.status, APPOINTMENT_STATUS.REQUESTED),
          gte(appointments.startsAt, new Date()),
          sql`regexp_replace(${patients.phone}, '[^0-9]', '', 'g') = ${phone}`,
        ),
      );

    if ((row?.value ?? 0) >= clinic.booking.maxActivePerPhone) {
      throw new ForbiddenException('Booking is not available right now');
    }
  }

  private earliestBookable(clinic: ClinicContext): Date {
    return new Date(Date.now() + clinic.booking.minHoursBefore * 3_600_000);
  }

  // Too soon and reception never sees it; too far and one stranger fills next spring. `dateOnly`
  // relaxes the near end for the whole-day slots endpoint.
  private requireWithinWindow(
    clinic: ClinicContext,
    startsAt: string,
    options: { dateOnly?: boolean } = {},
  ): void {
    const at = new Date(startsAt);
    const latest = new Date(Date.now() + clinic.booking.maxDaysAhead * 86_400_000);

    if (at > latest) {
      throw new BadRequestException('That date is too far ahead');
    }

    if (!options.dateOnly && at < this.earliestBookable(clinic)) {
      throw new BadRequestException('That time is too soon to book online');
    }
  }

  private async durationFor(clinicId: string, doctorId: string): Promise<number> {
    const [row] = await this.db
      .select({ duration: doctors.defaultAppointmentDurationMinutes })
      .from(doctors)
      .where(
        and(eq(doctors.id, doctorId), eq(doctors.clinicId, clinicId), isNull(doctors.deletedAt)),
      )
      .limit(1);

    if (!row) {
      throw new BadRequestException('That doctor is not available');
    }

    return row.duration;
  }

  private async requireClinic(slug: string): Promise<ClinicContext> {
    const [row] = await this.db
      .select({
        id: clinics.id,
        nameAr: clinics.nameAr,
        nameEn: clinics.nameEn,
        phone: clinics.phone,
        settings: clinics.settings,
      })
      .from(clinics)
      .where(and(eq(clinics.slug, slug), isNull(clinics.deletedAt)))
      .limit(1);

    if (!row) {
      throw new NotFoundException('Clinic not found');
    }

    return {
      id: row.id,
      name: toPersonName(row.nameAr, row.nameEn),
      phone: row.phone,
      timeZone: clinicScheduleSettings(row.settings).timezone || DEFAULT_TIME_ZONE,
      booking: bookingSettings(row.settings),
    };
  }

  private async requireBookingEnabled(slug: string): Promise<ClinicContext> {
    const clinic = await this.requireClinic(slug);

    if (!clinic.booking.enabled) {
      throw new NotFoundException('Booking is not available right now');
    }

    return clinic;
  }

  private async clinicForAppointment(appointmentId: string): Promise<ClinicContext> {
    const [row] = await this.db
      .select({ slug: clinics.slug })
      .from(appointments)
      .innerJoin(clinics, eq(clinics.id, appointments.clinicId))
      .where(and(eq(appointments.id, appointmentId), isNull(appointments.deletedAt)))
      .limit(1);

    if (!row) {
      // Same exception a bad signature raises: a valid token for a deleted
      // booking must not be distinguishable from a forged one.
      throw new UnauthorizedException('Invalid booking link');
    }

    return this.requireClinic(row.slug);
  }

  private async requireOpen(
    clinic: ClinicContext,
    appointmentId: string,
  ): Promise<{ startsAt: Date; doctorId: string }> {
    const [row] = await this.db
      .select({
        startsAt: appointments.startsAt,
        status: appointments.status,
        doctorId: appointments.doctorId,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(appointments.clinicId, clinic.id),
          isNull(appointments.deletedAt),
        ),
      )
      .limit(1);

    if (!row) {
      throw new UnauthorizedException('Invalid booking link');
    }

    // A cancelled booking's link is spent. Re-using it must not resurrect the
    // appointment, and must not report anything about it either.
    if (!occupiesSlot(row.status) || row.status === APPOINTMENT_STATUS.COMPLETED) {
      throw new BadRequestException('This booking can no longer be changed');
    }

    return { startsAt: row.startsAt, doctorId: row.doctorId };
  }

  // The constraint guarantees no overlap but knows nothing about opening hours or schedules;
  // without this a stranger could book 03:00 on a Friday. Same availability the page renders.
  private async requireOfferedSlot(
    clinic: ClinicContext,
    doctorId: string,
    startsAt: string,
    excludeAppointmentId?: string,
  ): Promise<void> {
    const at = new Date(startsAt);

    const availability = await this.availability.forDay(clinic.id, {
      doctorId,
      date: localDate(at, clinic.timeZone),
      ...(excludeAppointmentId === undefined ? {} : { excludeAppointmentId }),
    });

    const slot = availability.slots.find((candidate) => candidate.startsAt === at.toISOString());

    if (!slot) {
      throw new BadRequestException('That time is not offered');
    }

    if (!slot.available) {
      throw new BadRequestException('That time is no longer available');
    }
  }

  private async loadManaged(clinic: ClinicContext, appointmentId: string): Promise<ManagedBooking> {
    const [row] = await this.db
      .select({
        status: appointments.status,
        startsAt: appointments.startsAt,
        durationMinutes: appointments.durationMinutes,
        doctorNameAr: users.nameAr,
        doctorNameEn: users.nameEn,
      })
      .from(appointments)
      .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
      .innerJoin(users, eq(users.id, doctors.userId))
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(appointments.clinicId, clinic.id),
          isNull(appointments.deletedAt),
        ),
      )
      .limit(1);

    if (!row) {
      throw new UnauthorizedException('Invalid booking link');
    }

    return {
      status: row.status,
      startsAt: row.startsAt.toISOString(),
      durationMinutes: row.durationMinutes,
      doctorName: toPersonName(row.doctorNameAr, row.doctorNameEn),
      clinicName: clinic.name,
      clinicPhone: clinic.phone,
      canModify:
        occupiesSlot(row.status) &&
        row.status !== APPOINTMENT_STATUS.COMPLETED &&
        row.startsAt >= this.earliestBookable(clinic),
    };
  }

  private async phoneFor(appointmentId: string): Promise<string> {
    const [row] = await this.db
      .select({ phone: patients.phone })
      .from(appointments)
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .where(eq(appointments.id, appointmentId))
      .limit(1);

    return row?.phone ?? '';
  }

  private manageLink(token: string): string {
    const base = this.config.get('PUBLIC_BASE_URL', { infer: true });

    return `${base.replace(/\/$/, '')}/booking/manage/${token}`;
  }
}

// A digest, not argon2: the code is CSPRNG output and the three-attempt limit stops online
// guessing. What matters is that the column never holds the code itself.
export const hashCode = (code: string): string => createHash('sha256').update(code).digest('hex');

function timeIn(timeZone: string, at: Date): string {
  const minutes = minutesFromLocalMidnight(at, localDate(at, timeZone), timeZone);
  const hours = Math.floor(minutes / 60);

  return `${String(hours).padStart(2, '0')}:${String(Math.round(minutes % 60)).padStart(2, '0')}`;
}
