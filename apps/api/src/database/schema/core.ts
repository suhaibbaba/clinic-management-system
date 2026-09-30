import { AUDIT_ACTIONS, CHART_TYPES, USER_ROLES, type WeeklySchedule } from "@clinic/shared";
import { sql } from "drizzle-orm";
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
  varchar,
} from "drizzle-orm/pg-core";
import { normalizedName } from "@api/database/schema/normalized-name";

export const userRoleEnum = pgEnum("user_role", USER_ROLES);
export const chartTypeEnum = pgEnum("chart_type", CHART_TYPES);
export const auditActionEnum = pgEnum("audit_action", AUDIT_ACTIONS);

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

export const clinics = pgTable(
  "clinics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en").notNull(),
    slug: text("slug").notNull(),
    logoKey: text("logo_key"),
    appIconKey: text("app_icon_key"),
    logoIconsAt: timestamp("logo_icons_at", { withTimezone: true }),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    country: varchar("country", { length: 2 }).notNull().default("PS"),
    workingHours: jsonb("working_hours").$type<WeeklySchedule>().notNull().default([]),
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [uniqueIndex("clinics_slug_uniq").on(table.slug).where(liveRows)],
);

export const specialties = pgTable(
  "specialties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    chartType: chartTypeEnum("chart_type").notNull().default("none"),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index("specialties_clinic_idx").on(table.clinicId),
    uniqueIndex("specialties_clinic_code_uniq").on(table.clinicId, table.code).where(liveRows),
  ],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    firstNameAr: text("first_name_ar").notNull(),
    lastNameAr: text("last_name_ar").notNull(),
    firstNameEn: text("first_name_en").notNull(),
    lastNameEn: text("last_name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en").notNull(),
    normalizedName: normalizedName("name_ar || ' ' || name_en"),
    phone: text("phone").notNull(),
    email: text("email"),
    passwordHash: text("password_hash"),
    passwordTokenHash: text("password_token_hash"),
    passwordTokenExpiresAt: timestamp("password_token_expires_at", { withTimezone: true }),
    role: userRoleEnum("role").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    photoKey: text("photo_key"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index("users_clinic_idx").on(table.clinicId),
    uniqueIndex("users_phone_uniq").on(table.phone).where(liveRows),
    uniqueIndex("users_email_uniq")
      .on(table.email)
      .where(sql`deleted_at is null and email is not null`),
  ],
);

export const roleCapabilities = pgTable(
  "role_capabilities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    role: userRoleEnum("role").notNull(),
    capability: text("capability").notNull(),
    allowed: boolean("allowed").notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("role_capabilities_uniq").on(table.clinicId, table.role, table.capability),
  ],
);

export const doctors = pgTable(
  "doctors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    specialtyId: uuid("specialty_id")
      .notNull()
      .references(() => specialties.id),
    weeklySchedule: jsonb("weekly_schedule").$type<WeeklySchedule>().notNull().default([]),
    defaultAppointmentDurationMinutes: integer("default_appointment_duration_minutes")
      .notNull()
      .default(30),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index("doctors_clinic_idx").on(table.clinicId),
    index("doctors_specialty_idx").on(table.specialtyId),
    uniqueIndex("doctors_user_uniq").on(table.userId).where(liveRows),
  ],
);

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    replacedByTokenId: uuid("replaced_by_token_id"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("refresh_tokens_hash_uniq").on(table.tokenHash),
    index("refresh_tokens_user_idx").on(table.userId),
  ],
);

export const loginThrottles = pgTable("login_throttles", {
  key: text("key").primaryKey(),
  failures: integer("failures").notNull().default(0),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull().defaultNow(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
});

export const loginCodes = pgTable(
  "login_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("login_codes_user_created_idx").on(table.userId, table.createdAt)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    userId: uuid("user_id").references(() => users.id),
    action: auditActionEnum("action").notNull(),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id").notNull(),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_log_clinic_created_idx").on(table.clinicId, table.createdAt),
    index("audit_log_entity_idx").on(table.clinicId, table.entity, table.entityId),
    index("audit_log_user_idx").on(table.clinicId, table.userId),
  ],
);
