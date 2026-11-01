UPDATE "clinics"
SET "modules" = array(
  SELECT DISTINCT unnest("modules" || ARRAY['appointments', 'booking', 'labs', 'inventory', 'expenses', 'payroll']::text[])
);
