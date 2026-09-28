CREATE OR REPLACE FUNCTION forbid_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: a row is never %d', TG_TABLE_NAME, lower(TG_OP)
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION forbid_hard_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% rows are never hard-deleted; soft-delete them instead', TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_ledger_row() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  changed text;
BEGIN
  SELECT string_agg(field.key, ', ')
    INTO changed
    FROM jsonb_each(to_jsonb(NEW)) AS field
   WHERE NOT (field.key = ANY (TG_ARGV))
     AND field.value IS DISTINCT FROM to_jsonb(OLD) -> field.key;

  IF changed IS NOT NULL THEN
    RAISE EXCEPTION '% is a ledger: % may not change; post a reversing row instead', TG_TABLE_NAME, changed
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF OLD.reversed_at IS NOT NULL AND NEW.reversed_at IS DISTINCT FROM OLD.reversed_at THEN
    RAISE EXCEPTION '% row is already reversed', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF to_jsonb(OLD) ? 'deleted_at'
     AND to_jsonb(OLD) ->> 'deleted_at' IS NOT NULL
     AND to_jsonb(NEW) -> 'deleted_at' IS DISTINCT FROM to_jsonb(OLD) -> 'deleted_at' THEN
    RAISE EXCEPTION '% row is already deleted', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log FOR EACH STATEMENT EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER ai_audit_log_append_only BEFORE UPDATE OR DELETE ON ai_audit_log FOR EACH ROW EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER ai_audit_log_no_truncate BEFORE TRUNCATE ON ai_audit_log FOR EACH STATEMENT EXECUTE FUNCTION forbid_rewrite();
--> statement-breakpoint
CREATE TRIGGER charges_ledger BEFORE UPDATE ON charges FOR EACH ROW EXECUTE FUNCTION guard_ledger_row('reversed_at', 'deleted_at', 'updated_at', 'updated_by');
--> statement-breakpoint
CREATE TRIGGER payments_ledger BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION guard_ledger_row('reversed_at', 'deleted_at', 'updated_at', 'updated_by');
--> statement-breakpoint
CREATE TRIGGER lab_payments_ledger BEFORE UPDATE ON lab_payments FOR EACH ROW EXECUTE FUNCTION guard_ledger_row('reversed_at', 'deleted_at', 'updated_at', 'updated_by');
--> statement-breakpoint
CREATE TRIGGER stock_movements_ledger BEFORE UPDATE ON stock_movements FOR EACH ROW EXECUTE FUNCTION guard_ledger_row('reversed_at');
--> statement-breakpoint
DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'patients', 'visits', 'performed_procedures', 'prescriptions', 'attachments',
    'medical_histories', 'treatment_plans', 'treatment_plan_items', 'chart_marks',
    'appointments', 'charges', 'payments', 'lab_orders', 'lab_payments',
    'lab_order_attachments', 'stock_movements'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete()',
      target || '_no_hard_delete', target
    );
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION forbid_hard_delete()',
      target || '_no_truncate', target
    );
  END LOOP;
END;
$$;
