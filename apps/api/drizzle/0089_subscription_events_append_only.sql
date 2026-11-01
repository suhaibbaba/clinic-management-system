CREATE TRIGGER subscription_events_append_only BEFORE UPDATE OR DELETE ON subscription_events FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER subscription_events_no_truncate BEFORE TRUNCATE ON subscription_events FOR EACH STATEMENT EXECUTE FUNCTION forbid_rewrite();
