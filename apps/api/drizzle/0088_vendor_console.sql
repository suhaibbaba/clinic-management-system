CREATE TYPE "public"."subscription_status" AS ENUM('trial', 'active', 'grace', 'suspended', 'cancelled');--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"modules" text[] DEFAULT '{}'::text[] NOT NULL,
	"max_users" integer,
	"max_doctors" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "subscription_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"vendor_user_id" uuid,
	"action" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"add_on_modules" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "subscription_status" NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"grace_days" integer DEFAULT 14 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "vendor_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_created_by_vendor_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."vendor_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_updated_by_vendor_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."vendor_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_vendor_user_id_vendor_users_id_fk" FOREIGN KEY ("vendor_user_id") REFERENCES "public"."vendor_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_created_by_vendor_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."vendor_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_updated_by_vendor_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."vendor_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_sessions" ADD CONSTRAINT "vendor_sessions_vendor_user_id_vendor_users_id_fk" FOREIGN KEY ("vendor_user_id") REFERENCES "public"."vendor_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plans_code_uniq" ON "plans" USING btree ("code");--> statement-breakpoint
CREATE INDEX "subscription_events_clinic_created_idx" ON "subscription_events" USING btree ("clinic_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_clinic_uniq" ON "subscriptions" USING btree ("clinic_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_ends_idx" ON "subscriptions" USING btree ("status","ends_on");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_sessions_token_uniq" ON "vendor_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_users_email_uniq" ON "vendor_users" USING btree (lower("email"));