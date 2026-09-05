import {
  CHART_TYPE,
  GENDER,
  PERFORMED_PROCEDURE_STATUS,
  TREATMENT_PLAN_ITEM_STATUS,
  TREATMENT_PLAN_STATUS,
  type Gender,
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
}

/** A small dental catalog — prices in the clinic's currency, as strings. */
const CATALOG: readonly CatalogSeed[] = [
  { code: 'EXAM', nameAr: 'كشف وفحص', nameEn: 'Examination', defaultPrice: '15.00' },
  { code: 'CLEAN', nameAr: 'تنظيف وتقليح', nameEn: 'Scaling & polishing', defaultPrice: '40.00' },
  { code: 'FILL-C', nameAr: 'حشوة تجميلية', nameEn: 'Composite filling', defaultPrice: '60.00' },
  { code: 'FILL-A', nameAr: 'حشوة أملغم', nameEn: 'Amalgam filling', defaultPrice: '45.00' },
  { code: 'RCT', nameAr: 'معالجة لبية', nameEn: 'Root canal treatment', defaultPrice: '180.00' },
  { code: 'CROWN-Z', nameAr: 'تاج زيركون', nameEn: 'Zirconia crown', defaultPrice: '250.00' },
  { code: 'EXT', nameAr: 'قلع بسيط', nameEn: 'Simple extraction', defaultPrice: '50.00' },
  { code: 'EXT-S', nameAr: 'قلع جراحي', nameEn: 'Surgical extraction', defaultPrice: '120.00' },
  { code: 'XRAY-P', nameAr: 'صورة بانوراما', nameEn: 'Panoramic X-ray', defaultPrice: '25.00' },
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
    ])
    .returning({ id: performedProcedures.id, procedureId: performedProcedures.procedureId });

  // FDI numbering: 46 lower-right first molar, 36 lower-left first molar,
  // 38 lower-left third molar, 26 upper-left first molar.
  const marks: [string, ToothLocation][] = [
    [procedureRows[0]?.id ?? '', toothMark(46, ['O', 'D'])],
    [procedureRows[2]?.id ?? '', toothMark(38, [])],
    [procedureRows[3]?.id ?? '', toothMark(26, ['O'])],
  ];

  await db.insert(chartMarks).values(
    marks
      .filter(([procedureId]) => procedureId !== '')
      .map(([performedProcedureId, location]) => ({
        clinicId: ctx.clinicId,
        performedProcedureId,
        chartType: CHART_TYPE.TOOTH_FDI,
        location,
        tooth: location.tooth,
        ...audit,
      })),
  );

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
