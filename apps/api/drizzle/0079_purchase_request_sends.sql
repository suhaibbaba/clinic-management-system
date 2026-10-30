CREATE TABLE "purchase_request_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"sent_to" text,
	"with_prices" boolean DEFAULT false NOT NULL,
	"message" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_by" uuid
);
--> statement-breakpoint
ALTER TABLE "purchase_request_sends" ADD CONSTRAINT "purchase_request_sends_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_sends" ADD CONSTRAINT "purchase_request_sends_request_id_purchase_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."purchase_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchase_request_sends_request_idx" ON "purchase_request_sends" USING btree ("request_id","sent_at");--> statement-breakpoint
INSERT INTO "purchase_request_sends" ("clinic_id", "request_id", "sent_to", "sent_at", "sent_by")
SELECT "clinic_id", "id", "sent_to", "sent_at", "sent_by" FROM "purchase_requests" WHERE "sent_at" IS NOT NULL;
--> statement-breakpoint
CREATE TRIGGER purchase_request_sends_append_only BEFORE UPDATE OR DELETE ON purchase_request_sends FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();
