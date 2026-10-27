CREATE TRIGGER supplier_payments_ledger BEFORE UPDATE ON supplier_payments FOR EACH ROW EXECUTE FUNCTION guard_ledger_row('reversed_at', 'deleted_at', 'updated_at', 'updated_by');
--> statement-breakpoint
CREATE TRIGGER supplier_opening_balances_ledger BEFORE UPDATE ON supplier_opening_balances FOR EACH ROW EXECUTE FUNCTION guard_ledger_row('reversed_at', 'deleted_at', 'updated_at', 'updated_by');
--> statement-breakpoint
DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['supplier_payments', 'supplier_opening_balances'] LOOP
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
