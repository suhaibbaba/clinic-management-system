DROP INDEX "owner_draws_month_uniq";--> statement-breakpoint
DROP INDEX "payroll_months_month_uniq";--> statement-breakpoint
ALTER TABLE "owner_draws" ADD COLUMN "reversed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "owner_draws" ADD COLUMN "reversed_by" uuid;--> statement-breakpoint
ALTER TABLE "payroll_months" ADD COLUMN "reversed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payroll_months" ADD COLUMN "reversed_by" uuid;--> statement-breakpoint
ALTER TABLE "payroll_months" ADD COLUMN "reversal_reason" text;--> statement-breakpoint
CREATE UNIQUE INDEX "owner_draws_month_uniq" ON "owner_draws" USING btree ("clinic_id","month") WHERE reversed_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_months_month_uniq" ON "payroll_months" USING btree ("clinic_id","month") WHERE reversed_at is null;--> statement-breakpoint
DROP TRIGGER payroll_months_append_only ON payroll_months;--> statement-breakpoint
CREATE TRIGGER payroll_months_no_delete BEFORE DELETE ON payroll_months FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();--> statement-breakpoint
CREATE TRIGGER payroll_months_ledger BEFORE UPDATE ON payroll_months FOR EACH ROW EXECUTE FUNCTION guard_ledger_row('reversed_at', 'reversed_by', 'reversal_reason');--> statement-breakpoint
DROP TRIGGER owner_draws_append_only ON owner_draws;--> statement-breakpoint
CREATE TRIGGER owner_draws_no_delete BEFORE DELETE ON owner_draws FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();--> statement-breakpoint
CREATE TRIGGER owner_draws_ledger BEFORE UPDATE ON owner_draws FOR EACH ROW EXECUTE FUNCTION guard_ledger_row('reversed_at', 'reversed_by');
