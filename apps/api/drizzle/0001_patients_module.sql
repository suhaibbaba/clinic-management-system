CREATE TYPE "public"."attachment_type" AS ENUM('xray_panoramic', 'xray_periapical', 'xray_bitewing', 'cbct', 'clinical_photo', 'document');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."performed_procedure_status" AS ENUM('planned', 'in_progress', 'done');--> statement-breakpoint
CREATE TYPE "public"."treatment_plan_item_status" AS ENUM('planned', 'converted', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."treatment_plan_status" AS ENUM('draft', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"visit_id" uuid,
	"type" "attachment_type" NOT NULL,
	"r2_key" text NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"tooth" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "chart_marks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"performed_procedure_id" uuid NOT NULL,
	"chart_type" chart_type NOT NULL,
	"location" jsonb NOT NULL,
	"tooth" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "medical_histories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"chronic_conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"allergies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_medications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_pregnant" boolean,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"file_number" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"date_of_birth" date,
	"gender" "gender",
	"address" text,
	"national_id" text,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "performed_procedures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"visit_id" uuid,
	"doctor_id" uuid NOT NULL,
	"procedure_id" uuid NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"discount_reason" text,
	"status" "performed_procedure_status" DEFAULT 'done' NOT NULL,
	"plan_item_id" uuid,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "prescriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"visit_id" uuid,
	"doctor_id" uuid NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "procedure_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"specialty_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"default_price" numeric(10, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "treatment_plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"treatment_plan_id" uuid NOT NULL,
	"procedure_id" uuid NOT NULL,
	"estimated_price" numeric(10, 2) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "treatment_plan_item_status" DEFAULT 'planned' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "treatment_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" "treatment_plan_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"visit_date" timestamp with time zone DEFAULT now() NOT NULL,
	"complaint" text,
	"examination" text,
	"diagnosis" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_marks" ADD CONSTRAINT "chart_marks_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_marks" ADD CONSTRAINT "chart_marks_performed_procedure_id_performed_procedures_id_fk" FOREIGN KEY ("performed_procedure_id") REFERENCES "public"."performed_procedures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_histories" ADD CONSTRAINT "medical_histories_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_histories" ADD CONSTRAINT "medical_histories_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performed_procedures" ADD CONSTRAINT "performed_procedures_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performed_procedures" ADD CONSTRAINT "performed_procedures_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performed_procedures" ADD CONSTRAINT "performed_procedures_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performed_procedures" ADD CONSTRAINT "performed_procedures_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performed_procedures" ADD CONSTRAINT "performed_procedures_procedure_id_procedure_catalog_id_fk" FOREIGN KEY ("procedure_id") REFERENCES "public"."procedure_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performed_procedures" ADD CONSTRAINT "performed_procedures_plan_item_id_treatment_plan_items_id_fk" FOREIGN KEY ("plan_item_id") REFERENCES "public"."treatment_plan_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedure_catalog" ADD CONSTRAINT "procedure_catalog_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedure_catalog" ADD CONSTRAINT "procedure_catalog_specialty_id_specialties_id_fk" FOREIGN KEY ("specialty_id") REFERENCES "public"."specialties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plan_items" ADD CONSTRAINT "treatment_plan_items_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plan_items" ADD CONSTRAINT "treatment_plan_items_treatment_plan_id_treatment_plans_id_fk" FOREIGN KEY ("treatment_plan_id") REFERENCES "public"."treatment_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plan_items" ADD CONSTRAINT "treatment_plan_items_procedure_id_procedure_catalog_id_fk" FOREIGN KEY ("procedure_id") REFERENCES "public"."procedure_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_clinic_idx" ON "attachments" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "attachments_patient_idx" ON "attachments" USING btree ("clinic_id","patient_id");--> statement-breakpoint
CREATE INDEX "attachments_tooth_idx" ON "attachments" USING btree ("clinic_id","tooth");--> statement-breakpoint
CREATE UNIQUE INDEX "attachments_key_uniq" ON "attachments" USING btree ("r2_key");--> statement-breakpoint
CREATE INDEX "chart_marks_clinic_idx" ON "chart_marks" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "chart_marks_procedure_idx" ON "chart_marks" USING btree ("performed_procedure_id");--> statement-breakpoint
CREATE INDEX "chart_marks_tooth_idx" ON "chart_marks" USING btree ("clinic_id","tooth");--> statement-breakpoint
CREATE INDEX "medical_histories_clinic_idx" ON "medical_histories" USING btree ("clinic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "medical_histories_patient_uniq" ON "medical_histories" USING btree ("patient_id") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "patients_clinic_idx" ON "patients" USING btree ("clinic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "patients_file_number_uniq" ON "patients" USING btree ("clinic_id","file_number") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "patients_clinic_phone_idx" ON "patients" USING btree ("clinic_id","phone");--> statement-breakpoint
CREATE INDEX "performed_procedures_clinic_idx" ON "performed_procedures" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "performed_procedures_patient_idx" ON "performed_procedures" USING btree ("clinic_id","patient_id","performed_at");--> statement-breakpoint
CREATE INDEX "performed_procedures_visit_idx" ON "performed_procedures" USING btree ("visit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "performed_procedures_plan_item_uniq" ON "performed_procedures" USING btree ("plan_item_id") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "prescriptions_clinic_idx" ON "prescriptions" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "prescriptions_patient_idx" ON "prescriptions" USING btree ("clinic_id","patient_id");--> statement-breakpoint
CREATE INDEX "procedure_catalog_clinic_idx" ON "procedure_catalog" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "procedure_catalog_specialty_idx" ON "procedure_catalog" USING btree ("specialty_id");--> statement-breakpoint
CREATE UNIQUE INDEX "procedure_catalog_code_uniq" ON "procedure_catalog" USING btree ("clinic_id","code") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "treatment_plan_items_clinic_idx" ON "treatment_plan_items" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "treatment_plan_items_plan_idx" ON "treatment_plan_items" USING btree ("treatment_plan_id","sort_order");--> statement-breakpoint
CREATE INDEX "treatment_plans_clinic_idx" ON "treatment_plans" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "treatment_plans_patient_idx" ON "treatment_plans" USING btree ("clinic_id","patient_id");--> statement-breakpoint
CREATE INDEX "visits_clinic_idx" ON "visits" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "visits_patient_date_idx" ON "visits" USING btree ("clinic_id","patient_id","visit_date");--> statement-breakpoint
CREATE INDEX "visits_doctor_idx" ON "visits" USING btree ("clinic_id","doctor_id");

--> statement-breakpoint
-- Patient search matches partial names and phone fragments, which a btree
-- cannot serve. pg_trgm turns those ILIKE '%…%' lookups into index scans.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "patients_full_name_trgm_idx" ON "patients" USING gin ("full_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "patients_phone_trgm_idx" ON "patients" USING gin ("phone" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "patients_file_number_trgm_idx" ON "patients" USING gin ("file_number" gin_trgm_ops);
