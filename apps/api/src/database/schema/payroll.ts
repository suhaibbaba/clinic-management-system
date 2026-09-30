import { PAYROLL_ADJUSTMENT_KINDS, STAFF_PAYMENT_KINDS } from "@clinic/shared";
import { sql } from "drizzle-orm";
import {
  date,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { clinics, users } from "@api/database/schema/core";

const money = (name: string) => numeric(name, { precision: 10, scale: 2 });

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
};

export const payrollAdjustmentKindEnum = pgEnum("payroll_adjustment_kind", PAYROLL_ADJUSTMENT_KINDS);

export const staffPaymentKindEnum = pgEnum("staff_payment_kind", STAFF_PAYMENT_KINDS);

export interface PayrollLineSnapshot {
  readonly userId: string;
  readonly base: string;
  readonly extras: string;
  readonly cuts: string;
  readonly due: string;
}

export const salaryTerms = pgTable(
  "salary_terms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    monthlyAmount: money("monthly_amount").notNull(),
    effectiveMonth: date("effective_month").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  (table) => [
    index("salary_terms_user_idx").on(table.clinicId, table.userId, table.effectiveMonth),
  ],
);

export const payrollAdjustments = pgTable(
  "payroll_adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    month: date("month").notNull(),
    kind: payrollAdjustmentKindEnum("kind").notNull(),
    amount: money("amount").notNull(),
    reason: text("reason").notNull(),
    reversesId: uuid("reverses_id"),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    ...auditColumns,
  },
  (table) => [
    index("payroll_adjustments_month_idx").on(table.clinicId, table.month, table.userId),
    index("payroll_adjustments_reverses_idx").on(table.reversesId),
  ],
);

export const payrollMonths = pgTable(
  "payroll_months",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    month: date("month").notNull(),
    lines: jsonb("lines").$type<PayrollLineSnapshot[]>().notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }).notNull().defaultNow(),
    closedBy: uuid("closed_by"),
  },
  (table) => [uniqueIndex("payroll_months_month_uniq").on(table.clinicId, table.month)],
);

export const staffPayments = pgTable(
  "staff_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    kind: staffPaymentKindEnum("kind").notNull(),
    month: date("month"),
    amount: money("amount").notNull(),
    method: text("method").notNull(),
    note: text("note"),
    reversesId: uuid("reverses_id"),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    ...auditColumns,
  },
  (table) => [
    index("staff_payments_user_idx").on(table.clinicId, table.userId, table.createdAt),
    index("staff_payments_month_idx")
      .on(table.clinicId, table.month)
      .where(sql`month is not null`),
    index("staff_payments_reverses_idx").on(table.reversesId),
  ],
);
