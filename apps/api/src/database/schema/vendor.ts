import { SUBSCRIPTION_STATUSES, type ClinicModule } from "@clinic/shared";
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { clinics } from "@api/database/schema/core";

export const subscriptionStatusEnum = pgEnum("subscription_status", SUBSCRIPTION_STATUSES);

export const vendorUsers = pgTable(
  "vendor_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("vendor_users_email_uniq").on(sql`lower(${table.email})`)],
);

export const vendorSessions = pgTable(
  "vendor_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorUserId: uuid("vendor_user_id")
      .notNull()
      .references(() => vendorUsers.id),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("vendor_sessions_token_uniq").on(table.tokenHash)],
);

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    modules: text("modules")
      .array()
      .$type<ClinicModule[]>()
      .notNull()
      .default(sql`'{}'::text[]`),
    maxUsers: integer("max_users"),
    maxDoctors: integer("max_doctors"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => vendorUsers.id),
    updatedBy: uuid("updated_by").references(() => vendorUsers.id),
  },
  (table) => [uniqueIndex("plans_code_uniq").on(table.code)],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id),
    addOnModules: text("add_on_modules")
      .array()
      .$type<ClinicModule[]>()
      .notNull()
      .default(sql`'{}'::text[]`),
    status: subscriptionStatusEnum("status").notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on"),
    graceDays: integer("grace_days").notNull().default(14),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => vendorUsers.id),
    updatedBy: uuid("updated_by").references(() => vendorUsers.id),
  },
  (table) => [
    uniqueIndex("subscriptions_clinic_uniq").on(table.clinicId),
    index("subscriptions_status_ends_idx").on(table.status, table.endsOn),
  ],
);

export const subscriptionEvents = pgTable(
  "subscription_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    vendorUserId: uuid("vendor_user_id").references(() => vendorUsers.id),
    action: text("action").notNull(),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("subscription_events_clinic_created_idx").on(table.clinicId, table.createdAt)],
);
