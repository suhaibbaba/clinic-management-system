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

// No foreign key on purpose: `users.clinic_id` references `clinics`, so constraining these would
// make the two circular — and the first admin has nobody to attribute.
const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
};

/** Medical, financial and core records are only ever soft-deleted. */
const softDeleteColumn = {
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

/** Partial-index predicate: only live rows take part in a uniqueness rule. */
const liveRows = sql`deleted_at is null`;

/** The tenant. Every other table carries `clinic_id`. */
export const clinics = pgTable(
  "clinics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en").notNull(),
    slug: text("slug").notNull(),
    /** R2 object key — never a public URL. */
    logoKey: text("logo_key"),
    /** A square source for the icons, for a clinic whose logo is a wordmark. */
    appIconKey: text("app_icon_key"),
    // The derived icons live under their source's own key, so their location cannot drift from the
    // image they were rendered from; this only records that the set uploaded and verified.
    logoIconsAt: timestamp("logo_icons_at", { withTimezone: true }),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    /** ISO-4217. Money columns are `numeric(10,2)` and never floats. */
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    workingHours: jsonb("working_hours").$type<WeeklySchedule>().notNull().default([]),
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [uniqueIndex("clinics_slug_uniq").on(table.slug).where(liveRows)],
);

/** `code` is text, not a Postgres enum, so adding a specialty is data rather than a migration. */
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

// Phone and email are unique system-wide, not per clinic: login takes an identifier with no clinic
// hint, so a shared number would be ambiguous.
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en").notNull(),
    normalizedName: normalizedName("name_ar || ' ' || name_en"),
    phone: text("phone").notNull(),
    email: text("email"),
    /** argon2id. Never selected into a response or an audit entry. */
    passwordHash: text("password_hash"),
    /** A SHA-256 of the activation or reset token — the token itself is only ever in the email. */
    passwordTokenHash: text("password_token_hash"),
    passwordTokenExpiresAt: timestamp("password_token_expires_at", { withTimezone: true }),
    role: userRoleEnum("role").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    // The key and never a URL: what a client receives is a signed GET minted per response, so a
    // photo cannot be handed on by copying a link out of JSON.
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
    /** Matches `CapabilityRegistry`, e.g. `patients.update`. */
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
    /** Availability template. Free slots are computed, never stored. */
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

// A SHA-256 digest, not argon2: 256 bits of CSPRNG entropy needs no hardening and refresh must stay
// a cheap lookup. Operational data, so rows are purged rather than soft-deleted.
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
    /** Set when rotation replaces this token; unconstrained to keep the chain simple. */
    replacedByTokenId: uuid("replaced_by_token_id"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("refresh_tokens_hash_uniq").on(table.tokenHash),
    index("refresh_tokens_user_idx").on(table.userId),
  ],
);

// Insert-only: no update or delete path exists in the API, so it carries `created_at` and the
// acting `user_id` instead of the usual mutation columns.
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    /** Null when the actor is the system (migrations, schedulers, seeding). */
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
