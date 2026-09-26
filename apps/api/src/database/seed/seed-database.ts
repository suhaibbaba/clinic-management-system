import { randomUUID } from "node:crypto";
import {
  APPOINTMENT_STATUS,
  CHART_TYPE,
  LAB_ORDER_STATUS,
  MOVEMENT_TYPE,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_STATUS,
  NOTIFICATION_TEMPLATE,
  PAYMENT_METHOD,
  PERFORMED_PROCEDURE_STATUS,
  SPECIALTY_CODE,
  TREATMENT_PLAN_ITEM_STATUS,
  TREATMENT_PLAN_STATUS,
  USER_ROLE,
  WAITING_LIST_PRIORITY,
  WAITING_LIST_SOURCE,
  WAITING_LIST_STATUS,
  addDays,
  instantFromLocal,
  joinPatientName,
  localDate,
  localWeekday,
  occupiesSlot,
  type LabOrderStatus,
} from "@clinic/shared";
import { and, eq, isNull } from "drizzle-orm";
import type { BusyInterval } from "@api/appointments/slots";
import { ChargesService } from "@api/billing/charges.service";
import { nextReceiptNumber } from "@api/billing/payments.service";
import type { Database } from "@api/database/database.module";
import {
  appointments,
  chartMarks,
  charges,
  clinicClosures,
  clinicNotes,
  doctorTimeOff,
  doctors,
  inventoryItems,
  labOrders,
  labPayments,
  labWorkTypes,
  labs,
  medicalHistories,
  notificationsLog,
  patients,
  payments,
  performedProcedures,
  prescriptions,
  procedureCatalog,
  specialties,
  stockMovements,
  suppliers,
  treatmentPlanItems,
  treatmentPlans,
  visits,
  waitingList,
} from "@api/database/schema";
import { ensureSystemLookups } from "@api/database/system-lookups";
import {
  ACCOUNTS,
  CATALOG,
  CLINIC_DEFAULTS,
  CLINIC_HOURS,
  CLINIC_NAME,
  CLINIC_SLUG,
  CLINIC_TIME_ZONE,
  COMPLAINTS,
  DIAGNOSES,
  DOCTOR_SCHEDULES,
  EXAMINATIONS,
} from "@api/database/seed/clinic";
import {
  CHART_MARK_TYPE,
  PLAN_ITEM_STATUSES,
  PLAN_STATUSES,
  discountFor,
  medicalHistory,
  planNotes,
  planTitle,
  prescriptionItems,
  procedureStatus,
  teethFor,
  toothLocation,
} from "@api/database/seed/clinical";
import { planAppointments, type PlannedAppointment } from "@api/database/seed/calendar";
import { buildPeople } from "@api/database/seed/people";
import {
  ADJUST_REASONS,
  ITEMS,
  LAB_INSTRUCTIONS,
  LAB_MATERIALS,
  LAB_SHADES,
  LABS,
  SUPPLIERS,
  WAITING_REASONS,
} from "@api/database/seed/practice";
import { Rng } from "@api/database/seed/random";
import { upsertSeedClinic } from "@api/database/seed/upsert-clinic";
import { upsertUser, type SeedAccount } from "@api/database/seed/users";

export interface SeedOptions {
  /** Overridden by the specs so a seeded scratch clinic cannot collide with the real one. */
  readonly slug?: string;
  readonly namePrefix?: string;
  readonly identifierPrefix?: string;
  readonly patientCount?: number;
  readonly randomSeed?: number;
  readonly daysBack?: number;
  readonly daysForward?: number;
  readonly passwordHash: string;
}

export type SeedCounts = Record<string, number>;

export interface SeedSummary {
  readonly clinicId: string;
  readonly created: boolean;
  readonly accounts: readonly { readonly account: SeedAccount; readonly id: string }[];
  readonly counts: SeedCounts;
  readonly notes: readonly string[];
}

const DEFAULT_PATIENTS = 80;
const DEFAULT_DAYS_BACK = 365;
const DEFAULT_DAYS_FORWARD = 365;
/** Fixed on purpose: the same clinic every rebuild, so a bug report can name a patient. */
const DEFAULT_RANDOM_SEED = 20_260_914;

export async function seedDatabase(db: Database, options: SeedOptions): Promise<SeedSummary> {
  const rng = new Rng(options.randomSeed ?? DEFAULT_RANDOM_SEED);
  const slug = options.slug ?? CLINIC_SLUG;
  const prefix = options.identifierPrefix ?? "";
  const patientCount = options.patientCount ?? DEFAULT_PATIENTS;
  const daysBack = options.daysBack ?? DEFAULT_DAYS_BACK;
  const daysForward = options.daysForward ?? DEFAULT_DAYS_FORWARD;

  const name = options.namePrefix
    ? {
        ar: `${CLINIC_NAME.ar} ${options.namePrefix}`,
        en: `${CLINIC_NAME.en} ${options.namePrefix}`,
      }
    : CLINIC_NAME;

  const clinic = await upsertSeedClinic(db, { slug, name, defaults: CLINIC_DEFAULTS });
  const notes = [...clinic.notes];

  await ensureSystemLookups(db, clinic.id);
  const specialtyId = await upsertSpecialty(db, clinic.id);

  const accounts: { account: SeedAccount; id: string }[] = [];
  for (const account of ACCOUNTS) {
    const scoped: SeedAccount = prefix
      ? { ...account, phone: `${account.phone}${prefix}`, email: `${prefix}.${account.email}` }
      : account;

    const user = await upsertUser(db, clinic.id, scoped, options.passwordHash);
    accounts.push({ account: scoped, id: user.id });
    notes.push(...user.notes);
  }

  const adminId = accounts.find((entry) => entry.account.role === USER_ROLE.ADMIN)?.id;
  const doctorUserIds = accounts
    .filter((entry) => entry.account.role === USER_ROLE.DOCTOR)
    .map((entry) => entry.id);

  if (!adminId || doctorUserIds.length < 2) {
    throw new Error("The seed needs an admin and two doctors");
  }

  const doctorIds: string[] = [];
  for (const [index, userId] of doctorUserIds.entries()) {
    doctorIds.push(
      await upsertDoctor(db, clinic.id, userId, specialtyId, DOCTOR_SCHEDULES[index] ?? []),
    );
  }

  const [existingPatient] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.clinicId, clinic.id), isNull(patients.deletedAt)))
    .limit(1);

  if (existingPatient) {
    return { clinicId: clinic.id, created: false, accounts, counts: {}, notes };
  }

  const audit = { createdBy: adminId, updatedBy: adminId };
  const catalogIdByCode = await seedCatalog(db, clinic.id, specialtyId, audit);

  const now = new Date();
  const today = localDate(now, CLINIC_TIME_ZONE);
  const people = buildPeople(rng, patientCount, now);

  const patientRows = await db
    .insert(patients)
    .values(
      people.map((person, index) => ({
        clinicId: clinic.id,
        fileNumber: String(index + 1).padStart(5, "0"),
        firstName: person.firstName,
        middleName: person.middleName,
        lastName: person.lastName,
        fullName: joinPatientName(person),
        phone: `${person.phone}${prefix}`,
        dateOfBirth: person.incomplete ? null : person.dateOfBirth,
        gender: person.gender,
        address: person.address,
        createdAt: new Date(now.getTime() - (patientCount - index) * 86_400_000),
        ...audit,
      })),
    )
    .returning({ id: patients.id });

  const seededPatients = patientRows.map((row, index) => ({
    id: row.id,
    index,
    ageYears: ageOf(people[index]?.dateOfBirth ?? today, today),
    isFemale: people[index]?.gender === "female",
  }));

  const histories = seededPatients
    .map((patient) => ({
      patient,
      history: medicalHistory(rng, patient.ageYears, patient.isFemale),
    }))
    .filter((entry) => entry.history !== null);

  if (histories.length > 0) {
    await db.insert(medicalHistories).values(
      histories.map(({ patient, history }) => ({
        clinicId: clinic.id,
        patientId: patient.id,
        chronicConditions: history?.chronicConditions ?? [],
        allergies: history?.allergies ?? [],
        currentMedications: history?.currentMedications ?? [],
        isPregnant: history?.isPregnant ?? null,
        notes: history?.notes ?? null,
        ...audit,
      })),
    );
  }

  // Decided before the diary is generated: a closure the calendar shades is a day the generator
  // must not have booked into, and the clean absence must have nothing under it.
  const closureStart = addDays(today, 24);
  const closureDates = new Set([closureStart, addDays(closureStart, 1), addDays(closureStart, 2)]);
  const cleanTimeOffDate = nextWorkingDay(today, 12, closureDates);
  const cleanTimeOff: BusyInterval[] = [{ startMinute: 9 * 60, endMinute: 13 * 60 }];

  const planned = planAppointments({
    rng,
    today,
    timeZone: CLINIC_TIME_ZONE,
    clinicHours: CLINIC_HOURS,
    doctors: doctorIds.map((id, index) => ({ id, schedule: DOCTOR_SCHEDULES[index] ?? [] })),
    patientCount: seededPatients.length,
    catalog: CATALOG,
    closedDates: closureDates,
    timeOff: new Map([[`${doctorIds[0] as string}:${cleanTimeOffDate}`, cleanTimeOff]]),
    daysBack,
    daysForward,
  });

  const counts = await writeEverything(db, {
    clinicId: clinic.id,
    actorId: adminId,
    audit,
    rng,
    now,
    today,
    planned,
    patients: seededPatients,
    doctorIds,
    catalogIdByCode,
    closureStart,
    closureDates,
    cleanTimeOffDate,
  });

  await db.insert(clinicNotes).values({
    clinicId: clinic.id,
    body: "Reminder: Precision Dental Lab delivers orders on Sunday.",
    authorId: adminId,
    ...audit,
  });

  return {
    clinicId: clinic.id,
    created: true,
    accounts,
    counts: { patients: seededPatients.length, ...counts },
    notes,
  };
}

interface WriteContext {
  readonly clinicId: string;
  readonly actorId: string;
  readonly audit: { readonly createdBy: string; readonly updatedBy: string };
  readonly rng: Rng;
  readonly now: Date;
  readonly today: string;
  readonly planned: readonly PlannedAppointment[];
  readonly patients: readonly {
    readonly id: string;
    readonly index: number;
    readonly ageYears: number;
  }[];
  readonly doctorIds: readonly string[];
  readonly catalogIdByCode: ReadonlyMap<string, string>;
  readonly closureStart: string;
  readonly closureDates: ReadonlySet<string>;
  readonly cleanTimeOffDate: string;
}

async function writeEverything(db: Database, ctx: WriteContext): Promise<SeedCounts> {
  const appointmentRows = await db
    .insert(appointments)
    .values(
      ctx.planned.map((entry) => ({
        clinicId: ctx.clinicId,
        patientId: ctx.patients[entry.patientIndex]?.id as string,
        doctorId: entry.doctorId,
        startsAt: entry.startsAt,
        durationMinutes: entry.durationMinutes,
        type: entry.type,
        status: entry.status,
        reason: entry.reason,
        cancelledReason: entry.cancelledReason,
        createdAt: earlier(entry.startsAt, ctx.rng.int(1, 21)),
        ...ctx.audit,
      })),
    )
    .returning({ id: appointments.id });

  const clinical = await writeClinicalHistory(db, ctx, appointmentRows);
  const money = await writeMoney(db, ctx, clinical.procedures);
  const lab = await writeLabs(db, ctx, clinical.procedures);
  const store = await writeInventory(db, ctx, clinical.procedures);
  const queue = await writeWaitingList(db, ctx);
  const messages = await writeNotifications(db, ctx, appointmentRows);
  const absences = await writeAbsences(db, ctx);

  return {
    appointments: appointmentRows.length,
    ...clinical.counts,
    ...money,
    ...lab,
    ...store,
    ...queue,
    ...messages,
    ...absences,
  };
}

interface ProcedureRecord {
  readonly id: string;
  readonly patientId: string;
  readonly patientIndex: number;
  readonly visitId: string;
  readonly doctorId: string;
  readonly code: string;
  readonly price: string;
  readonly discount: string;
  readonly discountReason: string | null;
  readonly status: (typeof PERFORMED_PROCEDURE_STATUS)[keyof typeof PERFORMED_PROCEDURE_STATUS];
  readonly performedAt: Date;
  readonly needsLab: boolean;
  readonly tooth: number | null;
}

async function writeClinicalHistory(
  db: Database,
  ctx: WriteContext,
  appointmentRows: readonly { readonly id: string }[],
): Promise<{ counts: SeedCounts; procedures: ProcedureRecord[] }> {
  const showcase = new Set(
    ctx.rng.sample(ctx.patients, Math.min(10, ctx.patients.length)).map((patient) => patient.index),
  );

  const seen = ctx.planned
    .map((entry, index) => ({ entry, index }))
    .filter(
      ({ entry }) =>
        entry.startsAt <= ctx.now &&
        entry.procedure !== null &&
        (entry.status === APPOINTMENT_STATUS.COMPLETED ||
          entry.status === APPOINTMENT_STATUS.IN_PROGRESS) &&
        (showcase.has(entry.patientIndex) || ctx.rng.bool(0.24)),
    );

  const visitValues = seen.map(({ entry }) => ({
    id: randomUUID(),
    clinicId: ctx.clinicId,
    patientId: ctx.patients[entry.patientIndex]?.id as string,
    doctorId: entry.doctorId,
    visitDate: entry.startsAt,
    complaint: ctx.rng.pick(COMPLAINTS),
    examination: ctx.rng.pick(EXAMINATIONS),
    diagnosis: ctx.rng.pick(DIAGNOSES),
    createdAt: entry.startsAt,
    ...ctx.audit,
  }));

  if (visitValues.length > 0) {
    await db.insert(visits).values(visitValues);
  }

  for (const [position, { index }] of seen.entries()) {
    const appointmentId = appointmentRows[index]?.id;
    const visitId = visitValues[position]?.id;

    if (appointmentId && visitId) {
      await db
        .update(appointments)
        .set({ visitId, updatedAt: new Date() })
        .where(eq(appointments.id, appointmentId));
    }
  }

  const procedures: ProcedureRecord[] = [];
  const marks: (typeof chartMarks.$inferInsert)[] = [];

  for (const [position, { entry }] of seen.entries()) {
    const visitId = visitValues[position]?.id as string;
    const patient = ctx.patients[entry.patientIndex];
    const booked = entry.procedure;

    if (!patient || !booked) {
      continue;
    }

    const items = [booked, ...(ctx.rng.bool(0.35) ? [CATALOG[0] as (typeof CATALOG)[number]] : [])];

    for (const item of items) {
      const price = Number(item.defaultPrice);
      const discount = discountFor(ctx.rng, price);
      const status = procedureStatus(ctx.rng, true);
      const id = randomUUID();
      const teeth = teethFor(patient.ageYears);
      const tooth = item.chartOutcome ? ctx.rng.pick(teeth) : null;

      procedures.push({
        id,
        patientId: patient.id,
        patientIndex: entry.patientIndex,
        visitId,
        doctorId: entry.doctorId,
        code: item.code,
        price: item.defaultPrice,
        discount: discount.amount,
        discountReason: discount.reason,
        status,
        performedAt: entry.startsAt,
        needsLab: item.needsLab === true,
        tooth,
      });

      if (tooth !== null) {
        marks.push({
          clinicId: ctx.clinicId,
          performedProcedureId: id,
          chartType: CHART_MARK_TYPE,
          location: toothLocation(ctx.rng, tooth),
          tooth,
          createdAt: entry.startsAt,
          ...ctx.audit,
        });
      }
    }
  }

  await insertInChunks(
    procedures.map((procedure) => ({
      id: procedure.id,
      clinicId: ctx.clinicId,
      patientId: procedure.patientId,
      visitId: procedure.visitId,
      doctorId: procedure.doctorId,
      procedureId: ctx.catalogIdByCode.get(procedure.code) as string,
      price: procedure.price,
      discount: procedure.discount,
      discountReason: procedure.discountReason,
      status: procedure.status,
      performedAt: procedure.performedAt,
      createdAt: procedure.performedAt,
      ...ctx.audit,
    })),
    (rows) => db.insert(performedProcedures).values(rows),
  );

  await insertInChunks(marks, (rows) => db.insert(chartMarks).values(rows));

  const plans = await writePlans(db, ctx);
  const scripts = await writePrescriptions(db, ctx, visitValues);

  return {
    counts: {
      visits: visitValues.length,
      performedProcedures: procedures.length,
      chartMarks: marks.length,
      ...plans,
      ...scripts,
    },
    procedures,
  };
}

async function writePlans(db: Database, ctx: WriteContext): Promise<SeedCounts> {
  const chosen = ctx.rng.sample(ctx.patients, 15);
  const planValues = chosen.map((patient, index) => ({
    id: randomUUID(),
    clinicId: ctx.clinicId,
    patientId: patient.id,
    doctorId: ctx.doctorIds[index % ctx.doctorIds.length] as string,
    title: planTitle(ctx.rng),
    notes: planNotes(ctx.rng),
    status: PLAN_STATUSES[index % PLAN_STATUSES.length] as (typeof PLAN_STATUSES)[number],
    createdAt: earlier(ctx.now, ctx.rng.int(10, 300)),
    ...ctx.audit,
  }));

  if (planValues.length === 0) {
    return { treatmentPlans: 0, treatmentPlanItems: 0 };
  }

  await db.insert(treatmentPlans).values(planValues);

  const items = planValues.flatMap((plan, planIndex) =>
    ctx.rng.sample(CATALOG.slice(1), ctx.rng.int(2, 5)).map((entry, sortOrder) => ({
      clinicId: ctx.clinicId,
      treatmentPlanId: plan.id,
      procedureId: ctx.catalogIdByCode.get(entry.code) as string,
      estimatedPrice: entry.defaultPrice,
      sortOrder,
      status:
        plan.status === TREATMENT_PLAN_STATUS.COMPLETED
          ? TREATMENT_PLAN_ITEM_STATUS.CONVERTED
          : (PLAN_ITEM_STATUSES[
              (planIndex + sortOrder) % PLAN_ITEM_STATUSES.length
            ] as (typeof PLAN_ITEM_STATUSES)[number]),
      createdAt: new Date(plan.createdAt.getTime() + sortOrder * 2 * 86_400_000),
      ...ctx.audit,
    })),
  );

  await insertInChunks(items, (rows) => db.insert(treatmentPlanItems).values(rows));

  return { treatmentPlans: planValues.length, treatmentPlanItems: items.length };
}

async function writePrescriptions(
  db: Database,
  ctx: WriteContext,
  visitValues: readonly {
    readonly id: string;
    readonly patientId: string;
    readonly doctorId: string;
    readonly visitDate: Date;
  }[],
): Promise<SeedCounts> {
  const chosen = visitValues.filter(() => ctx.rng.bool(0.18));

  if (chosen.length === 0) {
    return { prescriptions: 0 };
  }

  await insertInChunks(
    chosen.map((visit) => ({
      clinicId: ctx.clinicId,
      patientId: visit.patientId,
      visitId: visit.id,
      doctorId: visit.doctorId,
      items: prescriptionItems(ctx.rng),
      createdAt: visit.visitDate,
      ...ctx.audit,
    })),
    (rows) => db.insert(prescriptions).values(rows),
  );

  return { prescriptions: chosen.length };
}

// Charges are never written here: `ChargesService` decides what is owed, and it is the same
// instance the API uses, so "planned work is not billed" holds for the seed too.
async function writeMoney(
  db: Database,
  ctx: WriteContext,
  procedures: readonly ProcedureRecord[],
): Promise<SeedCounts> {
  const chargesService = new ChargesService(db);

  for (const procedure of procedures) {
    await chargesService.onProcedureRecorded(db, {
      clinicId: ctx.clinicId,
      patientId: procedure.patientId,
      performedProcedureId: procedure.id,
      price: procedure.price,
      discount: procedure.discount,
      discountReason: procedure.discountReason,
      status: procedure.status,
      actorId: ctx.actorId,
    });
  }

  // Two corrections: a price amended after the fact, which is a reversal and a new figure — the
  // only way the ledger allows a number to change.
  const amended = ctx.rng.sample(procedures, 2);
  for (const procedure of amended) {
    await chargesService.onProcedureAmended(db, {
      clinicId: ctx.clinicId,
      patientId: procedure.patientId,
      performedProcedureId: procedure.id,
      price: String(Math.round(Number(procedure.price) * 0.8)) + ".00",
      discount: "0.00",
      discountReason: "تصحيح السعر",
      status: procedure.status,
      actorId: ctx.actorId,
    });
  }

  // Dated with the work so a statement reads in the order it happened; `charges.created_at`
  // defaults to now, which would put a year of history on one afternoon.
  for (const procedure of procedures) {
    await db
      .update(charges)
      .set({ createdAt: procedure.performedAt })
      .where(
        and(eq(charges.performedProcedureId, procedure.id), eq(charges.clinicId, ctx.clinicId)),
      );
  }

  const owedByPatient = new Map<string, { owed: number; last: Date }>();
  for (const procedure of procedures) {
    const current = owedByPatient.get(procedure.patientId) ?? {
      owed: 0,
      last: procedure.performedAt,
    };
    owedByPatient.set(procedure.patientId, {
      owed: current.owed + Number(procedure.price) - Number(procedure.discount),
      last: procedure.performedAt > current.last ? procedure.performedAt : current.last,
    });
  }

  const entries = [...owedByPatient.entries()];
  const overdue = new Set(ctx.rng.sample(entries, 10).map(([patientId]) => patientId));
  let receipts = 0;

  for (const [patientId, { owed, last }] of entries) {
    if (owed <= 0) {
      continue;
    }

    const share = overdue.has(patientId) ? ctx.rng.next() * 0.5 : 1;
    const instalments = ctx.rng.bool(0.4) ? ctx.rng.int(2, 3) : 1;
    const total = Math.round(owed * share);

    for (let index = 0; index < instalments && total > 0; index += 1) {
      const amount =
        index === instalments - 1
          ? total - Math.floor(total / instalments) * (instalments - 1)
          : Math.floor(total / instalments);

      if (amount <= 0) {
        continue;
      }

      const receiptNumber = await nextReceiptNumber(db, ctx.clinicId);
      receipts += 1;

      await db.insert(payments).values({
        clinicId: ctx.clinicId,
        patientId,
        amount: `${amount}.00`,
        method: ctx.rng.pick([
          PAYMENT_METHOD.CASH,
          PAYMENT_METHOD.CASH,
          PAYMENT_METHOD.CARD,
          PAYMENT_METHOD.TRANSFER,
        ]),
        note: instalments > 1 ? `دفعة ${index + 1} من ${instalments}` : "تسديد",
        receiptNumber,
        receivedBy: ctx.actorId,
        createdAt: paidAt(last, index, ctx),
        ...ctx.audit,
      });
    }
  }

  return { charges: procedures.length + amended.length * 2, payments: receipts };
}

async function writeLabs(
  db: Database,
  ctx: WriteContext,
  procedures: readonly ProcedureRecord[],
): Promise<SeedCounts> {
  const labRows = await db
    .insert(labs)
    .values(
      LABS.map((lab) => ({
        clinicId: ctx.clinicId,
        name: lab.name,
        phone: lab.phone,
        address: lab.address,
        contactPerson: lab.contactPerson,
        ...ctx.audit,
      })),
    )
    .returning({ id: labs.id });

  const workTypeRows = await db
    .insert(labWorkTypes)
    .values(
      LABS.flatMap((lab, index) =>
        lab.workTypes.map((type) => ({
          labId: labRows[index]?.id as string,
          name: type.name,
          defaultPrice: type.defaultPrice,
          ...ctx.audit,
        })),
      ),
    )
    .returning({
      id: labWorkTypes.id,
      labId: labWorkTypes.labId,
      price: labWorkTypes.defaultPrice,
    });

  // Newest first: work that is still at the lab belongs to the last few weeks, and a crown sent
  // eleven months ago and never received would be a bug rather than a demo.
  const labWork = [...procedures]
    .filter((procedure) => procedure.needsLab)
    .sort((left, right) => right.performedAt.getTime() - left.performedAt.getTime())
    .slice(0, 40);

  const settled: readonly LabOrderStatus[] = [
    LAB_ORDER_STATUS.FITTED,
    LAB_ORDER_STATUS.FITTED,
    LAB_ORDER_STATUS.RECEIVED,
    LAB_ORDER_STATUS.FITTED,
    LAB_ORDER_STATUS.CANCELLED,
    LAB_ORDER_STATUS.FITTED,
  ];

  const orders = labWork.map((procedure, index) => {
    const labIndex = index % labRows.length;
    const labId = labRows[labIndex]?.id as string;
    const types = workTypeRows.filter((type) => type.labId === labId);
    const workType = types[index % Math.max(1, types.length)];
    const overdue = index === 0 || index === 1;
    const status =
      overdue || index === 4
        ? LAB_ORDER_STATUS.SENT
        : index === 2
          ? LAB_ORDER_STATUS.RETURNED
          : index === 3
            ? LAB_ORDER_STATUS.READY
            : index === 5
              ? LAB_ORDER_STATUS.DRAFT
              : (settled[index % settled.length] as LabOrderStatus);

    const sentAt = status === LAB_ORDER_STATUS.DRAFT ? null : procedure.performedAt;
    const expectedAt = sentAt
      ? overdue
        ? earlier(ctx.now, ctx.rng.int(3, 9))
        : status === LAB_ORDER_STATUS.SENT || status === LAB_ORDER_STATUS.READY
          ? new Date(ctx.now.getTime() + ctx.rng.int(2, 9) * 86_400_000)
          : new Date(sentAt.getTime() + 7 * 86_400_000)
      : null;

    return {
      clinicId: ctx.clinicId,
      labId,
      patientId: procedure.patientId,
      doctorId: procedure.doctorId,
      performedProcedureId: procedure.id,
      workTypeId: workType?.id ?? null,
      material: ctx.rng.pick(LAB_MATERIALS),
      shade: ctx.rng.pick(LAB_SHADES),
      teeth: procedure.tooth === null ? [] : [procedure.tooth],
      instructions: ctx.rng.pick(LAB_INSTRUCTIONS),
      price: workType?.price ?? "300.00",
      status,
      sentAt,
      expectedAt,
      receivedAt:
        status === LAB_ORDER_STATUS.RECEIVED || status === LAB_ORDER_STATUS.FITTED
          ? new Date(procedure.performedAt.getTime() + 6 * 86_400_000)
          : null,
      fittedAt:
        status === LAB_ORDER_STATUS.FITTED
          ? new Date(procedure.performedAt.getTime() + 9 * 86_400_000)
          : null,
      returnReason: status === LAB_ORDER_STATUS.RETURNED ? "Margins do not fit" : null,
      createdAt: procedure.performedAt,
      ...ctx.audit,
    };
  });

  if (orders.length > 0) {
    await db.insert(labOrders).values(orders);
  }

  const paymentValues = labRows.map((lab, index) => {
    const billed = orders
      .filter((order) => order.labId === lab.id && order.status !== LAB_ORDER_STATUS.DRAFT)
      .reduce((sum, order) => sum + Number(order.price), 0);

    return {
      clinicId: ctx.clinicId,
      labId: lab.id,
      amount: `${Math.round(billed * (index === 0 ? 0.6 : 0.35))}.00`,
      method: PAYMENT_METHOD.TRANSFER,
      note: "Payment on account",
      paidBy: ctx.actorId,
      createdAt: earlier(ctx.now, 20 + index * 9),
      ...ctx.audit,
    };
  });

  await db.insert(labPayments).values(paymentValues.filter((row) => Number(row.amount) > 0));

  return { labs: labRows.length, labOrders: orders.length, labPayments: paymentValues.length };
}

async function writeInventory(
  db: Database,
  ctx: WriteContext,
  procedures: readonly ProcedureRecord[],
): Promise<SeedCounts> {
  const supplierRows = await db
    .insert(suppliers)
    .values(
      SUPPLIERS.map((supplier) => ({
        clinicId: ctx.clinicId,
        name: supplier.name,
        phone: supplier.phone,
        contactPerson: supplier.contactPerson,
        ...ctx.audit,
      })),
    )
    .returning({ id: suppliers.id });

  const itemRows = await db
    .insert(inventoryItems)
    .values(
      ITEMS.map((item) => ({
        clinicId: ctx.clinicId,
        name: item.name,
        category: item.category,
        unit: item.unit,
        minQuantity: item.minQuantity,
        defaultSupplierId: supplierRows[item.supplier]?.id ?? null,
        ...ctx.audit,
      })),
    )
    .returning({ id: inventoryItems.id });

  const movements: (typeof stockMovements.$inferInsert)[] = [];

  ITEMS.forEach((item, index) => {
    const itemId = itemRows[index]?.id as string;
    const minimum = Number(item.minQuantity);
    const short = index === 0 || index === 2;
    const purchases = ctx.rng.int(2, 4);

    for (let round = 0; round < purchases; round += 1) {
      const expired = item.perishable && index === 4 && round === 0;
      const nearExpiry = item.perishable && (index === 5 || index === 12) && round === 0;

      movements.push({
        clinicId: ctx.clinicId,
        itemId,
        type: MOVEMENT_TYPE.PURCHASE,
        quantity: String(Math.round(minimum * ctx.rng.int(2, 4))),
        unitPrice: item.unitPrice,
        expiryDate: item.perishable
          ? expired
            ? addDays(ctx.today, -20)
            : nearExpiry
              ? addDays(ctx.today, ctx.rng.int(10, 40))
              : addDays(ctx.today, ctx.rng.int(200, 640))
          : null,
        batchNo: item.perishable ? `B${1000 + index * 7 + round}` : null,
        supplierId: supplierRows[item.supplier]?.id ?? null,
        createdAt: earlier(ctx.now, 330 - round * 90),
        createdBy: ctx.actorId,
      });
    }

    const purchased = movements
      .filter((movement) => movement.itemId === itemId && movement.type === MOVEMENT_TYPE.PURCHASE)
      .reduce((sum, movement) => sum + Number(movement.quantity), 0);

    const consumed = short
      ? Math.max(1, purchased - Math.floor(minimum * 0.4))
      : Math.min(purchased * 0.6, minimum * ctx.rng.int(1, 2));
    const sessions = Math.max(1, Math.min(8, Math.round(consumed / Math.max(1, minimum / 2))));

    for (let session = 0; session < sessions; session += 1) {
      const procedure = procedures[(index * 5 + session * 3) % Math.max(1, procedures.length)];

      movements.push({
        clinicId: ctx.clinicId,
        itemId,
        type: MOVEMENT_TYPE.CONSUME,
        quantity: String(Math.max(1, Math.round(consumed / sessions))),
        patientId: procedure?.patientId ?? null,
        performedProcedureId: procedure?.id ?? null,
        createdAt: procedure?.performedAt ?? earlier(ctx.now, 30),
        createdBy: ctx.actorId,
      });
    }

    if (index % 7 === 3) {
      movements.push({
        clinicId: ctx.clinicId,
        itemId,
        type: MOVEMENT_TYPE.ADJUST,
        quantity: String(-ctx.rng.int(1, 3)),
        reason: ctx.rng.pick(ADJUST_REASONS),
        createdAt: earlier(ctx.now, ctx.rng.int(5, 60)),
        createdBy: ctx.actorId,
      });
    }
  });

  await insertInChunks(movements, (rows) => db.insert(stockMovements).values(rows));

  return {
    suppliers: supplierRows.length,
    inventoryItems: itemRows.length,
    stockMovements: movements.length,
  };
}

async function writeWaitingList(db: Database, ctx: WriteContext): Promise<SeedCounts> {
  const chosen = ctx.rng.sample(ctx.patients, 3);

  await db.insert(waitingList).values(
    chosen.map((patient, index) => ({
      clinicId: ctx.clinicId,
      patientId: patient.id,
      doctorId: index === 1 ? (ctx.doctorIds[0] as string) : null,
      reason: WAITING_REASONS[index] ?? WAITING_REASONS[0] ?? null,
      priority: index === 0 ? WAITING_LIST_PRIORITY.URGENT : WAITING_LIST_PRIORITY.NORMAL,
      source: index === 0 ? WAITING_LIST_SOURCE.ONLINE : WAITING_LIST_SOURCE.RECEPTION,
      status: index === 2 ? WAITING_LIST_STATUS.CONTACTED : WAITING_LIST_STATUS.PENDING,
      createdAt: earlier(ctx.now, index + 1),
      ...ctx.audit,
    })),
  );

  return { waitingList: chosen.length };
}

async function writeNotifications(
  db: Database,
  ctx: WriteContext,
  appointmentRows: readonly { readonly id: string }[],
): Promise<SeedCounts> {
  const recent = ctx.planned
    .map((entry, index) => ({ entry, id: appointmentRows[index]?.id }))
    .filter(
      ({ entry, id }) =>
        id !== undefined &&
        entry.startsAt.getTime() > ctx.now.getTime() - 7 * 86_400_000 &&
        entry.startsAt.getTime() < ctx.now.getTime() + 2 * 86_400_000,
    )
    .slice(0, 60);

  if (recent.length === 0) {
    return { notifications: 0 };
  }

  await db.insert(notificationsLog).values(
    recent.map(({ entry, id }, index) => ({
      clinicId: ctx.clinicId,
      to: `+9705999000${String(index).padStart(2, "0")}`,
      channel: NOTIFICATION_CHANNEL.SMS,
      template:
        index % 3 === 0
          ? NOTIFICATION_TEMPLATE.REMINDER_24H
          : index % 3 === 1
            ? NOTIFICATION_TEMPLATE.REMINDER_2H
            : NOTIFICATION_TEMPLATE.BOOKING_CONFIRMED,
      vars: { clinic: CLINIC_NAME.ar, time: entry.startsAt.toISOString() },
      status: index % 17 === 0 ? NOTIFICATION_STATUS.FAILED : NOTIFICATION_STATUS.SENT,
      error: index % 17 === 0 ? "gateway timeout" : null,
      appointmentId: id as string,
      createdAt: earlier(entry.startsAt, 1),
    })),
  );

  return { notifications: recent.length };
}

async function writeAbsences(db: Database, ctx: WriteContext): Promise<SeedCounts> {
  await db.insert(clinicClosures).values({
    clinicId: ctx.clinicId,
    startsOn: ctx.closureStart,
    endsOn: addDays(ctx.closureStart, 2),
    reason: "عطلة عيد",
    isAnnual: false,
    ...ctx.audit,
  });

  const firstDoctor = ctx.doctorIds[0] as string;
  const at = (isoDate: string, minute: number): Date =>
    instantFromLocal(isoDate, minute, CLINIC_TIME_ZONE);

  const overlapping = ctx.planned.find(
    (entry) =>
      entry.doctorId === firstDoctor &&
      entry.startsAt > ctx.now &&
      occupiesSlot(entry.status) &&
      !ctx.closureDates.has(entry.isoDate),
  );

  const absences = [
    {
      clinicId: ctx.clinicId,
      doctorId: firstDoctor,
      startsAt: at(ctx.cleanTimeOffDate, 9 * 60),
      endsAt: at(ctx.cleanTimeOffDate, 13 * 60),
      reason: "مؤتمر طب أسنان",
      ...ctx.audit,
    },
    ...(overlapping
      ? [
          {
            clinicId: ctx.clinicId,
            doctorId: firstDoctor,
            startsAt: at(overlapping.isoDate, Math.max(0, overlapping.startMinute - 30)),
            endsAt: at(overlapping.isoDate, overlapping.startMinute + 120),
            reason: "التزام شخصي",
            ...ctx.audit,
          },
        ]
      : []),
  ];

  await db.insert(doctorTimeOff).values(absences);

  return { clinicClosures: 1, doctorTimeOff: absences.length };
}

async function seedCatalog(
  db: Database,
  clinicId: string,
  specialtyId: string,
  audit: { readonly createdBy: string; readonly updatedBy: string },
): Promise<Map<string, string>> {
  const rows = await db
    .insert(procedureCatalog)
    .values(
      CATALOG.map((entry) => ({
        clinicId,
        specialtyId,
        code: entry.code,
        name: entry.name,
        defaultPrice: entry.defaultPrice,
        chartOutcome: entry.chartOutcome,
        ...audit,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: procedureCatalog.id, code: procedureCatalog.code });

  if (rows.length === CATALOG.length) {
    return new Map(rows.map((row) => [row.code, row.id]));
  }

  const existing = await db
    .select({ id: procedureCatalog.id, code: procedureCatalog.code })
    .from(procedureCatalog)
    .where(and(eq(procedureCatalog.clinicId, clinicId), isNull(procedureCatalog.deletedAt)));

  return new Map(existing.map((row) => [row.code, row.id]));
}

async function upsertSpecialty(db: Database, clinicId: string): Promise<string> {
  const [existing] = await db
    .select({ id: specialties.id })
    .from(specialties)
    .where(
      and(
        eq(specialties.clinicId, clinicId),
        eq(specialties.code, SPECIALTY_CODE.DENTAL),
        isNull(specialties.deletedAt),
      ),
    )
    .limit(1);

  if (existing) {
    return existing.id;
  }

  const [row] = await db
    .insert(specialties)
    .values({
      clinicId,
      code: SPECIALTY_CODE.DENTAL,
      name: "طب الأسنان",
      chartType: CHART_TYPE.TOOTH_FDI,
    })
    .returning({ id: specialties.id });

  if (!row) {
    throw new Error("Failed to create the seed specialty");
  }

  return row.id;
}

async function upsertDoctor(
  db: Database,
  clinicId: string,
  userId: string,
  specialtyId: string,
  weeklySchedule: (typeof DOCTOR_SCHEDULES)[number],
): Promise<string> {
  const [existing] = await db
    .select({ id: doctors.id })
    .from(doctors)
    .where(and(eq(doctors.userId, userId), isNull(doctors.deletedAt)))
    .limit(1);

  if (existing) {
    return existing.id;
  }

  const [row] = await db
    .insert(doctors)
    .values({
      clinicId,
      userId,
      specialtyId,
      weeklySchedule,
      defaultAppointmentDurationMinutes: 30,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning({ id: doctors.id });

  if (!row) {
    throw new Error("Failed to create the seed doctor");
  }

  return row.id;
}

/** Postgres takes at most 65535 bind parameters in one statement. */
async function insertInChunks<T>(
  rows: readonly T[],
  insert: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  const size = 500;

  for (let start = 0; start < rows.length; start += size) {
    await insert(rows.slice(start, start + size));
  }
}

// A week or so apart after the last treatment, and never later than an hour ago: a receipt dated
// next week is a payment that has not been taken.
function paidAt(lastTreatment: Date, instalment: number, ctx: WriteContext): Date {
  const planned = earlier(lastTreatment, -(instalment * 7 + ctx.rng.int(0, 5)));
  const latest = new Date(ctx.now.getTime() - 3_600_000);

  return planned > latest ? latest : planned;
}

function earlier(from: Date, days: number): Date {
  return new Date(from.getTime() - days * 86_400_000);
}

function ageOf(dateOfBirth: string, today: string): number {
  const born = Number(dateOfBirth.slice(0, 4));
  const now = Number(today.slice(0, 4));

  return Math.max(0, now - born);
}

function nextWorkingDay(from: string, offset: number, closed: ReadonlySet<string>): string {
  for (let step = offset; step < offset + 14; step += 1) {
    const candidate = addDays(from, step);
    const weekday = localWeekday(candidate, CLINIC_TIME_ZONE);

    if (!closed.has(candidate) && CLINIC_HOURS.some((day) => day.weekday === weekday)) {
      return candidate;
    }
  }

  return addDays(from, offset);
}
