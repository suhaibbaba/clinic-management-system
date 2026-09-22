CREATE TYPE "public"."ai_automation_rule" AS ENUM('overdue_labs', 'unpaid_invoices', 'tomorrow_appointments');--> statement-breakpoint
CREATE TYPE "public"."ai_automation_run_status" AS ENUM('running', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ai_outbound_target" AS ENUM('overdue_labs', 'unpaid_invoices', 'tomorrow_appointments', 'patient_ids');--> statement-breakpoint
CREATE TYPE "public"."ai_outbound_trigger" AS ENUM('command', 'cron');--> statement-breakpoint
CREATE TYPE "public"."ai_proposal_status" AS ENUM('draft', 'sending', 'sent', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."clinic_secret_kind" AS ENUM('openai_api_key', 'whatsapp_access_token', 'whatsapp_phone_number_id', 'whatsapp_template_name');--> statement-breakpoint
ALTER TYPE "public"."notification_template" ADD VALUE 'assistant_message';--> statement-breakpoint
CREATE TABLE "ai_automation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"rule" "ai_automation_rule" NOT NULL,
	"run_date" date NOT NULL,
	"status" "ai_automation_run_status" DEFAULT 'running' NOT NULL,
	"proposal_id" uuid,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"user_id" uuid,
	"conversation_id" uuid,
	"trigger" "ai_outbound_trigger" NOT NULL,
	"target" "ai_outbound_target" NOT NULL,
	"intent" text NOT NULL,
	"recipients" jsonb NOT NULL,
	"recipient_count" integer NOT NULL,
	"status" "ai_proposal_status" DEFAULT 'draft' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"sent_by" uuid,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "clinic_secrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"kind" "clinic_secret_kind" NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"hint" text NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "ai_audit_log" ADD COLUMN "proposal_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_audit_log" ADD COLUMN "trigger" "ai_outbound_trigger";--> statement-breakpoint
ALTER TABLE "ai_audit_log" ADD COLUMN "channel" "notification_channel";--> statement-breakpoint
ALTER TABLE "ai_audit_log" ADD COLUMN "patient_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_audit_log" ADD COLUMN "recipient" text;--> statement-breakpoint
ALTER TABLE "ai_audit_log" ADD COLUMN "rendered_text" text;--> statement-breakpoint
ALTER TABLE "ai_audit_log" ADD COLUMN "notification_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD COLUMN "proposal_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_automation_runs" ADD CONSTRAINT "ai_automation_runs_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_automation_runs" ADD CONSTRAINT "ai_automation_runs_proposal_id_ai_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."ai_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_secrets" ADD CONSTRAINT "clinic_secrets_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_automation_runs_uniq" ON "ai_automation_runs" USING btree ("clinic_id","rule","run_date");--> statement-breakpoint
CREATE INDEX "ai_proposals_clinic_status_idx" ON "ai_proposals" USING btree ("clinic_id","status","created_at");--> statement-breakpoint
CREATE INDEX "ai_proposals_clinic_sent_idx" ON "ai_proposals" USING btree ("clinic_id","sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "clinic_secrets_kind_uniq" ON "clinic_secrets" USING btree ("clinic_id","kind");--> statement-breakpoint
ALTER TABLE "ai_audit_log" ADD CONSTRAINT "ai_audit_log_proposal_id_ai_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."ai_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_audit_log" ADD CONSTRAINT "ai_audit_log_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_audit_log" ADD CONSTRAINT "ai_audit_log_notification_id_notifications_log_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications_log"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_proposal_id_ai_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."ai_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_audit_log_proposal_idx" ON "ai_audit_log" USING btree ("proposal_id");