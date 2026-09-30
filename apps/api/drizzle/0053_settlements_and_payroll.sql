CREATE TYPE "public"."payroll_adjustment_kind" AS ENUM('extra', 'cut');--> statement-breakpoint
CREATE TYPE "public"."staff_payment_kind" AS ENUM('salary', 'settlement');--> statement-breakpoint
CREATE TABLE "payroll_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"month" date NOT NULL,
	"kind" "payroll_adjustment_kind" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"reason" text NOT NULL,
	"reverses_id" uuid,
	"reversed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "payroll_months" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"month" date NOT NULL,
	"lines" jsonb NOT NULL,
	"closed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_by" uuid
);
--> statement-breakpoint
CREATE TABLE "salary_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"monthly_amount" numeric(10, 2) NOT NULL,
	"effective_month" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "staff_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "staff_payment_kind" NOT NULL,
	"month" date,
	"amount" numeric(10, 2) NOT NULL,
	"method" text NOT NULL,
	"note" text,
	"reverses_id" uuid,
	"reversed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "doctors" ADD COLUMN "clinic_share_percent" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "joined_on" date;--> statement-breakpoint
ALTER TABLE "performed_procedures" ADD COLUMN "material_cost" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "performed_procedures" ADD COLUMN "clinic_share_percent" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_months" ADD CONSTRAINT "payroll_months_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_terms" ADD CONSTRAINT "salary_terms_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_terms" ADD CONSTRAINT "salary_terms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_payments" ADD CONSTRAINT "staff_payments_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_payments" ADD CONSTRAINT "staff_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payroll_adjustments_month_idx" ON "payroll_adjustments" USING btree ("clinic_id","month","user_id");--> statement-breakpoint
CREATE INDEX "payroll_adjustments_reverses_idx" ON "payroll_adjustments" USING btree ("reverses_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_months_month_uniq" ON "payroll_months" USING btree ("clinic_id","month");--> statement-breakpoint
CREATE INDEX "salary_terms_user_idx" ON "salary_terms" USING btree ("clinic_id","user_id","effective_month");--> statement-breakpoint
CREATE INDEX "staff_payments_user_idx" ON "staff_payments" USING btree ("clinic_id","user_id","created_at");--> statement-breakpoint
CREATE INDEX "staff_payments_month_idx" ON "staff_payments" USING btree ("clinic_id","month") WHERE month is not null;--> statement-breakpoint
CREATE INDEX "staff_payments_reverses_idx" ON "staff_payments" USING btree ("reverses_id");--> statement-breakpoint
UPDATE "users" SET "joined_on" = "created_at"::date WHERE "joined_on" IS NULL;--> statement-breakpoint
CREATE TRIGGER staff_payments_ledger BEFORE UPDATE ON staff_payments FOR EACH ROW EXECUTE FUNCTION guard_ledger_row('reversed_at', 'updated_at', 'updated_by');--> statement-breakpoint
CREATE TRIGGER payroll_adjustments_ledger BEFORE UPDATE ON payroll_adjustments FOR EACH ROW EXECUTE FUNCTION guard_ledger_row('reversed_at', 'updated_at', 'updated_by');--> statement-breakpoint
CREATE TRIGGER salary_terms_append_only BEFORE UPDATE OR DELETE ON salary_terms FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();--> statement-breakpoint
CREATE TRIGGER payroll_months_append_only BEFORE UPDATE OR DELETE ON payroll_months FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();--> statement-breakpoint
DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['staff_payments', 'payroll_adjustments', 'salary_terms', 'payroll_months'] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete()',
      target || '_no_hard_delete', target
    );
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION forbid_hard_delete()',
      target || '_no_truncate', target
    );
  END LOOP;
END;
$$;
