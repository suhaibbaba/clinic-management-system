/**
 * The `ai_read` views `query_data` may read: a staff member's view of the clinic, scoped to one
 * clinic by `app.clinic_id` inside every view. The migration is rendered from this list and a test
 * holds the two equal, so a column the model is told about is a column that exists.
 */
export interface ReadColumn {
  readonly name: string;
  /** The expression over the source alias `t` (and `c`, the clinic), when not `t.<name>`. */
  readonly sql?: string;
  readonly note?: string;
}

export interface ReadView {
  readonly name: string;
  readonly description: string;
  readonly from: string;
  /** Visit and treatment detail: readable only by a role that may read visits. */
  readonly clinical?: boolean;
  /** Tables without soft delete are not filtered on it. */
  readonly softDeleted?: boolean;
  readonly joins?: string;
  readonly columns: readonly ReadColumn[];
}

export const READ_SCHEMA = "ai_read";

/** Phone numbers never reach the model whole from here. */
const last4 = (column: string): ReadColumn => ({
  name: `${column}_last4`,
  sql: `right(t.${column}, 4)`,
});

/** The clinic's own wall clock, so "per day" means the clinic's day. */
const local = (column: string): ReadColumn => ({
  name: `${column}_local`,
  sql: `t.${column} AT TIME ZONE coalesce(nullif(c.settings ->> 'timezone', ''), 'Asia/Hebron')`,
  note: "clinic-local timestamp",
});

export const READ_VIEWS: readonly ReadView[] = [
  {
    name: "patients",
    description: "one row per patient",
    from: "patients",
    softDeleted: true,
    columns: [
      { name: "id" },
      { name: "file_number" },
      { name: "full_name" },
      { name: "date_of_birth" },
      { name: "gender" },
      last4("phone"),
      { name: "created_at" },
    ],
  },
  {
    name: "doctors",
    description: "one row per doctor, with the name of their account",
    from: "doctors",
    softDeleted: true,
    joins: "JOIN public.users u ON u.id = t.user_id",
    columns: [
      { name: "id" },
      { name: "name_ar", sql: "u.name_ar" },
      { name: "name_en", sql: "u.name_en" },
      { name: "specialty_id" },
      { name: "is_active", sql: "u.is_active" },
    ],
  },
  {
    name: "appointments",
    description: "one row per appointment, any status",
    from: "appointments",
    softDeleted: true,
    columns: [
      { name: "id" },
      { name: "patient_id" },
      { name: "doctor_id" },
      { name: "starts_at" },
      local("starts_at"),
      { name: "duration_minutes" },
      { name: "type" },
      { name: "status" },
      { name: "reason" },
      { name: "cancelled_reason" },
      { name: "created_at" },
    ],
  },
  {
    name: "visits",
    description: "one row per visit, dates only",
    from: "visits",
    clinical: true,
    softDeleted: true,
    columns: [
      { name: "id" },
      { name: "patient_id" },
      { name: "doctor_id" },
      { name: "visit_date" },
    ],
  },
  {
    name: "visit_clinical",
    description: "a visit's clinical record",
    from: "visits",
    clinical: true,
    softDeleted: true,
    columns: [
      { name: "id" },
      { name: "patient_id" },
      { name: "doctor_id" },
      { name: "visit_date" },
      { name: "complaint" },
      { name: "examination" },
      { name: "diagnosis" },
      { name: "notes" },
    ],
  },
  {
    name: "treatment_clinical",
    description: "one row per performed procedure",
    from: "performed_procedures",
    clinical: true,
    softDeleted: true,
    joins: "LEFT JOIN public.procedure_catalog p ON p.id = t.procedure_id",
    columns: [
      { name: "id" },
      { name: "patient_id" },
      { name: "visit_id" },
      { name: "doctor_id" },
      { name: "procedure_name", sql: "p.name_ar" },
      { name: "status" },
      { name: "performed_at" },
      { name: "price" },
      { name: "discount" },
      { name: "notes" },
    ],
  },
  {
    name: "charges",
    description: "the patient ledger's charges; a reversal is a negative row with reverses_id",
    from: "charges",
    softDeleted: true,
    columns: [
      { name: "id" },
      { name: "patient_id" },
      { name: "amount" },
      { name: "discount" },
      { name: "reverses_id" },
      { name: "reversed_at" },
      { name: "created_at" },
    ],
  },
  {
    name: "payments",
    description: "the patient ledger's payments; a reversal is a negative row with reverses_id",
    from: "payments",
    softDeleted: true,
    columns: [
      { name: "id" },
      { name: "patient_id" },
      { name: "amount" },
      { name: "method" },
      { name: "receipt_number" },
      { name: "reverses_id" },
      { name: "reversed_at" },
      { name: "created_at" },
      local("created_at"),
    ],
  },
  {
    name: "labs",
    description: "one row per lab",
    from: "labs",
    softDeleted: true,
    columns: [{ name: "id" }, { name: "name" }, last4("phone"), { name: "is_active" }],
  },
  {
    name: "lab_orders",
    description: "one row per lab order",
    from: "lab_orders",
    softDeleted: true,
    columns: [
      { name: "id" },
      { name: "lab_id" },
      { name: "patient_id" },
      { name: "doctor_id" },
      { name: "work_type_id" },
      { name: "status" },
      { name: "price" },
      { name: "sent_at" },
      { name: "expected_at" },
      { name: "received_at" },
      { name: "fitted_at" },
      { name: "created_at" },
    ],
  },
  {
    name: "lab_payments",
    description: "what the clinic paid labs; a reversal is a negative row with reverses_id",
    from: "lab_payments",
    softDeleted: true,
    columns: [
      { name: "id" },
      { name: "lab_id" },
      { name: "amount" },
      { name: "method" },
      { name: "reverses_id" },
      { name: "reversed_at" },
      { name: "created_at" },
    ],
  },
  {
    name: "inventory_items",
    description: "one row per stock item; quantity on hand is sum(stock_movements.quantity)",
    from: "inventory_items",
    softDeleted: true,
    columns: [
      { name: "id" },
      { name: "name", sql: "t.name_ar" },
      { name: "category" },
      { name: "unit" },
      { name: "min_quantity" },
      { name: "is_active" },
    ],
  },
  {
    name: "stock_movements",
    description: "the stock ledger: purchase, consume, adjust; signed quantity",
    from: "stock_movements",
    columns: [
      { name: "id" },
      { name: "item_id" },
      { name: "type" },
      { name: "quantity" },
      { name: "unit_price" },
      { name: "supplier_id" },
      { name: "reason" },
      { name: "reverses_id" },
      { name: "created_at" },
    ],
  },
  {
    name: "suppliers",
    description: "one row per supplier",
    from: "suppliers",
    softDeleted: true,
    columns: [{ name: "id" }, { name: "name" }, last4("phone"), { name: "is_active" }],
  },
  {
    name: "doctor_time_off",
    description: "a doctor's absences",
    from: "doctor_time_off",
    softDeleted: true,
    columns: [
      { name: "id" },
      { name: "doctor_id" },
      { name: "starts_at" },
      { name: "ends_at" },
      { name: "reason" },
    ],
  },
  {
    name: "doctor_extra_hours",
    description: "hours a doctor works on one date beyond the weekly schedule",
    from: "doctor_extra_hours",
    softDeleted: true,
    columns: [
      { name: "id" },
      { name: "doctor_id" },
      { name: "date" },
      { name: "ranges" },
      { name: "reason" },
    ],
  },
  {
    name: "clinic_closures",
    description: "days the whole clinic is shut",
    from: "clinic_closures",
    softDeleted: true,
    columns: [
      { name: "id" },
      { name: "starts_on" },
      { name: "ends_on" },
      { name: "reason" },
      { name: "is_annual" },
    ],
  },
];

export const CLINICAL_VIEWS = new Set(
  READ_VIEWS.filter((view) => view.clinical).map((view) => view.name),
);

/** The block the prompt carries: stable, so it sits in the cached prefix. */
export function viewCatalogue(): string {
  return READ_VIEWS.map(
    (view) =>
      `${READ_SCHEMA}.${view.name}${view.clinical ? " (clinical)" : ""} — ${view.description}: ` +
      view.columns.map((column) => column.name).join(", "),
  ).join("\n");
}

/** The migration's body. Views run with their owner's rights; `ai_reader` may read only them. */
export function renderReadSchema(): string {
  const views = READ_VIEWS.map((view) => {
    const columns = view.columns
      .map((column) => `    ${column.sql ?? `t.${column.name}`} AS ${column.name}`)
      .join(",\n");
    const where = [
      "t.clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid",
      ...(view.softDeleted ? ["t.deleted_at IS NULL"] : []),
    ].join("\n    AND ");

    return [
      `CREATE VIEW ${READ_SCHEMA}.${view.name} AS`,
      "  SELECT",
      columns,
      `  FROM public.${view.from} t`,
      "  JOIN public.clinics c ON c.id = t.clinic_id",
      ...(view.joins ? [`  ${view.joins}`] : []),
      `  WHERE ${where};`,
    ].join("\n");
  });

  return [
    // A role is cluster-wide: a second database on the same server finds it already there.
    [
      "DO $$ BEGIN",
      "  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ai_reader') THEN",
      "    CREATE ROLE ai_reader NOLOGIN;",
      "  END IF;",
      "END $$;",
    ].join("\n"),
    `CREATE SCHEMA ${READ_SCHEMA};`,
    `REVOKE ALL ON SCHEMA ${READ_SCHEMA} FROM PUBLIC;`,
    ...views,
    `GRANT USAGE ON SCHEMA ${READ_SCHEMA} TO ai_reader;`,
    `GRANT SELECT ON ALL TABLES IN SCHEMA ${READ_SCHEMA} TO ai_reader;`,
    "GRANT ai_reader TO CURRENT_USER;",
  ].join("\n--> statement-breakpoint\n");
}
