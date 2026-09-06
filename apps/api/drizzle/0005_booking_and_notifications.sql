CREATE TYPE "public"."notification_channel" AS ENUM('whatsapp', 'sms');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('queued', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."notification_template" AS ENUM('booking_otp', 'booking_confirmed', 'reminder_24h', 'reminder_2h', 'booking_cancelled');--> statement-breakpoint
CREATE TABLE "booking_otps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"to" text NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"template" "notification_template" NOT NULL,
	"vars" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "notification_status" DEFAULT 'queued' NOT NULL,
	"error" text,
	"appointment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
/*
 * The slug lands in three steps, not one.
 *
 * `ADD COLUMN ... NOT NULL` without a default fails outright on a table that
 * already has rows, and every existing clinic has one. So: add it nullable,
 * derive a handle from the name — lowercased, non-letters collapsed to a
 * hyphen, with the row id's first eight characters appended so two clinics
 * called "Al Nour" cannot collide on the unique index below — then tighten it.
 */
ALTER TABLE "clinics" ADD COLUMN "slug" text;--> statement-breakpoint
UPDATE "clinics"
SET "slug" = trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g'))
             || '-' || substring("id"::text, 1, 8)
WHERE "slug" IS NULL;--> statement-breakpoint
ALTER TABLE "clinics" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_otps" ADD CONSTRAINT "booking_otps_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_otps" ADD CONSTRAINT "booking_otps_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_otps" ADD CONSTRAINT "booking_otps_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications_log" ADD CONSTRAINT "notifications_log_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications_log" ADD CONSTRAINT "notifications_log_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_otps_appointment_idx" ON "booking_otps" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "notifications_log_clinic_created_idx" ON "notifications_log" USING btree ("clinic_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_log_appointment_idx" ON "notifications_log" USING btree ("appointment_id","template");--> statement-breakpoint
CREATE UNIQUE INDEX "clinics_slug_uniq" ON "clinics" USING btree ("slug") WHERE deleted_at is null;