import {
  ITEM_CATEGORY,
  ITEM_UNIT,
  MOVEMENT_TYPE,
  type ItemCategory,
  type ItemUnit,
} from '@clinic/shared';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/postgres-js';

import {
  inventoryItems,
  patients,
  performedProcedures,
  stockMovements,
  suppliers,
} from '@api/database/schema';

type Db = ReturnType<typeof drizzle>;

export interface InventorySeedContext {
  readonly clinicId: string;
  readonly actorId: string;
}

/**
 * Who a Damascus dental clinic actually buys from: a general dental depot, a
 * pharmaceutical wholesaler for the anaesthetic, and the shop that services
 * the autoclave.
 */
const SUPPLIERS: readonly {
  readonly name: string;
  readonly phone: string;
  readonly contactPerson: string;
}[] = [
  { name: 'مستودع الشام لمواد الأسنان', phone: '+963113334455', contactPerson: 'أبو عمار' },
  { name: 'شركة الفارابي الطبية', phone: '+963114445566', contactPerson: 'م. هدى' },
  { name: 'مؤسسة التعقيم الحديثة', phone: '+963115556644', contactPerson: 'م. سامر' },
];

interface SeedItem {
  readonly nameAr: string;
  readonly category: ItemCategory;
  readonly unit: ItemUnit;
  readonly minQuantity: string;
  /** Index into `SUPPLIERS`. */
  readonly supplier: number;
  readonly notes?: string;
  /** Purchases: quantity, unit price, days ago, days until expiry, lot number. */
  readonly purchases: readonly {
    readonly quantity: string;
    readonly price: string;
    readonly daysAgo: number;
    readonly expiresInDays?: number;
    readonly batchNo?: string;
  }[];
  /** Total used since, spread over a few movements. */
  readonly consumed?: string;
  /** A stock take that found the count wrong. */
  readonly adjust?: { readonly quantity: string; readonly reason: string };
}

/**
 * Fifteen things that are genuinely in a dental clinic's cupboard.
 *
 * Chosen so the screens have something to say rather than to fill a table: one
 * item is below its minimum (the gloves — the thing that always runs out),
 * one batch of anaesthetic goes off inside the warning window, one composite
 * shade has already expired, and one item carries an adjustment from a stock
 * take that found fewer than the ledger said.
 */
const ITEMS: readonly SeedItem[] = [
  {
    nameAr: 'مخدر موضعي ليدوكائين 2%',
    category: ITEM_CATEGORY.MEDICATION,
    unit: ITEM_UNIT.AMPOULE,
    minQuantity: '50',
    supplier: 1,
    notes: 'يُحفظ بعيداً عن الضوء',
    purchases: [
      { quantity: '100', price: '0.45', daysAgo: 120, expiresInDays: 400, batchNo: 'LX-2451' },
      // The batch the alert is about: still in date, but not for long.
      { quantity: '100', price: '0.48', daysAgo: 40, expiresInDays: 35, batchNo: 'LX-2688' },
    ],
    consumed: '96',
  },
  {
    nameAr: 'مخدر موضعي أرتيكائين 4%',
    category: ITEM_CATEGORY.MEDICATION,
    unit: ITEM_UNIT.AMPOULE,
    minQuantity: '30',
    supplier: 1,
    purchases: [
      { quantity: '50', price: '0.75', daysAgo: 60, expiresInDays: 300, batchNo: 'AR-118' },
    ],
    consumed: '12',
  },
  {
    nameAr: 'قفازات فحص لاتكس — قياس M',
    category: ITEM_CATEGORY.CONSUMABLE,
    unit: ITEM_UNIT.BOX,
    minQuantity: '10',
    supplier: 0,
    notes: 'علبة 100 قفاز',
    // The item that is always about to run out, and is: 12 bought, 9 used.
    purchases: [{ quantity: '12', price: '4.50', daysAgo: 50, batchNo: 'GLV-77' }],
    consumed: '9',
  },
  {
    nameAr: 'قفازات فحص نتريل — قياس S',
    category: ITEM_CATEGORY.CONSUMABLE,
    unit: ITEM_UNIT.BOX,
    minQuantity: '5',
    supplier: 0,
    purchases: [{ quantity: '20', price: '5.20', daysAgo: 30 }],
    consumed: '6',
  },
  {
    nameAr: 'كمامات جراحية ثلاثية',
    category: ITEM_CATEGORY.CONSUMABLE,
    unit: ITEM_UNIT.BOX,
    minQuantity: '8',
    supplier: 0,
    purchases: [{ quantity: '25', price: '2.80', daysAgo: 45 }],
    consumed: '11',
  },
  {
    nameAr: 'حشوة كومبوزيت A2',
    category: ITEM_CATEGORY.CONSUMABLE,
    unit: ITEM_UNIT.PIECE,
    minQuantity: '15',
    supplier: 0,
    notes: 'محقن 4 غ',
    purchases: [
      { quantity: '30', price: '3.10', daysAgo: 200, expiresInDays: 420, batchNo: 'CMP-A2-19' },
    ],
    consumed: '9',
  },
  {
    nameAr: 'حشوة كومبوزيت A3',
    category: ITEM_CATEGORY.CONSUMABLE,
    unit: ITEM_UNIT.PIECE,
    minQuantity: '15',
    supplier: 0,
    // Already gone off, and still on the shelf — which is exactly what the
    // expired list is for.
    purchases: [
      { quantity: '20', price: '3.10', daysAgo: 400, expiresInDays: -20, batchNo: 'CMP-A3-04' },
      { quantity: '25', price: '3.35', daysAgo: 30, expiresInDays: 500, batchNo: 'CMP-A3-31' },
    ],
    consumed: '14',
  },
  {
    nameAr: 'أسيد إتش 37%',
    category: ITEM_CATEGORY.CONSUMABLE,
    unit: ITEM_UNIT.ML,
    minQuantity: '20',
    supplier: 0,
    purchases: [
      { quantity: '120', price: '0.22', daysAgo: 90, expiresInDays: 280, batchNo: 'ETCH-9' },
    ],
    consumed: '37.5',
  },
  {
    nameAr: 'لاصق أسنان (بوندينغ)',
    category: ITEM_CATEGORY.CONSUMABLE,
    unit: ITEM_UNIT.ML,
    minQuantity: '10',
    supplier: 0,
    purchases: [
      { quantity: '50', price: '1.90', daysAgo: 75, expiresInDays: 200, batchNo: 'BND-55' },
    ],
    consumed: '18.5',
  },
  {
    nameAr: 'إبر تخدير 27G',
    category: ITEM_CATEGORY.CONSUMABLE,
    unit: ITEM_UNIT.BOX,
    minQuantity: '6',
    supplier: 1,
    notes: 'علبة 100 إبرة',
    purchases: [{ quantity: '15', price: '3.40', daysAgo: 65 }],
    consumed: '5',
  },
  {
    nameAr: 'مبارد قناة جذر — طقم',
    category: ITEM_CATEGORY.TOOL,
    unit: ITEM_UNIT.PACK,
    minQuantity: '4',
    supplier: 0,
    purchases: [{ quantity: '10', price: '8.75', daysAgo: 150 }],
    consumed: '3',
  },
  {
    nameAr: 'مرايا فحص',
    category: ITEM_CATEGORY.TOOL,
    unit: ITEM_UNIT.PIECE,
    minQuantity: '10',
    supplier: 0,
    purchases: [{ quantity: '24', price: '1.25', daysAgo: 220 }],
    // The stock take that found two missing — the one adjustment in the seed.
    adjust: { quantity: '-2', reason: 'جرد شهري: نقص قطعتين' },
    consumed: '4',
  },
  {
    nameAr: 'أكياس تعقيم ذاتية اللصق',
    category: ITEM_CATEGORY.STERILIZATION,
    unit: ITEM_UNIT.BOX,
    minQuantity: '5',
    supplier: 2,
    notes: 'علبة 200 كيس',
    purchases: [{ quantity: '12', price: '6.00', daysAgo: 55 }],
    consumed: '4',
  },
  {
    nameAr: 'شرائط اختبار الأوتوكلاف',
    category: ITEM_CATEGORY.STERILIZATION,
    unit: ITEM_UNIT.PACK,
    minQuantity: '3',
    supplier: 2,
    purchases: [
      { quantity: '8', price: '4.20', daysAgo: 85, expiresInDays: 240, batchNo: 'STR-12' },
    ],
    consumed: '2',
  },
  {
    nameAr: 'محلول تعقيم السطوح',
    category: ITEM_CATEGORY.STERILIZATION,
    unit: ITEM_UNIT.ML,
    minQuantity: '500',
    supplier: 2,
    purchases: [
      { quantity: '5000', price: '0.01', daysAgo: 70, expiresInDays: 330, batchNo: 'DIS-3' },
    ],
    consumed: '1750',
  },
];

/**
 * Fills the cupboard, then uses some of it.
 *
 * The history is written as movements and nothing else — there is no quantity
 * to seed, because there is no quantity column (CLAUDE.md). Every number the
 * screens show is the sum of what this function inserts, which makes the seed
 * itself a check on the ledger: if the items screen disagrees with the
 * arithmetic here, one of the two is wrong.
 *
 * A couple of the consumptions are attached to real performed procedures, so
 * the patient timeline has stock on it and the "used on this patient" path is
 * exercised rather than merely implemented.
 */
export async function seedInventory(
  db: Db,
  ctx: InventorySeedContext,
): Promise<{ suppliers: number; items: number; movements: number }> {
  const existing = await db
    .select({ id: inventoryItems.id })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.clinicId, ctx.clinicId), isNull(inventoryItems.deletedAt)))
    .limit(1);

  if (existing.length > 0) {
    return { suppliers: 0, items: 0, movements: 0 };
  }

  const audit = { createdBy: ctx.actorId, updatedBy: ctx.actorId };

  const supplierRows = await db
    .insert(suppliers)
    .values(
      SUPPLIERS.map((supplier) => ({
        clinicId: ctx.clinicId,
        name: supplier.name,
        phone: supplier.phone,
        contactPerson: supplier.contactPerson,
        ...audit,
      })),
    )
    .returning({ id: suppliers.id });

  const supplierIds = supplierRows.map((row) => row.id);

  const itemRows = await db
    .insert(inventoryItems)
    .values(
      ITEMS.map((item) => ({
        clinicId: ctx.clinicId,
        nameAr: item.nameAr,
        category: item.category,
        unit: item.unit,
        minQuantity: item.minQuantity,
        defaultSupplierId: supplierIds[item.supplier] ?? null,
        notes: item.notes ?? null,
        ...audit,
      })),
    )
    .returning({ id: inventoryItems.id, nameAr: inventoryItems.nameAr });

  const itemId = new Map(itemRows.map((row) => [row.nameAr, row.id]));

  /* Two treatments to hang a couple of consumptions on. */
  const procedures = await db
    .select({ id: performedProcedures.id, patientId: performedProcedures.patientId })
    .from(performedProcedures)
    .innerJoin(patients, eq(patients.id, performedProcedures.patientId))
    .where(
      and(eq(performedProcedures.clinicId, ctx.clinicId), isNull(performedProcedures.deletedAt)),
    )
    .orderBy(asc(performedProcedures.performedAt))
    .limit(2);

  const movements: (typeof stockMovements.$inferInsert)[] = [];

  /*
   * Which treatment the next patient-linked consumption hangs on.
   *
   * Only the anaesthetics are attached to a patient: those are genuinely used
   * *on* somebody, and putting a box of gloves on a person's file would be
   * theatre. One procedure each, in order, until they run out.
   */
  let nextProcedure = 0;

  for (const item of ITEMS) {
    const id = itemId.get(item.nameAr);

    /* istanbul ignore next -- every item was just inserted. */
    if (!id) {
      continue;
    }

    for (const purchase of item.purchases) {
      movements.push({
        clinicId: ctx.clinicId,
        itemId: id,
        type: MOVEMENT_TYPE.PURCHASE,
        quantity: purchase.quantity,
        unitPrice: purchase.price,
        supplierId: supplierIds[item.supplier] ?? null,
        batchNo: purchase.batchNo ?? null,
        expiryDate:
          purchase.expiresInDays === undefined ? null : isoDate(shift(purchase.expiresInDays)),
        createdAt: shift(-purchase.daysAgo),
        createdBy: ctx.actorId,
      });
    }

    if (item.consumed) {
      // Split across three days so the item card reads like a fortnight of
      // work rather than one enormous withdrawal.
      const parts = splitConsumption(item.consumed, isMeasured(item.unit));

      const linked =
        item.category === ITEM_CATEGORY.MEDICATION ? procedures[nextProcedure++] : undefined;

      parts.forEach((part, index) => {
        // The first withdrawal is the one that names the patient; the rest are
        // ordinary chairside use with nobody recorded.
        const procedure = index === 0 ? linked : undefined;

        movements.push({
          clinicId: ctx.clinicId,
          itemId: id,
          type: MOVEMENT_TYPE.CONSUME,
          quantity: `-${part}`,
          patientId: procedure?.patientId ?? null,
          performedProcedureId: procedure?.id ?? null,
          createdAt: shift(-(index * 4 + 2)),
          createdBy: ctx.actorId,
        });
      });
    }

    if (item.adjust) {
      movements.push({
        clinicId: ctx.clinicId,
        itemId: id,
        type: MOVEMENT_TYPE.ADJUST,
        quantity: item.adjust.quantity,
        reason: item.adjust.reason,
        createdAt: shift(-6),
        createdBy: ctx.actorId,
      });
    }
  }

  await db.insert(stockMovements).values(movements);

  return { suppliers: SUPPLIERS.length, items: ITEMS.length, movements: movements.length };
}

/**
 * Three uneven parts that add back to the whole.
 *
 * Rounded to whole units for anything counted rather than measured: a clinic
 * uses four boxes of gloves, not 4.5 of one, and a seeded history that says
 * otherwise makes the item card read like a rounding error.
 */
function splitConsumption(total: string, measured: boolean): string[] {
  const [whole = '0', fraction = ''] = total.split('.');
  const thousandths = Number(whole) * 1000 + Number(fraction.padEnd(3, '0'));
  const step = measured ? 1 : 1000;

  const first = Math.round((thousandths * 0.5) / step) * step;
  const second = Math.round((thousandths * 0.3) / step) * step;

  return [first, second, thousandths - first - second].map(format).filter((part) => part !== '0');
}

/** Units that come in fractions. The rest are things you can count on a shelf. */
const isMeasured = (unit: ItemUnit): boolean => unit === ITEM_UNIT.ML || unit === ITEM_UNIT.G;

function format(thousandths: number): string {
  const fraction = String(thousandths % 1000)
    .padStart(3, '0')
    .replace(/0+$/, '');

  return fraction === ''
    ? String(Math.floor(thousandths / 1000))
    : `${Math.floor(thousandths / 1000)}.${fraction}`;
}

const shift = (days: number): Date => new Date(Date.now() + days * 86_400_000);

const isoDate = (value: Date): string => value.toISOString().slice(0, 10);
