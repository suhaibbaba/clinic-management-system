import {
  CHART_TYPE,
  PROCEDURE_OUTCOME,
  GENDER,
  PERFORMED_PROCEDURE_STATUS,
  TREATMENT_PLAN_ITEM_STATUS,
  TREATMENT_PLAN_STATUS,
  type Gender,
  type PerformedProcedureStatus,
  type ProcedureOutcome,
  type ToothLocation,
} from '@clinic/shared';
import type { drizzle } from 'drizzle-orm/postgres-js';
import { and, eq, isNull } from 'drizzle-orm';

import {
  chartMarks,
  medicalHistories,
  patients,
  performedProcedures,
  procedureCatalog,
  treatmentPlanItems,
  treatmentPlans,
  visits,
} from '@api/database/schema';

type Db = ReturnType<typeof drizzle>;

export interface PatientsSeedContext {
  readonly clinicId: string;
  readonly specialtyId: string;
  readonly doctorId: string;
  readonly actorId: string;
}

interface CatalogSeed {
  readonly code: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly defaultPrice: string;
  /** What the chart shows once it is done; null for procedures that chart nothing. */
  readonly chartOutcome: ProcedureOutcome | null;
}

/** A small dental catalog — prices in the clinic's currency, as strings. */
const CATALOG: readonly CatalogSeed[] = [
  {
    code: 'EXAM',
    nameAr: 'كشف وفحص',
    nameEn: 'Examination',
    defaultPrice: '15.00',
    chartOutcome: null,
  },
  {
    code: 'CLEAN',
    nameAr: 'تنظيف وتقليح',
    nameEn: 'Scaling & polishing',
    defaultPrice: '40.00',
    chartOutcome: null,
  },
  {
    code: 'FILL-C',
    nameAr: 'حشوة تجميلية',
    nameEn: 'Composite filling',
    defaultPrice: '60.00',
    chartOutcome: PROCEDURE_OUTCOME.FILLING,
  },
  {
    code: 'FILL-A',
    nameAr: 'حشوة أملغم',
    nameEn: 'Amalgam filling',
    defaultPrice: '45.00',
    chartOutcome: PROCEDURE_OUTCOME.FILLING,
  },
  {
    code: 'RCT',
    nameAr: 'معالجة لبية',
    nameEn: 'Root canal treatment',
    defaultPrice: '180.00',
    chartOutcome: PROCEDURE_OUTCOME.ROOT_CANAL,
  },
  {
    code: 'CROWN-Z',
    nameAr: 'تاج زيركون',
    nameEn: 'Zirconia crown',
    defaultPrice: '250.00',
    chartOutcome: PROCEDURE_OUTCOME.CROWN,
  },
  {
    code: 'BRIDGE-3',
    nameAr: 'جسر ثلاثي',
    nameEn: 'Three-unit bridge',
    defaultPrice: '600.00',
    chartOutcome: PROCEDURE_OUTCOME.BRIDGE,
  },
  {
    code: 'IMPL',
    nameAr: 'زرعة سنية',
    nameEn: 'Dental implant',
    defaultPrice: '700.00',
    chartOutcome: PROCEDURE_OUTCOME.IMPLANT,
  },
  {
    code: 'EXT',
    nameAr: 'قلع بسيط',
    nameEn: 'Simple extraction',
    defaultPrice: '50.00',
    chartOutcome: PROCEDURE_OUTCOME.MISSING,
  },
  {
    code: 'EXT-S',
    nameAr: 'قلع جراحي',
    nameEn: 'Surgical extraction',
    defaultPrice: '120.00',
    chartOutcome: PROCEDURE_OUTCOME.MISSING,
  },
  {
    code: 'XRAY-P',
    nameAr: 'صورة بانوراما',
    nameEn: 'Panoramic X-ray',
    defaultPrice: '25.00',
    chartOutcome: null,
  },
];

interface PatientSeed {
  readonly fileNumber: string;
  readonly fullName: string;
  readonly phone: string;
  readonly dateOfBirth: string;
  readonly gender: Gender;
  readonly address: string;
  readonly allergies: string[];
  readonly chronicConditions: string[];
  readonly currentMedications: string[];
  readonly isPregnant: boolean | null;
}

const PATIENTS: readonly PatientSeed[] = [
  {
    fileNumber: '00001',
    fullName: 'أحمد خالد الحسن',
    phone: '+963931000001',
    dateOfBirth: '1988-03-14',
    gender: GENDER.MALE,
    address: 'المزة، دمشق',
    allergies: ['البنسلين'],
    chronicConditions: ['ارتفاع ضغط الدم'],
    currentMedications: ['أملوديبين ٥ ملغ'],
    isPregnant: null,
  },
  {
    fileNumber: '00002',
    fullName: 'ليلى محمود العلي',
    phone: '+963931000002',
    dateOfBirth: '1995-11-02',
    gender: GENDER.FEMALE,
    address: 'المالكي، دمشق',
    allergies: [],
    chronicConditions: [],
    currentMedications: [],
    isPregnant: false,
  },
  {
    fileNumber: '00003',
    fullName: 'عمر سامي الخطيب',
    phone: '+963931000003',
    dateOfBirth: '1979-07-21',
    gender: GENDER.MALE,
    address: 'برزة، دمشق',
    allergies: ['اللاتكس', 'الأسبرين'],
    chronicConditions: ['السكري من النمط الثاني'],
    currentMedications: ['ميتفورمين ٨٥٠ ملغ'],
    isPregnant: null,
  },
  {
    fileNumber: '00004',
    fullName: 'رنا فادي شاهين',
    phone: '+963931000004',
    dateOfBirth: '2001-01-09',
    gender: GENDER.FEMALE,
    address: 'قدسيا، ريف دمشق',
    allergies: [],
    chronicConditions: [],
    currentMedications: [],
    isPregnant: null,
  },
  {
    fileNumber: '00005',
    fullName: 'يوسف نبيل الحلبي',
    phone: '+963931000005',
    dateOfBirth: '1965-05-30',
    gender: GENDER.MALE,
    address: 'الشيخ سعد، دمشق',
    allergies: ['اليود'],
    chronicConditions: ['قصور قلبي'],
    currentMedications: ['وارفارين ٥ ملغ'],
    isPregnant: null,
  },
  {
    fileNumber: '00006',
    fullName: 'سلمى عادل الحموي',
    phone: '+963931000006',
    dateOfBirth: '1992-09-17',
    gender: GENDER.FEMALE,
    address: 'دمر، دمشق',
    allergies: [],
    chronicConditions: ['فقر دم'],
    currentMedications: ['حديد ٦٥ ملغ'],
    isPregnant: true,
  },
  {
    fileNumber: '00007',
    fullName: 'كريم وليد الأسعد',
    phone: '+963931000007',
    dateOfBirth: '2010-12-05',
    gender: GENDER.MALE,
    address: 'جرمانا، ريف دمشق',
    allergies: [],
    chronicConditions: ['ربو'],
    currentMedications: ['سالبوتامول بخاخ'],
    isPregnant: null,
  },
  {
    fileNumber: '00008',
    fullName: 'هدى ياسر المصري',
    phone: '+963931000008',
    dateOfBirth: '1984-02-28',
    gender: GENDER.FEMALE,
    address: 'ركن الدين، دمشق',
    allergies: ['الأدوية المخدرة الموضعية'],
    chronicConditions: [],
    currentMedications: [],
    isPregnant: false,
  },
  {
    fileNumber: '00009',
    fullName: 'مازن رياض الشامي',
    phone: '+963931000009',
    dateOfBirth: '1973-06-11',
    gender: GENDER.MALE,
    address: 'كفرسوسة، دمشق',
    allergies: [],
    chronicConditions: [],
    currentMedications: [],
    isPregnant: null,
  },
  {
    fileNumber: '00010',
    fullName: 'نور إياد الدروبي',
    phone: '+963931000010',
    dateOfBirth: '1999-08-23',
    gender: GENDER.FEMALE,
    address: 'التل، ريف دمشق',
    allergies: ['السلفا'],
    chronicConditions: [],
    currentMedications: [],
    isPregnant: false,
  },
];

/** Days ago, so the seeded timeline is always recent relative to today. */
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function toothMark(tooth: number, surfaces: ToothLocation['surfaces']): ToothLocation {
  return { tooth, surfaces };
}

/**
 * Patient-module seed data: a dental catalog, ten patients with histories, and
 * enough visits, procedures, FDI chart marks and one treatment plan that every
 * endpoint in the module returns something.
 *
 * Idempotent, like the rest of the seed: it returns early once the first
 * patient file number exists in this clinic.
 */
export async function seedPatients(db: Db, ctx: PatientsSeedContext): Promise<number> {
  const catalog = await upsertCatalog(db, ctx);

  const [existing] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(
      and(
        eq(patients.clinicId, ctx.clinicId),
        eq(patients.fileNumber, PATIENTS[0]?.fileNumber ?? '00001'),
        isNull(patients.deletedAt),
      ),
    )
    .limit(1);

  if (existing) {
    return 0;
  }

  const audit = { createdBy: ctx.actorId, updatedBy: ctx.actorId };

  const patientRows = await db
    .insert(patients)
    .values(
      PATIENTS.map((patient) => ({
        clinicId: ctx.clinicId,
        fileNumber: patient.fileNumber,
        fullName: patient.fullName,
        phone: patient.phone,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        address: patient.address,
        ...audit,
      })),
    )
    .returning({ id: patients.id, fileNumber: patients.fileNumber });

  const idByFileNumber = new Map(patientRows.map((row) => [row.fileNumber, row.id]));
  const patientId = (fileNumber: string): string => {
    const id = idByFileNumber.get(fileNumber);
    if (!id) {
      throw new Error(`Seeded patient ${fileNumber} is missing`);
    }
    return id;
  };

  await db.insert(medicalHistories).values(
    PATIENTS.map((patient) => ({
      clinicId: ctx.clinicId,
      patientId: patientId(patient.fileNumber),
      chronicConditions: patient.chronicConditions,
      allergies: patient.allergies,
      currentMedications: patient.currentMedications,
      isPregnant: patient.isPregnant,
      ...audit,
    })),
  );

  const visitRows = await db
    .insert(visits)
    .values([
      {
        clinicId: ctx.clinicId,
        patientId: patientId('00001'),
        doctorId: ctx.doctorId,
        visitDate: daysAgo(21),
        complaint: 'ألم في الضرس السفلي الأيمن عند المضغ',
        examination: 'نخر عميق على السطح الإطباقي للسن ٤٦',
        diagnosis: 'التهاب لب سني عكوس',
        ...audit,
      },
      {
        clinicId: ctx.clinicId,
        patientId: patientId('00001'),
        doctorId: ctx.doctorId,
        visitDate: daysAgo(7),
        complaint: 'مراجعة بعد الحشوة',
        examination: 'الحشوة سليمة، لا حساسية',
        diagnosis: 'شفاء طبيعي',
        ...audit,
      },
      {
        clinicId: ctx.clinicId,
        patientId: patientId('00003'),
        doctorId: ctx.doctorId,
        visitDate: daysAgo(14),
        complaint: 'نزف لثوي عند التفريش',
        examination: 'قلح فوق لثوي معمم',
        diagnosis: 'التهاب لثة مزمن',
        ...audit,
      },
      {
        clinicId: ctx.clinicId,
        patientId: patientId('00006'),
        doctorId: ctx.doctorId,
        visitDate: daysAgo(3),
        complaint: 'كشف دوري أثناء الحمل',
        examination: 'لا نخور فعالة',
        diagnosis: 'حالة فموية جيدة',
        ...audit,
      },
    ])
    .returning({ id: visits.id, patientId: visits.patientId, visitDate: visits.visitDate });

  const firstVisitOf = (fileNumber: string): string | null =>
    visitRows.find((row) => row.patientId === patientId(fileNumber))?.id ?? null;

  const priceOf = (code: string): string => {
    const item = catalog.get(code);
    if (!item) {
      throw new Error(`Seeded catalog item ${code} is missing`);
    }
    return item.defaultPrice;
  };

  const catalogId = (code: string): string => {
    const item = catalog.get(code);
    if (!item) {
      throw new Error(`Seeded catalog item ${code} is missing`);
    }
    return item.id;
  };

  const procedureRows = await db
    .insert(performedProcedures)
    .values([
      {
        clinicId: ctx.clinicId,
        patientId: patientId('00001'),
        visitId: firstVisitOf('00001'),
        doctorId: ctx.doctorId,
        procedureId: catalogId('FILL-C'),
        price: priceOf('FILL-C'),
        status: PERFORMED_PROCEDURE_STATUS.DONE,
        performedAt: daysAgo(21),
        ...audit,
      },
      {
        clinicId: ctx.clinicId,
        patientId: patientId('00003'),
        visitId: firstVisitOf('00003'),
        doctorId: ctx.doctorId,
        procedureId: catalogId('CLEAN'),
        price: priceOf('CLEAN'),
        status: PERFORMED_PROCEDURE_STATUS.DONE,
        performedAt: daysAgo(14),
        ...audit,
      },
      {
        clinicId: ctx.clinicId,
        patientId: patientId('00005'),
        visitId: null,
        doctorId: ctx.doctorId,
        procedureId: catalogId('EXT'),
        price: priceOf('EXT'),
        discount: '10.00',
        discountReason: 'مريض دائم',
        status: PERFORMED_PROCEDURE_STATUS.DONE,
        performedAt: daysAgo(30),
        ...audit,
      },
      {
        clinicId: ctx.clinicId,
        patientId: patientId('00008'),
        visitId: null,
        doctorId: ctx.doctorId,
        procedureId: catalogId('RCT'),
        price: priceOf('RCT'),
        status: PERFORMED_PROCEDURE_STATUS.IN_PROGRESS,
        performedAt: daysAgo(5),
        ...audit,
      },
      // The rest give patient 00001 a chart with every state on it, which is
      // what makes the tooth chart worth opening on a fresh database.
      {
        clinicId: ctx.clinicId,
        patientId: patientId('00001'),
        visitId: null,
        doctorId: ctx.doctorId,
        procedureId: catalogId('RCT'),
        price: priceOf('RCT'),
        status: PERFORMED_PROCEDURE_STATUS.DONE,
        performedAt: daysAgo(120),
        ...audit,
      },
      {
        clinicId: ctx.clinicId,
        patientId: patientId('00001'),
        visitId: null,
        doctorId: ctx.doctorId,
        procedureId: catalogId('CROWN-Z'),
        price: priceOf('CROWN-Z'),
        status: PERFORMED_PROCEDURE_STATUS.DONE,
        performedAt: daysAgo(110),
        ...audit,
      },
      {
        clinicId: ctx.clinicId,
        patientId: patientId('00001'),
        visitId: null,
        doctorId: ctx.doctorId,
        procedureId: catalogId('EXT'),
        price: priceOf('EXT'),
        status: PERFORMED_PROCEDURE_STATUS.DONE,
        performedAt: daysAgo(300),
        ...audit,
      },
      {
        clinicId: ctx.clinicId,
        patientId: patientId('00001'),
        visitId: null,
        doctorId: ctx.doctorId,
        procedureId: catalogId('IMPL'),
        price: priceOf('IMPL'),
        status: PERFORMED_PROCEDURE_STATUS.DONE,
        performedAt: daysAgo(60),
        ...audit,
      },
      {
        clinicId: ctx.clinicId,
        patientId: patientId('00001'),
        visitId: null,
        doctorId: ctx.doctorId,
        procedureId: catalogId('BRIDGE-3'),
        price: priceOf('BRIDGE-3'),
        status: PERFORMED_PROCEDURE_STATUS.DONE,
        performedAt: daysAgo(45),
        ...audit,
      },
      {
        clinicId: ctx.clinicId,
        patientId: patientId('00001'),
        visitId: null,
        doctorId: ctx.doctorId,
        procedureId: catalogId('FILL-A'),
        price: priceOf('FILL-A'),
        status: PERFORMED_PROCEDURE_STATUS.IN_PROGRESS,
        performedAt: daysAgo(2),
        ...audit,
      },
      {
        clinicId: ctx.clinicId,
        patientId: patientId('00001'),
        visitId: null,
        doctorId: ctx.doctorId,
        procedureId: catalogId('FILL-C'),
        price: priceOf('FILL-C'),
        status: PERFORMED_PROCEDURE_STATUS.PLANNED,
        performedAt: daysAgo(1),
        ...audit,
      },
    ])
    .returning({
      id: performedProcedures.id,
      patientId: performedProcedures.patientId,
      procedureId: performedProcedures.procedureId,
      status: performedProcedures.status,
    });

  /*
   * Which teeth each procedure was performed on.
   *
   * Matched by patient, catalog code and status rather than by position in the
   * insert: `returning()` does not promise to hand rows back in the order they
   * were sent, so indexing into it silently attaches marks to the wrong
   * procedures — which is exactly what it did before this was keyed by identity.
   *
   * FDI numbering: 16/17/18 upper-right molars, 21 an upper-left incisor,
   * 24–26 upper-left, 36 lower-left first molar, 46/47 lower-right molars.
   * Together they give patient 00001 one tooth in every state the chart can
   * show.
   */
  const markPlan: {
    file: string;
    code: string;
    status: PerformedProcedureStatus;
    teeth: ToothLocation[];
  }[] = [
    { file: '00001', code: 'FILL-C', status: 'done', teeth: [toothMark(46, ['O', 'D'])] },
    { file: '00005', code: 'EXT', status: 'done', teeth: [toothMark(38, [])] },
    { file: '00008', code: 'RCT', status: 'in_progress', teeth: [toothMark(26, ['O'])] },
    { file: '00001', code: 'RCT', status: 'done', teeth: [toothMark(16, ['O'])] },
    { file: '00001', code: 'CROWN-Z', status: 'done', teeth: [toothMark(17, [])] },
    { file: '00001', code: 'EXT', status: 'done', teeth: [toothMark(18, [])] },
    { file: '00001', code: 'IMPL', status: 'done', teeth: [toothMark(36, [])] },
    {
      file: '00001',
      code: 'BRIDGE-3',
      status: 'done',
      teeth: [toothMark(24, []), toothMark(25, []), toothMark(26, [])],
    },
    { file: '00001', code: 'FILL-A', status: 'in_progress', teeth: [toothMark(47, ['O', 'B'])] },
    { file: '00001', code: 'FILL-C', status: 'planned', teeth: [toothMark(21, ['M'])] },
  ];

  const markValues = markPlan.flatMap((entry) => {
    const procedure = procedureRows.find(
      (row) =>
        row.patientId === patientId(entry.file) &&
        row.procedureId === catalogId(entry.code) &&
        row.status === entry.status,
    );

    if (!procedure) {
      throw new Error(`Seeded procedure ${entry.code} (${entry.status}) is missing`);
    }

    return entry.teeth.map((location) => ({
      clinicId: ctx.clinicId,
      performedProcedureId: procedure.id,
      chartType: CHART_TYPE.TOOTH_FDI,
      location,
      tooth: location.tooth,
      ...audit,
    }));
  });

  await db.insert(chartMarks).values(markValues);

  const [plan] = await db
    .insert(treatmentPlans)
    .values({
      clinicId: ctx.clinicId,
      patientId: patientId('00003'),
      doctorId: ctx.doctorId,
      title: 'خطة معالجة لثوية وترميمية',
      status: TREATMENT_PLAN_STATUS.ACTIVE,
      notes: 'تنفيذ على ثلاث جلسات',
      ...audit,
    })
    .returning({ id: treatmentPlans.id });

  if (plan) {
    await db.insert(treatmentPlanItems).values([
      {
        clinicId: ctx.clinicId,
        treatmentPlanId: plan.id,
        procedureId: catalogId('CLEAN'),
        estimatedPrice: priceOf('CLEAN'),
        sortOrder: 0,
        status: TREATMENT_PLAN_ITEM_STATUS.PLANNED,
        ...audit,
      },
      {
        clinicId: ctx.clinicId,
        treatmentPlanId: plan.id,
        procedureId: catalogId('FILL-A'),
        estimatedPrice: priceOf('FILL-A'),
        sortOrder: 1,
        status: TREATMENT_PLAN_ITEM_STATUS.PLANNED,
        ...audit,
      },
      {
        clinicId: ctx.clinicId,
        treatmentPlanId: plan.id,
        procedureId: catalogId('CROWN-Z'),
        estimatedPrice: priceOf('CROWN-Z'),
        sortOrder: 2,
        status: TREATMENT_PLAN_ITEM_STATUS.PLANNED,
        ...audit,
      },
    ]);
  }

  // Attachments are deliberately not seeded: a row without its object in the
  // bucket would hand out a signed URL that 404s. Upload one through
  // POST /patients/:patientId/attachments/presign-upload instead — the dev
  // stack's MinIO accepts it as-is.
  return patientRows.length;
}

async function upsertCatalog(
  db: Db,
  ctx: PatientsSeedContext,
): Promise<Map<string, { id: string; defaultPrice: string }>> {
  const existing = await db
    .select({
      id: procedureCatalog.id,
      code: procedureCatalog.code,
      defaultPrice: procedureCatalog.defaultPrice,
    })
    .from(procedureCatalog)
    .where(and(eq(procedureCatalog.clinicId, ctx.clinicId), isNull(procedureCatalog.deletedAt)));

  const byCode = new Map(
    existing.map((row) => [row.code, { id: row.id, defaultPrice: row.defaultPrice }]),
  );

  const missing = CATALOG.filter((item) => !byCode.has(item.code));
  if (missing.length === 0) {
    return byCode;
  }

  const inserted = await db
    .insert(procedureCatalog)
    .values(
      missing.map((item) => ({
        clinicId: ctx.clinicId,
        specialtyId: ctx.specialtyId,
        code: item.code,
        nameAr: item.nameAr,
        nameEn: item.nameEn,
        defaultPrice: item.defaultPrice,
        chartOutcome: item.chartOutcome,
        createdBy: ctx.actorId,
        updatedBy: ctx.actorId,
      })),
    )
    .returning({
      id: procedureCatalog.id,
      code: procedureCatalog.code,
      defaultPrice: procedureCatalog.defaultPrice,
    });

  for (const row of inserted) {
    byCode.set(row.code, { id: row.id, defaultPrice: row.defaultPrice });
  }

  return byCode;
}
