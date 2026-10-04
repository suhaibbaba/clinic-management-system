import {
  GENDERS,
  PERFORMED_PROCEDURE_STATUSES,
  type AttachmentMime,
  type BodyRegionLocation,
  type PrescriptionItem,
  type ToothLocation,
} from "@clinic/shared";
import { sql } from "drizzle-orm";
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
} from "drizzle-orm/pg-core";
import { chartTypeEnum, clinics, doctors, specialties } from "@api/database/schema/core";
import { normalizedName } from "@api/database/schema/normalized-name";

export const genderEnum = pgEnum("gender", GENDERS);
export const performedProcedureStatusEnum = pgEnum(
  "performed_procedure_status",
  PERFORMED_PROCEDURE_STATUSES,
);

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
};

const softDeleteColumn = {
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

const liveRows = sql`deleted_at is null`;

const money = (name: string) => numeric(name, { precision: 10, scale: 2 });

export const procedureCatalog = pgTable(
  "procedure_catalog",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    specialtyId: uuid("specialty_id")
      .notNull()
      .references(() => specialties.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    defaultPrice: money("default_price").notNull(),
    chartOutcome: text("chart_outcome"),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index("procedure_catalog_clinic_idx").on(table.clinicId),
    index("procedure_catalog_specialty_idx").on(table.specialtyId),
    uniqueIndex("procedure_catalog_code_uniq").on(table.clinicId, table.code).where(liveRows),
  ],
);

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    fileNumber: text("file_number").notNull(),
    firstName: text("first_name").notNull(),
    middleName: text("middle_name"),
    lastName: text("last_name").notNull(),
    fullName: text("full_name").notNull(),
    normalizedName: normalizedName("full_name"),
    phone: text("phone").notNull(),
    whatsapp: text("whatsapp"),
    dateOfBirth: date("date_of_birth"),
    gender: genderEnum("gender"),
    address: text("address"),
    nationalId: text("national_id"),
    emergencyContactName: text("emergency_contact_name"),
    emergencyContactPhone: text("emergency_contact_phone"),
    notes: text("notes"),
    assignedDoctorId: uuid("assigned_doctor_id").references(() => doctors.id),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index("patients_clinic_idx").on(table.clinicId),
    index("patients_assigned_doctor_idx").on(table.clinicId, table.assignedDoctorId),
    uniqueIndex("patients_file_number_uniq").on(table.clinicId, table.fileNumber).where(liveRows),
    index("patients_clinic_phone_idx").on(table.clinicId, table.phone),
  ],
);

export const medicalHistories = pgTable(
  "medical_histories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    chronicConditions: jsonb("chronic_conditions").$type<string[]>().notNull().default([]),
    allergies: jsonb("allergies").$type<string[]>().notNull().default([]),
    currentMedications: jsonb("current_medications").$type<string[]>().notNull().default([]),
    isPregnant: boolean("is_pregnant"),
    notes: text("notes"),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index("medical_histories_clinic_idx").on(table.clinicId),
    uniqueIndex("medical_histories_patient_uniq").on(table.patientId).where(liveRows),
  ],
);

export const visits = pgTable(
  "visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id),
    visitDate: timestamp("visit_date", { withTimezone: true }).notNull().defaultNow(),
    complaint: text("complaint"),
    examination: text("examination"),
    diagnosis: text("diagnosis"),
    notes: text("notes"),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index("visits_clinic_idx").on(table.clinicId),
    index("visits_patient_date_idx").on(table.clinicId, table.patientId, table.visitDate),
    index("visits_doctor_idx").on(table.clinicId, table.doctorId),
  ],
);

export const performedProcedures = pgTable(
  "performed_procedures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    visitId: uuid("visit_id").references(() => visits.id),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id),
    procedureId: uuid("procedure_id")
      .notNull()
      .references(() => procedureCatalog.id),
    price: money("price").notNull(),
    discount: money("discount").notNull().default("0.00"),
    discountReason: text("discount_reason"),
    status: performedProcedureStatusEnum("status").notNull().default("done"),
    materialCost: money("material_cost"),
    clinicSharePercent: numeric("clinic_share_percent", { precision: 5, scale: 2 }),
    performedAt: timestamp("performed_at", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index("performed_procedures_clinic_idx").on(table.clinicId),
    index("performed_procedures_patient_idx").on(
      table.clinicId,
      table.patientId,
      table.performedAt,
    ),
    index("performed_procedures_visit_idx").on(table.visitId),
  ],
);

export const chartMarks = pgTable(
  "chart_marks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    performedProcedureId: uuid("performed_procedure_id")
      .notNull()
      .references(() => performedProcedures.id),
    chartType: chartTypeEnum("chart_type").notNull(),
    location: jsonb("location").$type<ToothLocation | BodyRegionLocation>().notNull(),
    tooth: integer("tooth"),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index("chart_marks_clinic_idx").on(table.clinicId),
    index("chart_marks_procedure_idx").on(table.performedProcedureId),
    index("chart_marks_tooth_idx").on(table.clinicId, table.tooth),
  ],
);

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    visitId: uuid("visit_id").references(() => visits.id),
    type: text("type"),
    r2Key: text("r2_key").notNull(),
    filename: text("filename").notNull(),
    mime: text("mime").$type<AttachmentMime>().notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    tooth: integer("tooth"),
    note: text("note"),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index("attachments_clinic_idx").on(table.clinicId),
    index("attachments_patient_idx").on(table.clinicId, table.patientId),
    index("attachments_tooth_idx").on(table.clinicId, table.tooth),
    uniqueIndex("attachments_key_uniq").on(table.r2Key),
  ],
);

export const prescriptions = pgTable(
  "prescriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    visitId: uuid("visit_id").references(() => visits.id),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id),
    items: jsonb("items").$type<PrescriptionItem[]>().notNull().default([]),
    notes: text("notes"),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index("prescriptions_clinic_idx").on(table.clinicId),
    index("prescriptions_patient_idx").on(table.clinicId, table.patientId),
  ],
);
