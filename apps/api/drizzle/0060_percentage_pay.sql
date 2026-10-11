CREATE TYPE "public"."lab_cost_bearer" AS ENUM('shared', 'doctor');--> statement-breakpoint
CREATE TYPE "public"."pay_basis" AS ENUM('done', 'collected');--> statement-breakpoint
CREATE TYPE "public"."pay_plan_kind" AS ENUM('salary', 'percentage', 'salary_and_percentage');--> statement-breakpoint
CREATE TABLE "doctor_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"effective_month" date NOT NULL,
	"clinic_share_percent" numeric(5, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "pay_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "pay_plan_kind" NOT NULL,
	"effective_month" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "pay_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"effective_month" date NOT NULL,
	"tax_percent" numeric(5, 2) NOT NULL,
	"overhead_percent" numeric(5, 2) NOT NULL,
	"basis" "pay_basis" NOT NULL,
	"lab_cost_bearer" "lab_cost_bearer" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "settlement_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"payout_id" uuid NOT NULL,
	"performed_procedure_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "performed_procedures" ADD COLUMN "share_split" jsonb;--> statement-breakpoint
ALTER TABLE "performed_procedures" ADD COLUMN "share_waived_reason" text;--> statement-breakpoint
ALTER TABLE "procedure_catalog" ADD COLUMN "tax_exempt" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "doctor_rates" ADD CONSTRAINT "doctor_rates_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_rates" ADD CONSTRAINT "doctor_rates_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_plans" ADD CONSTRAINT "pay_plans_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_plans" ADD CONSTRAINT "pay_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_rules" ADD CONSTRAINT "pay_rules_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_items" ADD CONSTRAINT "settlement_items_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_items" ADD CONSTRAINT "settlement_items_payout_id_staff_payments_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."staff_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_items" ADD CONSTRAINT "settlement_items_performed_procedure_id_performed_procedures_id_fk" FOREIGN KEY ("performed_procedure_id") REFERENCES "public"."performed_procedures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_items" ADD CONSTRAINT "settlement_items_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "doctor_rates_doctor_idx" ON "doctor_rates" USING btree ("clinic_id","doctor_id","effective_month");--> statement-breakpoint
CREATE INDEX "pay_plans_user_idx" ON "pay_plans" USING btree ("clinic_id","user_id","effective_month");--> statement-breakpoint
CREATE INDEX "pay_rules_month_idx" ON "pay_rules" USING btree ("clinic_id","effective_month");--> statement-breakpoint
CREATE INDEX "settlement_items_payout_idx" ON "settlement_items" USING btree ("payout_id");--> statement-breakpoint
CREATE INDEX "settlement_items_line_idx" ON "settlement_items" USING btree ("clinic_id","performed_procedure_id","doctor_id");--> statement-breakpoint
INSERT INTO "doctor_rates" ("clinic_id", "doctor_id", "effective_month", "clinic_share_percent", "created_at")
SELECT "clinic_id", "id", DATE '2000-01-01', "clinic_share_percent", now()
FROM "doctors"
WHERE "clinic_share_percent" IS NOT NULL;--> statement-breakpoint
CREATE TRIGGER pay_rules_append_only BEFORE UPDATE OR DELETE ON pay_rules FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();--> statement-breakpoint
CREATE TRIGGER doctor_rates_append_only BEFORE UPDATE OR DELETE ON doctor_rates FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();--> statement-breakpoint
CREATE TRIGGER pay_plans_append_only BEFORE UPDATE OR DELETE ON pay_plans FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();--> statement-breakpoint
CREATE TRIGGER settlement_items_append_only BEFORE UPDATE OR DELETE ON settlement_items FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();
