-- Choice lists become data (CLAUDE.md): the six columns below stop being
-- Postgres enums and become text holding a `lookup_options.code`. Every value
-- they hold today survives the change unaltered — an enum-to-text alteration
-- keeps the string — and the matching system rows are written straight after
-- this file by the migration runner, from SYSTEM_LOOKUPS in the shared
-- package, so the built-in lists have one definition rather than two.
--
-- Statuses are deliberately untouched: appointment_status, lab_order_status
-- and movement_type drive transition tables and arithmetic, and stay enums.

CREATE TABLE "lookup_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"list_key" text NOT NULL,
	"code" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"color" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "attachments" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "procedure_catalog" ALTER COLUMN "chart_outcome" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "method" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "type" SET DEFAULT 'checkup';--> statement-breakpoint
ALTER TABLE "lab_payments" ALTER COLUMN "method" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "inventory_items" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "inventory_items" ALTER COLUMN "unit" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "lookup_options" ADD CONSTRAINT "lookup_options_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lookup_options_list_idx" ON "lookup_options" USING btree ("clinic_id","list_key","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "lookup_options_code_idx" ON "lookup_options" USING btree ("clinic_id","list_key","code");--> statement-breakpoint
DROP TYPE "public"."attachment_type";--> statement-breakpoint
DROP TYPE "public"."procedure_outcome";--> statement-breakpoint
DROP TYPE "public"."payment_method";--> statement-breakpoint
DROP TYPE "public"."appointment_type";--> statement-breakpoint
DROP TYPE "public"."item_category";--> statement-breakpoint
DROP TYPE "public"."item_unit";