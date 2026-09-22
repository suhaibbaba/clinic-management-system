CREATE TYPE "public"."ai_proposal_kind" AS ENUM('message', 'appointment_create', 'appointment_update', 'appointment_status', 'appointment_cancel', 'patient_create', 'patient_note', 'payment_create');--> statement-breakpoint
CREATE TYPE "public"."ai_risk_tier" AS ENUM('auto', 'confirm', 'typed');--> statement-breakpoint
ALTER TYPE "public"."ai_proposal_status" ADD VALUE 'done';--> statement-breakpoint
ALTER TYPE "public"."ai_proposal_status" ADD VALUE 'failed';--> statement-breakpoint
ALTER TABLE "ai_proposals" ALTER COLUMN "target" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_proposals" ALTER COLUMN "intent" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_proposals" ALTER COLUMN "recipients" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "ai_proposals" ALTER COLUMN "recipient_count" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "ai_audit_log" ADD COLUMN "entity" text;--> statement-breakpoint
ALTER TABLE "ai_audit_log" ADD COLUMN "entity_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD COLUMN "kind" "ai_proposal_kind" DEFAULT 'message' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD COLUMN "payload" jsonb;--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD COLUMN "tier" "ai_risk_tier";--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD COLUMN "typed_phrase" text;--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD COLUMN "resolved_summary" jsonb;--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD COLUMN "result_entity" text;--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD COLUMN "result_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD COLUMN "result_patient_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD COLUMN "error_code" text;