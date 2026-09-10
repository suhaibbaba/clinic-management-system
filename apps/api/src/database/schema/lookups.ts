import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { clinics } from '@api/database/schema/core';

// What was an enum is now `text` holding a `code` from here, so a clinic adds an option without a
// migration. `is_system` is a label, not a lock; the code is what other tables hold.
export const lookupOptions = pgTable(
  'lookup_options',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    listKey: text('list_key').notNull(),
    /** The value stored by everything that refers to this row. Never edited. */
    code: text('code').notNull(),
    nameAr: text('name_ar').notNull(),
    nameEn: text('name_en').notNull(),
    /** `#rrggbb`. Only the painted lists use it; null means built-in styling. */
    color: text('color'),
    sortOrder: integer('sort_order').notNull().default(0),
    isSystem: boolean('is_system').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    /** Per-list extras — the tooth chart keeps its drawing behaviour here. */
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    updatedBy: uuid('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('lookup_options_list_idx').on(table.clinicId, table.listKey, table.sortOrder),
    // A plain unique index, not a partial one: a soft-deleted row keeps its code, and a second row
    // with the same code would make an existing reference ambiguous.
    uniqueIndex('lookup_options_code_idx').on(table.clinicId, table.listKey, table.code),
  ],
);
