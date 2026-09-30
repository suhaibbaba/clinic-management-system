ALTER TABLE "performed_procedures" DROP CONSTRAINT "performed_procedures_treatment_plan_id_treatment_plans_id_fk";--> statement-breakpoint
DROP INDEX "performed_procedures_plan_idx";--> statement-breakpoint
ALTER TABLE "performed_procedures" DROP COLUMN "treatment_plan_id";--> statement-breakpoint
DROP TABLE "treatment_plans";--> statement-breakpoint
DROP TYPE "public"."treatment_plan_status";
