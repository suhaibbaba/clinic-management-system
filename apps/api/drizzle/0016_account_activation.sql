ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_token_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_token_expires_at" timestamp with time zone;