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

/**
 * Every user-facing choice list, as rows a clinic can edit.
 *
 * This table replaces nine hardcoded arrays. What used to be a Postgres enum —
 * an appointment's type, a payment's method, an item's unit — is now `text`
 * holding a `code` from here, so a clinic adds "شيك" to its payment methods
 * without a migration and without a deploy.
 *
 * The columns that changed type kept every value they held: each of them is a
 * `code` in this table now, seeded per clinic with `is_system = true`. That is
 * the whole trick — the data did not move, only what constrains it.
 *
 * `is_system` marks a row the application itself refers to: the chart draws
 * `missing` as an outline and `implant` with a post, the seed writes `cash`.
 * It is a label rather than a lock — the clinic may rename, recolour, switch
 * off or delete any row — and what it buys is a warning on the screen before a
 * row something is keyed to goes away. The **code** is the one immovable
 * thing, on every row: it is what other tables hold, and a code that changed
 * hands would make those references mean something else.
 *
 * Statuses that drive state machines are deliberately **not** here. An
 * appointment's status and a lab order's are validated against a transition
 * table, a movement's type decides the sign of its quantity — those are
 * behaviour, and a clinic adding a value nothing knows how to handle would be
 * a way of breaking the system from a settings screen.
 */
export const lookupOptions = pgTable(
  'lookup_options',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    /** Which list this row belongs to — see `LOOKUP_LIST` in the shared package. */
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
    /** The read every screen makes: one clinic's list, in its own order. */
    index('lookup_options_list_idx').on(table.clinicId, table.listKey, table.sortOrder),
    /**
     * One code per list per clinic.
     *
     * A plain unique index rather than a partial one: a soft-deleted row still
     * holds its code, because rows elsewhere may still refer to it and a
     * second row with the same code would make that reference ambiguous.
     */
    uniqueIndex('lookup_options_code_idx').on(table.clinicId, table.listKey, table.code),
  ],
);
