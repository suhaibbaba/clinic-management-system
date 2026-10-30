CREATE TYPE "public"."whatsapp_status" AS ENUM('unknown', 'available', 'unavailable', 'error');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_status_source" AS ENUM('otp', 'notification', 'inbound', 'manual');--> statement-breakpoint
CREATE TABLE "whatsapp_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"status" "whatsapp_status" DEFAULT 'unknown' NOT NULL,
	"source" "whatsapp_status_source" DEFAULT 'otp' NOT NULL,
	"provider_message_id" text,
	"code_hash" text,
	"code_expires_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whatsapp_checks" ADD CONSTRAINT "whatsapp_checks_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_checks_clinic_phone_uniq" ON "whatsapp_checks" USING btree ("clinic_id","phone");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_checks_message_uniq" ON "whatsapp_checks" USING btree ("provider_message_id");