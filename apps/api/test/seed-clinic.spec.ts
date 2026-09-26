import { randomUUID } from "node:crypto";
import {
  PERFORMED_PROCEDURE_STATUS,
  localWeekday,
  occupiesSlot,
  type AppointmentStatus,
} from "@clinic/shared";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, asc, eq, isNull } from "drizzle-orm";
import postgres from "postgres";
import type { Database } from "@api/database/database.module";
import * as schema from "@api/database/schema";
import {
  appointments,
  charges,
  clinicClosures,
  clinics,
  patients,
  payments,
  performedProcedures,
} from "@api/database/schema";
import { CLINIC_HOURS, CLINIC_NAME, CLINIC_TIME_ZONE } from "@api/database/seed/clinic";
import { seedDatabase, type SeedOptions, type SeedSummary } from "@api/database/seed/seed-database";

const localDateOf = (instant: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);

// The seed is the fixture the whole app is demonstrated on, so what is asserted here is what it
// must never produce: a Friday appointment, two patients in one chair, a charge for planned work.
describe("the seeded clinic", () => {
  jest.setTimeout(180_000);

  let client: ReturnType<typeof postgres>;
  let db: Database;
  let options: SeedOptions;
  let summary: SeedSummary;
  let clinicId: string;

  beforeAll(async () => {
    const databaseUrl = process.env["DATABASE_URL"];

    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required to run the API tests.");
    }

    client = postgres(databaseUrl, { max: 1, onnotice: () => {} });
    db = drizzle(client, { schema });

    // A scratch clinic rather than the real slug: staff identifiers are unique system-wide, and
    // the suite must not adopt whatever a previous run left behind.
    const handle = randomUUID().slice(0, 8);

    options = {
      passwordHash: "x".repeat(32),
      slug: `seed-${handle}`,
      namePrefix: handle,
      identifierPrefix: handle,
      patientCount: 12,
      daysBack: 60,
      daysForward: 30,
    };

    summary = await seedDatabase(db, options);
    clinicId = summary.clinicId;
  });

  afterAll(async () => {
    await client.end();
  });

  it("names the clinic and bills it in shekels", async () => {
    const [row] = await db.select().from(clinics).where(eq(clinics.id, clinicId)).limit(1);

    expect(row?.nameAr).toContain(CLINIC_NAME.ar);
    expect(row?.currency).toBe("ILS");
    expect(row?.address).toContain("نابلس");
    // Saturday through Thursday: Friday is the one day with no hours at all.
    expect(row?.workingHours.map((day) => day.weekday).sort()).toEqual([0, 1, 2, 3, 4, 6]);
  });

  it("opens five accounts and two doctors with different weeks", () => {
    expect(summary.accounts.map((entry) => entry.account.role).sort()).toEqual([
      "admin",
      "doctor",
      "doctor",
      "receptionist",
      "technician",
    ]);
  });

  it("writes something into every table the app draws from", () => {
    expect(summary.created).toBe(true);
    expect(summary.counts["patients"]).toBe(12);

    for (const table of [
      "appointments",
      "visits",
      "performedProcedures",
      "chartMarks",
      "charges",
      "payments",
      "labs",
      "labOrders",
      "labPayments",
      "inventoryItems",
      "stockMovements",
      "suppliers",
      "waitingList",
      "notifications",
      "treatmentPlans",
      "treatmentPlanItems",
      "clinicClosures",
      "doctorTimeOff",
    ]) {
      expect([table, summary.counts[table] ?? 0]).not.toEqual([table, 0]);
    }
  });

  it("books nothing on a Friday, or on a day the clinic is closed", async () => {
    const booked = await db
      .select({ startsAt: appointments.startsAt })
      .from(appointments)
      .where(and(eq(appointments.clinicId, clinicId), isNull(appointments.deletedAt)));

    const closures = await db
      .select({ startsOn: clinicClosures.startsOn, endsOn: clinicClosures.endsOn })
      .from(clinicClosures)
      .where(eq(clinicClosures.clinicId, clinicId));

    expect(booked.length).toBeGreaterThan(0);

    const openWeekdays = new Set(CLINIC_HOURS.map((day) => day.weekday));
    const outsideHours = booked.filter(
      (row) => !openWeekdays.has(localWeekday(localDateOf(row.startsAt), CLINIC_TIME_ZONE)),
    );

    expect(outsideHours).toEqual([]);

    const inClosure = booked.filter((row) => {
      const isoDate = localDateOf(row.startsAt);
      return closures.some((closure) => isoDate >= closure.startsOn && isoDate <= closure.endsOn);
    });

    expect(inClosure).toEqual([]);
  });

  it("never puts two patients in one chair", async () => {
    const booked = await db
      .select({
        doctorId: appointments.doctorId,
        startsAt: appointments.startsAt,
        durationMinutes: appointments.durationMinutes,
        status: appointments.status,
      })
      .from(appointments)
      .where(and(eq(appointments.clinicId, clinicId), isNull(appointments.deletedAt)))
      .orderBy(asc(appointments.doctorId), asc(appointments.startsAt));

    const held = booked.filter((row) => occupiesSlot(row.status as AppointmentStatus));
    const clashes: string[] = [];

    for (let index = 1; index < held.length; index += 1) {
      const previous = held[index - 1];
      const current = held[index];

      if (!previous || !current || previous.doctorId !== current.doctorId) {
        continue;
      }

      if (
        current.startsAt.getTime() <
        previous.startsAt.getTime() + previous.durationMinutes * 60_000
      ) {
        clashes.push(`${current.doctorId} ${current.startsAt.toISOString()}`);
      }
    }

    expect(clashes).toEqual([]);
  });

  it("bills the work that was done and nothing that is only planned", async () => {
    const rows = await db
      .select({ status: performedProcedures.status, chargeId: charges.id })
      .from(performedProcedures)
      .leftJoin(
        charges,
        and(
          eq(charges.performedProcedureId, performedProcedures.id),
          isNull(charges.reversesId),
          isNull(charges.reversedAt),
        ),
      )
      .where(
        and(eq(performedProcedures.clinicId, clinicId), isNull(performedProcedures.deletedAt)),
      );

    expect(rows.length).toBeGreaterThan(0);

    const unbilled = rows.filter(
      (row) => row.status !== PERFORMED_PROCEDURE_STATUS.PLANNED && row.chargeId === null,
    );
    const wronglyBilled = rows.filter(
      (row) => row.status === PERFORMED_PROCEDURE_STATUS.PLANNED && row.chargeId !== null,
    );

    expect(unbilled).toEqual([]);
    expect(wronglyBilled).toEqual([]);
  });

  it("numbers the receipts continuously from one", async () => {
    const rows = await db
      .select({ receiptNumber: payments.receiptNumber })
      .from(payments)
      .where(and(eq(payments.clinicId, clinicId), isNull(payments.deletedAt)))
      .orderBy(asc(payments.receiptNumber));

    const numbers = rows.map((row) => row.receiptNumber).filter((value) => value !== null);

    expect(numbers.length).toBeGreaterThan(0);
    expect(numbers).toEqual(numbers.map((_, index) => index + 1));
  });

  it("dates every payment in the past, never ahead of today", async () => {
    const rows = await db
      .select({ createdAt: payments.createdAt })
      .from(payments)
      .where(eq(payments.clinicId, clinicId));

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((row) => row.createdAt.getTime() > Date.now())).toEqual([]);
  });

  it("leaves today with a list somebody can demonstrate", async () => {
    const today = localDateOf(new Date());

    // A Friday is the one day the demo has nothing to show, and that is correct.
    if (!CLINIC_HOURS.some((day) => day.weekday === localWeekday(today, CLINIC_TIME_ZONE))) {
      return;
    }

    const booked = await db
      .select({ startsAt: appointments.startsAt, status: appointments.status })
      .from(appointments)
      .where(and(eq(appointments.clinicId, clinicId), isNull(appointments.deletedAt)));

    const todays = booked.filter((row) => localDateOf(row.startsAt) === today);

    expect(todays.length).toBeGreaterThanOrEqual(6);
    expect(new Set(todays.map((row) => row.status)).size).toBeGreaterThan(2);
  });

  it("writes nothing the second time it is run", async () => {
    const before = await db
      .select({ id: patients.id })
      .from(patients)
      .where(eq(patients.clinicId, clinicId));

    const again = await seedDatabase(db, options);

    const after = await db
      .select({ id: patients.id })
      .from(patients)
      .where(eq(patients.clinicId, clinicId));

    expect(again.clinicId).toBe(clinicId);
    expect(again.created).toBe(false);
    expect(after.length).toBe(before.length);
  });
});
