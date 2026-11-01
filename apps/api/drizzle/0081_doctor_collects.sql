CREATE TYPE "public"."payment_collector" AS ENUM('clinic', 'doctor');--> statement-breakpoint
ALTER TYPE "public"."staff_payment_kind" ADD VALUE 'remittance';--> statement-breakpoint
CREATE TABLE "collection_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"collector" "payment_collector" NOT NULL,
	"effective_month" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "held_by" uuid;--> statement-breakpoint
ALTER TABLE "collection_terms" ADD CONSTRAINT "collection_terms_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_terms" ADD CONSTRAINT "collection_terms_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_terms_doctor_idx" ON "collection_terms" USING btree ("clinic_id","doctor_id","effective_month");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_held_by_doctors_id_fk" FOREIGN KEY ("held_by") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_held_by_idx" ON "payments" USING btree ("clinic_id","held_by","created_at") WHERE held_by is not null;--> statement-breakpoint
CREATE TRIGGER collection_terms_append_only BEFORE UPDATE OR DELETE ON collection_terms FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();