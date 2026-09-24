-- Every stored phone becomes international, by its clinic's country: `00…` → `+…`, a local `059…`
-- takes the country's code, spacing goes, and a trunk 0 after a known code is dropped. Mirrors
-- `normalizePhone` in packages/shared/src/constants/phone.ts.
CREATE FUNCTION pg_temp.dial_of(country text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE country
    WHEN 'PS' THEN '970' WHEN 'IL' THEN '972' WHEN 'JO' THEN '962' WHEN 'EG' THEN '20'
    WHEN 'SA' THEN '966' WHEN 'AE' THEN '971' WHEN 'QA' THEN '974' WHEN 'KW' THEN '965'
    WHEN 'BH' THEN '973' WHEN 'OM' THEN '968' WHEN 'LB' THEN '961' WHEN 'SY' THEN '963'
    WHEN 'IQ' THEN '964' WHEN 'TR' THEN '90' WHEN 'GB' THEN '44' WHEN 'DE' THEN '49'
    WHEN 'US' THEN '1' ELSE '970' END
$$;
--> statement-breakpoint
CREATE FUNCTION pg_temp.intl_phone(value text, country text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN value IS NULL OR btrim(value) = '' THEN value
    ELSE '+' || regexp_replace(
      CASE
        WHEN btrim(value) LIKE '+%' THEN regexp_replace(value, '[^0-9]', '', 'g')
        WHEN btrim(value) LIKE '00%' THEN substr(regexp_replace(value, '[^0-9]', '', 'g'), 3)
        ELSE pg_temp.dial_of(country)
          || regexp_replace(regexp_replace(value, '[^0-9]', '', 'g'), '^0', '')
      END,
      '^(970|972|962|966|971|974|965|973|968|961|963|964|20|90|44|49|1)0',
      '\1'
    )
  END
$$;
--> statement-breakpoint
UPDATE "clinics" SET "phone" = pg_temp.intl_phone("phone", "country") WHERE "phone" IS NOT NULL;
--> statement-breakpoint
UPDATE "users" u SET "phone" = pg_temp.intl_phone(u."phone", c."country")
  FROM "clinics" c WHERE c."id" = u."clinic_id";
--> statement-breakpoint
UPDATE "patients" p SET
    "phone" = pg_temp.intl_phone(p."phone", c."country"),
    "whatsapp" = pg_temp.intl_phone(p."whatsapp", c."country"),
    "emergency_contact_phone" = pg_temp.intl_phone(p."emergency_contact_phone", c."country")
  FROM "clinics" c WHERE c."id" = p."clinic_id";
--> statement-breakpoint
UPDATE "suppliers" s SET "phone" = pg_temp.intl_phone(s."phone", c."country")
  FROM "clinics" c WHERE c."id" = s."clinic_id" AND s."phone" IS NOT NULL;
--> statement-breakpoint
UPDATE "labs" l SET "phone" = pg_temp.intl_phone(l."phone", c."country")
  FROM "clinics" c WHERE c."id" = l."clinic_id" AND l."phone" IS NOT NULL;
