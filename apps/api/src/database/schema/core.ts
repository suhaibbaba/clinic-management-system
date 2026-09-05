import { AUDIT_ACTIONS, CHART_TYPES, USER_ROLES, type WeeklySchedule } from '@clinic/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/* -------------------------------------------------------------------------- */
/* Enums                                                                       */
/* -------------------------------------------------------------------------- */

export const userRoleEnum = pgEnum('user_role', USER_ROLES);
export const chartTypeEnum = pgEnum('chart_type', CHART_TYPES);
export const auditActionEnum = pgEnum('audit_action', AUDIT_ACTIONS);

/* -------------------------------------------------------------------------- */
/* Shared column groups                                                        */
/* -------------------------------------------------------------------------- */

/**
 * On every table (CLAUDE.md architecture decision 3).
 *
 * `created_by` / `updated_by` are plain UUIDs with no foreign key on purpose:
 * `users.clinic_id` references `clinics`, so constraining them to `users` would
 * make the two tables circularly dependent, and the first clinic and the first
 * admin are necessarily created with no prior user to attribute them to. The
 * audit log is the authoritative record of who changed what.
 */
const auditColumns = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
};

/** Medical, financial and core records are only ever soft-deleted. */
const softDeleteColumn = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};

/** Partial-index predicate: only live rows take part in a uniqueness rule. */
const liveRows = sql`deleted_at is null`;

/* -------------------------------------------------------------------------- */
/* Tables                                                                      */
/* -------------------------------------------------------------------------- */

/** The tenant. Every other table carries `clinic_id`. */
export const clinics = pgTable('clinics', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  /** R2 object key — never a public URL. */
  logoKey: text('logo_key'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  /** ISO-4217. Money columns are `numeric(10,2)` and never floats. */
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  workingHours: jsonb('working_hours').$type<WeeklySchedule>().notNull().default([]),
  settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
  ...auditColumns,
  ...softDeleteColumn,
});

/**
 * A clinic's specialties. `code` is text, not a Postgres enum, so adding a
 * specialty is data rather than a migration.
 */
export const specialties = pgTable(
  'specialties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    code: text('code').notNull(),
    name: text('name').notNull(),
    chartType: chartTypeEnum('chart_type').notNull().default('none'),
    isActive: boolean('is_active').notNull().default(true),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index('specialties_clinic_idx').on(table.clinicId),
    uniqueIndex('specialties_clinic_code_uniq').on(table.clinicId, table.code).where(liveRows),
  ],
);

/**
 * Login accounts. One clinic, exactly one role (ROLES.md).
 *
 * Phone and email are unique across the whole system, not per clinic, because
 * login takes an identifier and no clinic hint — two clinics sharing a phone
 * number would make the credential ambiguous.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    email: text('email'),
    /** argon2id. Never selected into a response or an audit entry. */
    passwordHash: text('password_hash').notNull(),
    role: userRoleEnum('role').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index('users_clinic_idx').on(table.clinicId),
    uniqueIndex('users_phone_uniq').on(table.phone).where(liveRows),
    uniqueIndex('users_email_uniq')
      .on(table.email)
      .where(sql`deleted_at is null and email is not null`),
  ],
);

/** A treating physician, backed by exactly one user account. */
export const doctors = pgTable(
  'doctors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    specialtyId: uuid('specialty_id')
      .notNull()
      .references(() => specialties.id),
    /** Availability template. Free slots are computed, never stored. */
    weeklySchedule: jsonb('weekly_schedule').$type<WeeklySchedule>().notNull().default([]),
    defaultAppointmentDurationMinutes: integer('default_appointment_duration_minutes')
      .notNull()
      .default(30),
    ...auditColumns,
    ...softDeleteColumn,
  },
  (table) => [
    index('doctors_clinic_idx').on(table.clinicId),
    index('doctors_specialty_idx').on(table.specialtyId),
    uniqueIndex('doctors_user_uniq').on(table.userId).where(liveRows),
  ],
);

/**
 * Rotating refresh tokens, stored as a SHA-256 digest of the random token.
 *
 * A digest rather than argon2: the token is 256 bits of entropy from a CSPRNG,
 * so it needs no brute-force hardening, and refresh has to stay cheap enough to
 * look up by hash on every call. Passwords are the low-entropy case and use
 * argon2id.
 *
 * Operational rather than medical data, so rows are revoked and purged rather
 * than soft-deleted.
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    /** Set when rotation replaces this token; unconstrained to keep the chain simple. */
    replacedByTokenId: uuid('replaced_by_token_id'),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex('refresh_tokens_hash_uniq').on(table.tokenHash),
    index('refresh_tokens_user_idx').on(table.userId),
  ],
);

/**
 * Immutable audit trail (CLAUDE.md architecture decision 4). Insert-only: no
 * update or delete path exists in the API, so it carries `created_at` and the
 * acting `user_id` instead of the usual mutation columns.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    /** Null when the actor is the system (migrations, schedulers, seeding). */
    userId: uuid('user_id').references(() => users.id),
    action: auditActionEnum('action').notNull(),
    /** Table name of the affected row, e.g. `users`. */
    entity: text('entity').notNull(),
    entityId: uuid('entity_id').notNull(),
    oldValue: jsonb('old_value'),
    newValue: jsonb('new_value'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_log_clinic_created_idx').on(table.clinicId, table.createdAt),
    index('audit_log_entity_idx').on(table.clinicId, table.entity, table.entityId),
    index('audit_log_user_idx').on(table.clinicId, table.userId),
  ],
);
