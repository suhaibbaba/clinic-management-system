CREATE TABLE "vendor_password_resets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendor_password_resets" ADD CONSTRAINT "vendor_password_resets_vendor_user_id_vendor_users_id_fk" FOREIGN KEY ("vendor_user_id") REFERENCES "public"."vendor_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_password_resets_token_uniq" ON "vendor_password_resets" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "vendor_password_resets_user_created_idx" ON "vendor_password_resets" USING btree ("vendor_user_id","created_at");