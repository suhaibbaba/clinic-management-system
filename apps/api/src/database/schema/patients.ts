import {
  ATTACHMENT_TYPES,
  GENDERS,
  PERFORMED_PROCEDURE_STATUSES,
  PROCEDURE_OUTCOMES,
  TREATMENT_PLAN_ITEM_STATUSES,
  TREATMENT_PLAN_STATUSES,
  type AttachmentMime,
  type BodyRegionLocation,
  type PrescriptionItem,
  type ToothLocation,
} from '@clinic/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { chartTypeEnum, clinics, doctors, specialties } from '@api/database/schema/core';

/* -------------------------------------------------------------------------- */
/* Enums                                                                       */
/* -------------------------------------------------------------------------- */

export const genderEnum = pgEnum('gender', GENDERS);
export const treatmentPlanStatusEnum = pgEnum('treatment_plan_status', TREATMENT_PLAN_STATUSES);
export const treatmentPlanItemStatusEnum = pgEnum(
  'treatment_plan_item_status',
  TREATMENT_PLAN_ITEM_STATUSES,
);
export const performedProcedureStatusEnum = pgEnum(
  'performed_procedure_status',
  PERFORMED_PROCEDURE_STATUSES,
);
export const attachmentTypeEnum = pgEnum('attachment_type', ATTACHMENT_TYPES);
export const procedureOutcomeEnum = pgEnum('procedure_outcome', PROCEDURE_OUTCOMES);

/* -------------------------------------------------------------------------- */
/* Shared column groups                                                        */
/* -------------------------------------------------------------------------- */

const auditColumns = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
};

/**
 * Every table here is a medical record, so all of them carry `deleted_at`:
 * medical rows are never hard-deleted (CLAUDE.md). It is also what lets each
 * table go through `ClinicScopeService`, which filters live rows by clinic.
 */
const softDeleteColumn = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};

const liveRows = sql`deleted_at is null`;

/** Money is `numeric(10, 2)`, read and written as a string — never a float. */
const money = (name: string) => numeric(name, { precision: 10, scale: 2 });

/* -------------------------------------------------------------------------- */
/* Catalog                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Priced procedures per specialty. Owned by billing in the module order, but
 * introduced here because treatment plan items and performed procedures both
 * reference it.
 */
export const procedureCatalog = pgTable(
  'procedure_catalog',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    specialtyId: uuid('specialty_id')
      .notNull()
      .references(() => specialties.id),
    code: text('code').notNull(),
    nameAr: text('name_ar').notNull(),
    nameEn: text('name_en').notNull(),
    defaultPrice: money('default_price').notNull(),
    /**
     * What the interactive chart shows once this procedure is done. Null for
     * procedures that chart nothing. Classified here rather than inferred from
     * the name, so a clinic can add a procedure without a client change
     * (CLAUDE.md architecture decision 1).
     */
    chartOutcome: procedureOutcomeEnum('chart_outcome'),
    isActive: boolean('is_active').notNull().default(true),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index('procedure_catalog_clinic_idx').on(table.clinicId),
    index('procedure_catalog_specialty_idx').on(table.specialtyId),
    uniqueIndex('procedure_catalog_code_uniq').on(table.clinicId, table.code).where(liveRows),
  ],
);

/* -------------------------------------------------------------------------- */
/* Patient file                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The record everything else hangs off.
 *
 * `file_number` is generated per clinic by the API and is what reception
 * actually searches by, alongside name and phone. Those three are indexed for
 * search: exact on the file number, trigram on name and phone so a partial
 * match stays fast without a full scan.
 */
export const patients = pgTable(
  'patients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    fileNumber: text('file_number').notNull(),
    fullName: text('full_name').notNull(),
    phone: text('phone').notNull(),
    dateOfBirth: date('date_of_birth'),
    gender: genderEnum('gender'),
    address: text('address'),
    nationalId: text('national_id'),
    emergencyContactName: text('emergency_contact_name'),
    emergencyContactPhone: text('emergency_contact_phone'),
    notes: text('notes'),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index('patients_clinic_idx').on(table.clinicId),
    uniqueIndex('patients_file_number_uniq').on(table.clinicId, table.fileNumber).where(liveRows),
    index('patients_clinic_phone_idx').on(table.clinicId, table.phone),
  ],
);

/** One row per patient. Admin and doctor only; technicians see allergies alone. */
export const medicalHistories = pgTable(
  'medical_histories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    chronicConditions: jsonb('chronic_conditions').$type<string[]>().notNull().default([]),
    allergies: jsonb('allergies').$type<string[]>().notNull().default([]),
    currentMedications: jsonb('current_medications').$type<string[]>().notNull().default([]),
    /** Null when not applicable or not asked. */
    isPregnant: boolean('is_pregnant'),
    notes: text('notes'),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index('medical_histories_clinic_idx').on(table.clinicId),
    uniqueIndex('medical_histories_patient_uniq').on(table.patientId).where(liveRows),
  ],
);

export const visits = pgTable(
  'visits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    doctorId: uuid('doctor_id')
      .notNull()
      .references(() => doctors.id),
    visitDate: timestamp('visit_date', { withTimezone: true }).notNull().defaultNow(),
    complaint: text('complaint'),
    examination: text('examination'),
    diagnosis: text('diagnosis'),
    notes: text('notes'),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index('visits_clinic_idx').on(table.clinicId),
    index('visits_patient_date_idx').on(table.clinicId, table.patientId, table.visitDate),
    index('visits_doctor_idx').on(table.clinicId, table.doctorId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Treatment planning                                                          */
/* -------------------------------------------------------------------------- */

export const treatmentPlans = pgTable(
  'treatment_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    doctorId: uuid('doctor_id')
      .notNull()
      .references(() => doctors.id),
    title: text('title').notNull(),
    status: treatmentPlanStatusEnum('status').notNull().default('draft'),
    notes: text('notes'),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index('treatment_plans_clinic_idx').on(table.clinicId),
    index('treatment_plans_patient_idx').on(table.clinicId, table.patientId),
  ],
);

/**
 * A planned procedure. `estimated_price` is a quote and stays put; the price
 * that bills is snapshotted onto the performed procedure at conversion.
 */
export const treatmentPlanItems = pgTable(
  'treatment_plan_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    treatmentPlanId: uuid('treatment_plan_id')
      .notNull()
      .references(() => treatmentPlans.id),
    procedureId: uuid('procedure_id')
      .notNull()
      .references(() => procedureCatalog.id),
    estimatedPrice: money('estimated_price').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    status: treatmentPlanItemStatusEnum('status').notNull().default('planned'),
    notes: text('notes'),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index('treatment_plan_items_clinic_idx').on(table.clinicId),
    index('treatment_plan_items_plan_idx').on(table.treatmentPlanId, table.sortOrder),
  ],
);

/* -------------------------------------------------------------------------- */
/* Performed work                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Work actually carried out.
 *
 * `price` is snapshotted from the catalog so a later price change never
 * rewrites history, and the billing charge is derived from this row rather
 * than from the catalog.
 */
export const performedProcedures = pgTable(
  'performed_procedures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    /** Null when the work was recorded outside a visit, e.g. from a plan. */
    visitId: uuid('visit_id').references(() => visits.id),
    doctorId: uuid('doctor_id')
      .notNull()
      .references(() => doctors.id),
    procedureId: uuid('procedure_id')
      .notNull()
      .references(() => procedureCatalog.id),
    price: money('price').notNull(),
    discount: money('discount').notNull().default('0.00'),
    discountReason: text('discount_reason'),
    status: performedProcedureStatusEnum('status').notNull().default('done'),
    planItemId: uuid('plan_item_id').references(() => treatmentPlanItems.id),
    performedAt: timestamp('performed_at', { withTimezone: true }).notNull().defaultNow(),
    notes: text('notes'),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index('performed_procedures_clinic_idx').on(table.clinicId),
    index('performed_procedures_patient_idx').on(
      table.clinicId,
      table.patientId,
      table.performedAt,
    ),
    index('performed_procedures_visit_idx').on(table.visitId),
    uniqueIndex('performed_procedures_plan_item_uniq').on(table.planItemId).where(liveRows),
  ],
);

/**
 * Where the work happened, generically per specialty
 * (CLAUDE.md architecture decision 5).
 *
 * `location` is validated by a Zod discriminated union keyed on `chart_type`,
 * so a dental `{ tooth, surfaces }` can never be stored against a skeleton
 * chart. The `tooth` column duplicates `location->>'tooth'` purely so tooth
 * history is an index lookup rather than a JSONB scan.
 */
export const chartMarks = pgTable(
  'chart_marks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    performedProcedureId: uuid('performed_procedure_id')
      .notNull()
      .references(() => performedProcedures.id),
    chartType: chartTypeEnum('chart_type').notNull(),
    location: jsonb('location').$type<ToothLocation | BodyRegionLocation>().notNull(),
    /** Denormalised from `location` for FDI charts; null for other specialties. */
    tooth: integer('tooth'),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index('chart_marks_clinic_idx').on(table.clinicId),
    index('chart_marks_procedure_idx').on(table.performedProcedureId),
    index('chart_marks_tooth_idx').on(table.clinicId, table.tooth),
  ],
);

/* -------------------------------------------------------------------------- */
/* Files and prescriptions                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Only the R2 object key and metadata — never the bytes (CLAUDE.md).
 *
 * The key never reaches a client: reads return a short-lived signed URL, and a
 * receptionist receives neither the key nor a URL (ROLES.md field rules).
 */
export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    visitId: uuid('visit_id').references(() => visits.id),
    type: attachmentTypeEnum('type').notNull(),
    r2Key: text('r2_key').notNull(),
    filename: text('filename').notNull(),
    mime: text('mime').$type<AttachmentMime>().notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    /** FDI number when the image is of one tooth. */
    tooth: integer('tooth'),
    note: text('note'),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index('attachments_clinic_idx').on(table.clinicId),
    index('attachments_patient_idx').on(table.clinicId, table.patientId),
    index('attachments_tooth_idx').on(table.clinicId, table.tooth),
    uniqueIndex('attachments_key_uniq').on(table.r2Key),
  ],
);

export const prescriptions = pgTable(
  'prescriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    visitId: uuid('visit_id').references(() => visits.id),
    doctorId: uuid('doctor_id')
      .notNull()
      .references(() => doctors.id),
    items: jsonb('items').$type<PrescriptionItem[]>().notNull().default([]),
    notes: text('notes'),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index('prescriptions_clinic_idx').on(table.clinicId),
    index('prescriptions_patient_idx').on(table.clinicId, table.patientId),
  ],
);
