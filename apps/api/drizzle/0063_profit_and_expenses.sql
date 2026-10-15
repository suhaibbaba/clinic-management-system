CREATE TYPE "public"."staff_share_basis" AS ENUM('treatments', 'collections', 'profit');--> statement-breakpoint
CREATE TABLE "owner_draws" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"month" date NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"profit" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "share_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"basis" "staff_share_basis" NOT NULL,
	"percent" numeric(5, 2) NOT NULL,
	"effective_month" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"spent_on" date NOT NULL,
	"category" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"method" text NOT NULL,
	"note" text,
	"reverses_id" uuid,
	"reversed_at" timestamp with time zone,
	"paid_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "owner_draws" ADD CONSTRAINT "owner_draws_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_terms" ADD CONSTRAINT "share_terms_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_terms" ADD CONSTRAINT "share_terms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_paid_by_users_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "owner_draws_month_uniq" ON "owner_draws" USING btree ("clinic_id","month");--> statement-breakpoint
CREATE INDEX "share_terms_user_idx" ON "share_terms" USING btree ("clinic_id","user_id","effective_month");--> statement-breakpoint
CREATE INDEX "expenses_month_idx" ON "expenses" USING btree ("clinic_id","spent_on");--> statement-breakpoint
CREATE INDEX "expenses_reverses_idx" ON "expenses" USING btree ("reverses_id");--> statement-breakpoint
CREATE TRIGGER expenses_ledger BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION guard_ledger_row('reversed_at', 'deleted_at', 'updated_at', 'updated_by');--> statement-breakpoint
CREATE TRIGGER share_terms_append_only BEFORE UPDATE OR DELETE ON share_terms FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();--> statement-breakpoint
CREATE TRIGGER owner_draws_append_only BEFORE UPDATE OR DELETE ON owner_draws FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();--> statement-breakpoint
DO $$ DECLARE target text; BEGIN
  FOREACH target IN ARRAY ARRAY['expenses', 'share_terms', 'owner_draws'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete()', target || '_no_hard_delete', target);
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION forbid_hard_delete()', target || '_no_truncate', target);
  END LOOP; END; $$;
