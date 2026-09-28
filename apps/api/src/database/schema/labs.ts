import { LAB_ORDER_STATUSES } from "@clinic/shared";
import {
  boolean,
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
import { clinics, doctors, users } from "@api/database/schema/core";
import { normalizedName } from "@api/database/schema/normalized-name";
import { patients, performedProcedures } from "@api/database/schema/patients";

export const labOrderStatusEnum = pgEnum("lab_order_status", LAB_ORDER_STATUSES);

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
};

const softDeleteColumn = { deletedAt: timestamp("deleted_at", { withTimezone: true }) };

const money = (name: string) => numeric(name, { precision: 10, scale: 2 });

export const labs = pgTable(
  "labs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    name: text("name").notNull(),
    normalizedName: normalizedName("name"),
    phone: text("phone"),
    address: text("address"),
    contactPerson: text("contact_person"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [index("labs_clinic_idx").on(table.clinicId, table.name)],
);

export const labWorkTypes = pgTable(
  "lab_work_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    labId: uuid("lab_id")
      .notNull()
      .references(() => labs.id),
    name: text("name").notNull(),
    defaultPrice: money("default_price").notNull().default("0.00"),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [index("lab_work_types_lab_idx").on(table.labId, table.name)],
);

export const labOrders = pgTable(
  "lab_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    labId: uuid("lab_id")
      .notNull()
      .references(() => labs.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id),
    performedProcedureId: uuid("performed_procedure_id").references(() => performedProcedures.id),
    workTypeId: uuid("work_type_id").references(() => labWorkTypes.id),
    material: text("material"),
    shade: text("shade"),
    teeth: jsonb("teeth").$type<number[]>().notNull().default([]),
    instructions: text("instructions"),
    price: money("price").notNull().default("0.00"),
    status: labOrderStatusEnum("status").notNull().default("draft"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    expectedAt: timestamp("expected_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    fittedAt: timestamp("fitted_at", { withTimezone: true }),
    returnReason: text("return_reason"),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index("lab_orders_clinic_idx").on(table.clinicId, table.status),
    index("lab_orders_lab_idx").on(table.clinicId, table.labId),
    index("lab_orders_patient_idx").on(table.clinicId, table.patientId),
    index("lab_orders_expected_idx").on(table.clinicId, table.expectedAt),
    index("lab_orders_procedure_idx").on(table.performedProcedureId),
  ],
);

export const labOrderAttachments = pgTable(
  "lab_order_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    labOrderId: uuid("lab_order_id")
      .notNull()
      .references(() => labOrders.id),
    r2Key: text("r2_key").notNull(),
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index("lab_order_attachments_order_idx").on(table.labOrderId),
    uniqueIndex("lab_order_attachments_key_uniq").on(table.r2Key),
  ],
);

export const labPayments = pgTable(
  "lab_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    labId: uuid("lab_id")
      .notNull()
      .references(() => labs.id),
    amount: money("amount").notNull(),
    method: text("method").notNull(),
    note: text("note"),
    reversesId: uuid("reverses_id"),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    paidBy: uuid("paid_by").references(() => users.id),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index("lab_payments_clinic_idx").on(table.clinicId),
    index("lab_payments_lab_idx").on(table.clinicId, table.labId, table.createdAt),
    index("lab_payments_reverses_idx").on(table.reversesId),
  ],
);
