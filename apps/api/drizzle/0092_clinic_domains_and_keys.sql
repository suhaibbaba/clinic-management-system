ALTER TYPE "public"."clinic_secret_kind" ADD VALUE 'resend_api_key';--> statement-breakpoint
ALTER TYPE "public"."clinic_secret_kind" ADD VALUE 'google_client_secret';--> statement-breakpoint
ALTER TABLE "clinics" ADD COLUMN "app_domain" text;--> statement-breakpoint
ALTER TABLE "clinics" ADD COLUMN "email_from" text;--> statement-breakpoint
ALTER TABLE "clinics" ADD COLUMN "google_client_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "clinics_app_domain_uniq" ON "clinics" USING btree ("app_domain") WHERE deleted_at is null;