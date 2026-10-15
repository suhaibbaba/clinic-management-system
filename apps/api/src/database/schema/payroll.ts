import {
  LAB_COST_BEARERS,
  PAY_BASES,
  PAY_PLAN_KINDS,
  PAYROLL_ADJUSTMENT_KINDS,
  STAFF_PAYMENT_KINDS,
  STAFF_SHARE_BASES,
  type MonthProfit,
  type PayPlanKind,
  type StaffShareBasis,
} from "@clinic/shared";
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
import { clinics, doctors, users } from "@api/database/schema/core";
import { performedProcedures } from "@api/database/schema/patients";

const money = (name: string) => numeric(name, { precision: 10, scale: 2 });

const percent = (name: string) => numeric(name, { precision: 5, scale: 2 });

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
};

export const payrollAdjustmentKindEnum = pgEnum(
  "payroll_adjustment_kind",
  PAYROLL_ADJUSTMENT_KINDS,
);

export const staffPaymentKindEnum = pgEnum("staff_payment_kind", STAFF_PAYMENT_KINDS);

export const payPlanKindEnum = pgEnum("pay_plan_kind", PAY_PLAN_KINDS);

export const payBasisEnum = pgEnum("pay_basis", PAY_BASES);

export const labCostBearerEnum = pgEnum("lab_cost_bearer", LAB_COST_BEARERS);

export const staffShareBasisEnum = pgEnum("staff_share_basis", STAFF_SHARE_BASES);

export interface PayrollLineSnapshot {
  readonly userId: string;
  readonly plan?: PayPlanKind;
  readonly share?: string;
  readonly shareBasis?: StaffShareBasis;
  readonly shareRate?: number;
  readonly percentBase?: string;
  readonly percentShare?: string;
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

export const payRules = pgTable(
  "pay_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    effectiveMonth: date("effective_month").notNull(),
    taxPercent: percent("tax_percent").notNull(),
    overheadPercent: percent("overhead_percent").notNull(),
    basis: payBasisEnum("basis").notNull(),
    labCostBearer: labCostBearerEnum("lab_cost_bearer").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  (table) => [index("pay_rules_month_idx").on(table.clinicId, table.effectiveMonth)],
);

export const doctorRates = pgTable(
  "doctor_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id),
    effectiveMonth: date("effective_month").notNull(),
    clinicSharePercent: percent("clinic_share_percent").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  (table) => [
    index("doctor_rates_doctor_idx").on(table.clinicId, table.doctorId, table.effectiveMonth),
  ],
);

export const payPlans = pgTable(
  "pay_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    kind: payPlanKindEnum("kind").notNull(),
    effectiveMonth: date("effective_month").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  (table) => [index("pay_plans_user_idx").on(table.clinicId, table.userId, table.effectiveMonth)],
);

export const shareTerms = pgTable(
  "share_terms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    basis: staffShareBasisEnum("basis").notNull(),
    percent: percent("percent").notNull(),
    effectiveMonth: date("effective_month").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  (table) => [index("share_terms_user_idx").on(table.clinicId, table.userId, table.effectiveMonth)],
);

export const ownerDraws = pgTable(
  "owner_draws",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    month: date("month").notNull(),
    amount: money("amount").notNull(),
    profit: jsonb("profit").$type<MonthProfit>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  (table) => [uniqueIndex("owner_draws_month_uniq").on(table.clinicId, table.month)],
);

export const settlementItems = pgTable(
  "settlement_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    payoutId: uuid("payout_id")
      .notNull()
      .references(() => staffPayments.id),
    performedProcedureId: uuid("performed_procedure_id")
      .notNull()
      .references(() => performedProcedures.id),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id),
    amount: money("amount").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  (table) => [
    index("settlement_items_payout_idx").on(table.payoutId),
    index("settlement_items_line_idx").on(
      table.clinicId,
      table.performedProcedureId,
      table.doctorId,
    ),
  ],
);
