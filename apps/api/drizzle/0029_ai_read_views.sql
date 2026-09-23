DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ai_reader') THEN
    CREATE ROLE ai_reader NOLOGIN;
  END IF;
END $$;
--> statement-breakpoint
CREATE SCHEMA ai_read;
--> statement-breakpoint
REVOKE ALL ON SCHEMA ai_read FROM PUBLIC;
--> statement-breakpoint
CREATE VIEW ai_read.patients AS
  SELECT
    t.id AS id,
    t.file_number AS file_number,
    t.full_name AS full_name,
    t.date_of_birth AS date_of_birth,
    t.gender AS gender,
    right(t.phone, 4) AS phone_last4,
    t.created_at AS created_at
  FROM public.patients t
  JOIN public.clinics c ON c.id = t.clinic_id
  WHERE t.clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid
    AND t.deleted_at IS NULL;
--> statement-breakpoint
CREATE VIEW ai_read.doctors AS
  SELECT
    t.id AS id,
    u.name_ar AS name_ar,
    u.name_en AS name_en,
    t.specialty_id AS specialty_id,
    u.is_active AS is_active
  FROM public.doctors t
  JOIN public.clinics c ON c.id = t.clinic_id
  JOIN public.users u ON u.id = t.user_id
  WHERE t.clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid
    AND t.deleted_at IS NULL;
--> statement-breakpoint
CREATE VIEW ai_read.appointments AS
  SELECT
    t.id AS id,
    t.patient_id AS patient_id,
    t.doctor_id AS doctor_id,
    t.starts_at AS starts_at,
    t.starts_at AT TIME ZONE coalesce(nullif(c.settings ->> 'timezone', ''), 'Asia/Hebron') AS starts_at_local,
    t.duration_minutes AS duration_minutes,
    t.type AS type,
    t.status AS status,
    t.reason AS reason,
    t.cancelled_reason AS cancelled_reason,
    t.created_at AS created_at
  FROM public.appointments t
  JOIN public.clinics c ON c.id = t.clinic_id
  WHERE t.clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid
    AND t.deleted_at IS NULL;
--> statement-breakpoint
CREATE VIEW ai_read.visits AS
  SELECT
    t.id AS id,
    t.patient_id AS patient_id,
    t.doctor_id AS doctor_id,
    t.visit_date AS visit_date
  FROM public.visits t
  JOIN public.clinics c ON c.id = t.clinic_id
  WHERE t.clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid
    AND t.deleted_at IS NULL;
--> statement-breakpoint
CREATE VIEW ai_read.visit_clinical AS
  SELECT
    t.id AS id,
    t.patient_id AS patient_id,
    t.doctor_id AS doctor_id,
    t.visit_date AS visit_date,
    t.complaint AS complaint,
    t.examination AS examination,
    t.diagnosis AS diagnosis,
    t.notes AS notes
  FROM public.visits t
  JOIN public.clinics c ON c.id = t.clinic_id
  WHERE t.clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid
    AND t.deleted_at IS NULL;
--> statement-breakpoint
CREATE VIEW ai_read.treatment_clinical AS
  SELECT
    t.id AS id,
    t.patient_id AS patient_id,
    t.visit_id AS visit_id,
    t.doctor_id AS doctor_id,
    p.name_ar AS procedure_name,
    t.status AS status,
    t.performed_at AS performed_at,
    t.price AS price,
    t.discount AS discount,
    t.notes AS notes
  FROM public.performed_procedures t
  JOIN public.clinics c ON c.id = t.clinic_id
  LEFT JOIN public.procedure_catalog p ON p.id = t.procedure_id
  WHERE t.clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid
    AND t.deleted_at IS NULL;
--> statement-breakpoint
CREATE VIEW ai_read.charges AS
  SELECT
    t.id AS id,
    t.patient_id AS patient_id,
    t.amount AS amount,
    t.discount AS discount,
    t.reverses_id AS reverses_id,
    t.reversed_at AS reversed_at,
    t.created_at AS created_at
  FROM public.charges t
  JOIN public.clinics c ON c.id = t.clinic_id
  WHERE t.clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid
    AND t.deleted_at IS NULL;
--> statement-breakpoint
CREATE VIEW ai_read.payments AS
  SELECT
    t.id AS id,
    t.patient_id AS patient_id,
    t.amount AS amount,
    t.method AS method,
    t.receipt_number AS receipt_number,
    t.reverses_id AS reverses_id,
    t.reversed_at AS reversed_at,
    t.created_at AS created_at,
    t.created_at AT TIME ZONE coalesce(nullif(c.settings ->> 'timezone', ''), 'Asia/Hebron') AS created_at_local
  FROM public.payments t
  JOIN public.clinics c ON c.id = t.clinic_id
  WHERE t.clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid
    AND t.deleted_at IS NULL;
--> statement-breakpoint
CREATE VIEW ai_read.labs AS
  SELECT
    t.id AS id,
    t.name AS name,
    right(t.phone, 4) AS phone_last4,
    t.is_active AS is_active
  FROM public.labs t
  JOIN public.clinics c ON c.id = t.clinic_id
  WHERE t.clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid
    AND t.deleted_at IS NULL;
--> statement-breakpoint
CREATE VIEW ai_read.lab_orders AS
  SELECT
    t.id AS id,
    t.lab_id AS lab_id,
    t.patient_id AS patient_id,
    t.doctor_id AS doctor_id,
    t.work_type_id AS work_type_id,
    t.status AS status,
    t.price AS price,
    t.sent_at AS sent_at,
    t.expected_at AS expected_at,
    t.received_at AS received_at,
    t.fitted_at AS fitted_at,
    t.created_at AS created_at
  FROM public.lab_orders t
  JOIN public.clinics c ON c.id = t.clinic_id
  WHERE t.clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid
    AND t.deleted_at IS NULL;
--> statement-breakpoint
CREATE VIEW ai_read.lab_payments AS
  SELECT
    t.id AS id,
    t.lab_id AS lab_id,
    t.amount AS amount,
    t.method AS method,
    t.reverses_id AS reverses_id,
    t.reversed_at AS reversed_at,
    t.created_at AS created_at
  FROM public.lab_payments t
  JOIN public.clinics c ON c.id = t.clinic_id
  WHERE t.clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid
    AND t.deleted_at IS NULL;
--> statement-breakpoint
CREATE VIEW ai_read.inventory_items AS
  SELECT
    t.id AS id,
    t.name_ar AS name,
    t.category AS category,
    t.unit AS unit,
    t.min_quantity AS min_quantity,
    t.is_active AS is_active
  FROM public.inventory_items t
  JOIN public.clinics c ON c.id = t.clinic_id
  WHERE t.clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid
    AND t.deleted_at IS NULL;
--> statement-breakpoint
CREATE VIEW ai_read.stock_movements AS
  SELECT
    t.id AS id,
    t.item_id AS item_id,
    t.type AS type,
    t.quantity AS quantity,
    t.unit_price AS unit_price,
    t.supplier_id AS supplier_id,
    t.reason AS reason,
    t.reverses_id AS reverses_id,
    t.created_at AS created_at
  FROM public.stock_movements t
  JOIN public.clinics c ON c.id = t.clinic_id
  WHERE t.clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid;
--> statement-breakpoint
CREATE VIEW ai_read.suppliers AS
  SELECT
    t.id AS id,
    t.name AS name,
    right(t.phone, 4) AS phone_last4,
    t.is_active AS is_active
  FROM public.suppliers t
  JOIN public.clinics c ON c.id = t.clinic_id
  WHERE t.clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid
    AND t.deleted_at IS NULL;
--> statement-breakpoint
CREATE VIEW ai_read.doctor_time_off AS
  SELECT
    t.id AS id,
    t.doctor_id AS doctor_id,
    t.starts_at AS starts_at,
    t.ends_at AS ends_at,
    t.reason AS reason
  FROM public.doctor_time_off t
  JOIN public.clinics c ON c.id = t.clinic_id
  WHERE t.clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid
    AND t.deleted_at IS NULL;
--> statement-breakpoint
CREATE VIEW ai_read.doctor_extra_hours AS
  SELECT
    t.id AS id,
    t.doctor_id AS doctor_id,
    t.date AS date,
    t.ranges AS ranges,
    t.reason AS reason
  FROM public.doctor_extra_hours t
  JOIN public.clinics c ON c.id = t.clinic_id
  WHERE t.clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid
    AND t.deleted_at IS NULL;
--> statement-breakpoint
CREATE VIEW ai_read.clinic_closures AS
  SELECT
    t.id AS id,
    t.starts_on AS starts_on,
    t.ends_on AS ends_on,
    t.reason AS reason,
    t.is_annual AS is_annual
  FROM public.clinic_closures t
  JOIN public.clinics c ON c.id = t.clinic_id
  WHERE t.clinic_id = nullif(current_setting('app.clinic_id', true), '')::uuid
    AND t.deleted_at IS NULL;
--> statement-breakpoint
GRANT USAGE ON SCHEMA ai_read TO ai_reader;
--> statement-breakpoint
GRANT SELECT ON ALL TABLES IN SCHEMA ai_read TO ai_reader;
--> statement-breakpoint
GRANT ai_reader TO CURRENT_USER;
