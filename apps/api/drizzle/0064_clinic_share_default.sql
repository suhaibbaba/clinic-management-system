ALTER TABLE "doctor_rates" ALTER COLUMN "clinic_share_percent" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pay_rules" ADD COLUMN "clinic_share_percent" numeric(5, 2) DEFAULT '0' NOT NULL;