import { LAB_ORDER_STATUS, PAYMENT_METHOD, type LabOrderStatus } from '@clinic/shared';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/postgres-js';

import { labOrders, labPayments, labWorkTypes, labs, patients } from '@api/database/schema';

type Db = ReturnType<typeof drizzle>;

export interface LabsSeedContext {
  readonly clinicId: string;
  /** Both doctors, so orders are not all from the same chair. */
  readonly doctorIds: readonly string[];
  readonly actorId: string;
}

/**
 * The price list every dental lab has, in the words a Syrian clinic uses.
 *
 * Two labs with different prices for the same work, because that is the
 * situation the per-lab price list exists for: the clinic chooses where to
 * send a case partly on what it costs.
 */
const WORK_TYPES: readonly {
  readonly nameAr: string;
  readonly prices: readonly [string, string];
}[] = [
  { nameAr: 'تاج زيركون', prices: ['45.00', '52.00'] },
  { nameAr: 'تاج خزف على معدن', prices: ['30.00', '34.00'] },
  { nameAr: 'جسر ثلاثي', prices: ['120.00', '140.00'] },
  { nameAr: 'طقم كامل', prices: ['180.00', '210.00'] },
  { nameAr: 'طقم جزئي', prices: ['110.00', '125.00'] },
  { nameAr: 'فينير', prices: ['60.00', '70.00'] },
  { nameAr: 'حارس ليلي', prices: ['40.00', '45.00'] },
  { nameAr: 'جهاز تقويم متحرك', prices: ['85.00', '95.00'] },
];

const LABS: readonly {
  readonly name: string;
  readonly phone: string;
  readonly address: string;
  readonly contactPerson: string;
}[] = [
  {
    name: 'مخبر الشام للأسنان',
    phone: '+963112223344',
    address: 'دمشق — المزة',
    contactPerson: 'أبو خالد',
  },
  {
    name: 'مخبر الدقة',
    phone: '+963115556677',
    address: 'دمشق — الميدان',
    contactPerson: 'م. رنا',
  },
];

interface SeedOrder {
  /** Index into `LABS`. */
  readonly lab: number;
  /** Index into `WORK_TYPES`. */
  readonly workType: number;
  /** Index into the clinic's patients, in file-number order. */
  readonly patient: number;
  readonly doctor: number;
  readonly teeth: readonly number[];
  readonly material: string;
  readonly shade: string;
  readonly status: LabOrderStatus;
  /** Days from today; negative is the past. */
  readonly sentDays: number | null;
  readonly expectedDays: number | null;
  readonly instructions?: string;
  readonly returnReason?: string;
}

/**
 * A board that looks like a real week.
 *
 * One order in each state the technician actually sees, plus the two that make
 * the screens worth opening: **one overdue** — sent, due three days ago, still
 * not back — and **one returned**, which is the case that proves the balance
 * rule (the lab made it, so the clinic still owes for it).
 */
const ORDERS: readonly SeedOrder[] = [
  {
    lab: 0,
    workType: 0,
    patient: 0,
    doctor: 0,
    teeth: [26],
    material: 'زيركون',
    shade: 'A2',
    status: LAB_ORDER_STATUS.DRAFT,
    sentDays: null,
    expectedDays: 7,
    instructions: 'تماس خفيف مع الضرس المجاور',
  },
  {
    lab: 0,
    workType: 1,
    patient: 1,
    doctor: 0,
    teeth: [36],
    material: 'خزف على معدن',
    shade: 'A3',
    status: LAB_ORDER_STATUS.SENT,
    sentDays: -2,
    expectedDays: 4,
  },
  {
    // Late: promised three days ago and still at the lab.
    lab: 1,
    workType: 2,
    patient: 2,
    doctor: 1,
    teeth: [14, 15, 16],
    material: 'زيركون',
    shade: 'B1',
    status: LAB_ORDER_STATUS.SENT,
    sentDays: -12,
    expectedDays: -3,
    instructions: 'جسر ثلاثي — الاهتمام بمنطقة التماس اللثوي',
  },
  {
    lab: 0,
    workType: 5,
    patient: 3,
    doctor: 0,
    teeth: [11, 12, 21, 22],
    material: 'إيماكس',
    shade: 'BL2',
    status: LAB_ORDER_STATUS.READY,
    sentDays: -6,
    expectedDays: 1,
  },
  {
    lab: 1,
    workType: 3,
    patient: 4,
    doctor: 1,
    teeth: [],
    material: 'أكريل حراري',
    shade: 'A3',
    status: LAB_ORDER_STATUS.RECEIVED,
    sentDays: -14,
    expectedDays: -4,
  },
  {
    lab: 0,
    workType: 0,
    patient: 5,
    doctor: 0,
    teeth: [46],
    material: 'زيركون',
    shade: 'A2',
    status: LAB_ORDER_STATUS.FITTED,
    sentDays: -20,
    expectedDays: -12,
  },
  {
    // Came back wrong and went out again — and still counts on the statement.
    lab: 1,
    workType: 0,
    patient: 6,
    doctor: 1,
    teeth: [24],
    material: 'زيركون',
    shade: 'A1',
    status: LAB_ORDER_STATUS.RETURNED,
    sentDays: -9,
    expectedDays: -2,
    returnReason: 'التاج مرتفع بالإطباق ولا يجلس بشكل كامل',
  },
  {
    // Cancelled before it was sent, so it never enters the balance at all.
    lab: 0,
    workType: 6,
    patient: 7,
    doctor: 0,
    teeth: [],
    material: 'أكريل شفاف',
    shade: '—',
    status: LAB_ORDER_STATUS.CANCELLED,
    sentDays: null,
    expectedDays: null,
  },
];

/** Partial on purpose: a lab with a settled balance shows nothing worth seeing. */
const PAYMENTS: readonly {
  readonly lab: number;
  readonly amount: string;
  readonly note: string;
}[] = [
  { lab: 0, amount: '60.00', note: 'دفعة على حساب' },
  { lab: 0, amount: '25.00', note: 'تسوية نصف شهرية' },
  { lab: 1, amount: '100.00', note: 'دفعة على حساب' },
];

/**
 * Two labs, their price lists, a week of orders and some money paid.
 *
 * Idempotent like the rest of the seed: it returns early once this clinic has
 * a lab, so `pnpm seed` stays safe to repeat.
 */
export async function seedLabs(
  db: Db,
  ctx: LabsSeedContext,
): Promise<{ labs: number; orders: number; payments: number }> {
  const [existing] = await db
    .select({ id: labs.id })
    .from(labs)
    .where(and(eq(labs.clinicId, ctx.clinicId), isNull(labs.deletedAt)))
    .limit(1);

  if (existing) {
    return { labs: 0, orders: 0, payments: 0 };
  }

  const patientRows = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.clinicId, ctx.clinicId), isNull(patients.deletedAt)))
    .orderBy(asc(patients.fileNumber));

  if (patientRows.length === 0 || ctx.doctorIds.length === 0) {
    return { labs: 0, orders: 0, payments: 0 };
  }

  const audit = { createdBy: ctx.actorId, updatedBy: ctx.actorId };

  const labIds: string[] = [];
  const workTypeIds: string[][] = [];

  for (const [index, lab] of LABS.entries()) {
    const [row] = await db
      .insert(labs)
      .values({ clinicId: ctx.clinicId, ...lab, ...audit })
      .returning({ id: labs.id });

    /* istanbul ignore next -- insert ... returning always yields a row. */
    if (!row) {
      throw new Error('Failed to seed the lab');
    }

    labIds.push(row.id);

    const prices = await db
      .insert(labWorkTypes)
      .values(
        WORK_TYPES.map((workType) => ({
          labId: row.id,
          nameAr: workType.nameAr,
          defaultPrice: workType.prices[index] ?? workType.prices[0],
          ...audit,
        })),
      )
      .returning({ id: labWorkTypes.id });

    workTypeIds.push(prices.map((price) => price.id));
  }

  const patientId = (index: number): string => {
    const row = patientRows[index % patientRows.length];

    /* istanbul ignore next -- the modulo keeps this in range. */
    if (!row) {
      throw new Error('Seeded patient is missing');
    }

    return row.id;
  };

  const doctorId = (index: number): string => {
    const id = ctx.doctorIds[index % ctx.doctorIds.length];

    /* istanbul ignore next -- the modulo keeps this in range. */
    if (!id) {
      throw new Error('Seeded doctor is missing');
    }

    return id;
  };

  await db.insert(labOrders).values(
    ORDERS.map((order) => {
      const labId = labIds[order.lab] ?? labIds[0] ?? '';
      const workTypeId = workTypeIds[order.lab]?.[order.workType] ?? null;
      const price = WORK_TYPES[order.workType]?.prices[order.lab] ?? '0.00';

      return {
        clinicId: ctx.clinicId,
        labId,
        patientId: patientId(order.patient),
        doctorId: doctorId(order.doctor),
        workTypeId,
        material: order.material,
        shade: order.shade,
        teeth: [...order.teeth],
        instructions: order.instructions ?? null,
        price,
        status: order.status,
        sentAt: order.sentDays === null ? null : shift(order.sentDays),
        expectedAt: order.expectedDays === null ? null : shift(order.expectedDays),
        // Received and fitted follow from the status, exactly as the
        // transitions would have written them.
        receivedAt:
          order.status === LAB_ORDER_STATUS.RECEIVED || order.status === LAB_ORDER_STATUS.FITTED
            ? shift((order.expectedDays ?? 0) + 1)
            : null,
        fittedAt:
          order.status === LAB_ORDER_STATUS.FITTED ? shift((order.expectedDays ?? 0) + 3) : null,
        returnReason: order.returnReason ?? null,
        ...audit,
      };
    }),
  );

  await db.insert(labPayments).values(
    PAYMENTS.map((payment) => ({
      clinicId: ctx.clinicId,
      labId: labIds[payment.lab] ?? labIds[0] ?? '',
      amount: payment.amount,
      method: PAYMENT_METHOD.CASH,
      note: payment.note,
      paidBy: ctx.actorId,
      ...audit,
    })),
  );

  return { labs: LABS.length, orders: ORDERS.length, payments: PAYMENTS.length };
}

const shift = (days: number): Date => new Date(Date.now() + days * 86_400_000);
