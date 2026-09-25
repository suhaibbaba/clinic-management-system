-- Medical terms in the shipped lists are written in English in Arabic too, and `planned` drops a
-- "caries" it never meant. Only a row still carrying its original name is renamed: one an admin
-- has renamed keeps their wording.
UPDATE "lookup_options" AS "option"
SET "name_ar" = "renamed"."new_name", "updated_at" = now()
FROM (VALUES
  ('tooth_state', 'healthy', 'سليم', 'Healthy'),
  ('tooth_state', 'planned', 'نخر / مخطّط', 'مخطّط'),
  ('tooth_state', 'filling', 'حشوة', 'Filling'),
  ('tooth_state', 'root_canal', 'معالجة لبية', 'Root canal'),
  ('tooth_state', 'crown', 'تاج', 'Crown'),
  ('tooth_state', 'implant', 'زرعة', 'Implant'),
  ('tooth_state', 'bridge', 'جسر', 'Bridge'),
  ('tooth_state', 'missing', 'مفقود', 'Missing'),
  ('lab_work_type', 'zirconia_crown', 'تاج زيركون', 'Zirconia crown'),
  ('lab_work_type', 'pfm_crown', 'تاج خزف على معدن', 'Porcelain-fused-to-metal crown'),
  ('lab_work_type', 'bridge_3_unit', 'جسر ثلاثي', 'Three-unit bridge'),
  ('lab_work_type', 'full_denture', 'طقم كامل', 'Full denture'),
  ('lab_work_type', 'partial_denture', 'طقم جزئي', 'Partial denture'),
  ('lab_work_type', 'veneer', 'فينير', 'Veneer'),
  ('lab_work_type', 'night_guard', 'حارس ليلي', 'Night guard'),
  ('lab_work_type', 'ortho_appliance', 'جهاز تقويم متحرك', 'Removable orthodontic appliance'),
  ('lab_material', 'zirconia', 'زيركون', 'Zirconia'),
  ('lab_material', 'emax', 'إي ماكس', 'E.max'),
  ('lab_material', 'pfm', 'خزف على معدن', 'Porcelain-fused-to-metal'),
  ('lab_material', 'acrylic', 'أكريل', 'Acrylic'),
  ('lab_material', 'chrome_cobalt', 'كروم كوبالت', 'Chrome cobalt'),
  ('attachment_type', 'xray_panoramic', 'بانوراما', 'Panoramic X-ray'),
  ('attachment_type', 'xray_periapical', 'ذروية', 'Periapical X-ray'),
  ('attachment_type', 'xray_bitewing', 'عضّية', 'Bitewing X-ray'),
  ('attachment_type', 'cbct', 'طبقي مخروطي', 'CBCT'),
  ('attachment_type', 'clinical_photo', 'صورة سريرية', 'Clinical photo'),
  ('frequent_drug', 'amoxicillin_500', 'أموكسيسيلين 500 ملغ', 'Amoxicillin 500 mg'),
  ('frequent_drug', 'amoxiclav_1g', 'أموكسيسيلين/كلافولانيك 1 غ', 'Amoxicillin/clavulanate 1 g'),
  ('frequent_drug', 'metronidazole_500', 'ميترونيدازول 500 ملغ', 'Metronidazole 500 mg'),
  ('frequent_drug', 'ibuprofen_400', 'إيبوبروفين 400 ملغ', 'Ibuprofen 400 mg'),
  ('frequent_drug', 'paracetamol_500', 'باراسيتامول 500 ملغ', 'Paracetamol 500 mg'),
  ('frequent_drug', 'chlorhexidine_rinse', 'غسول كلورهيكسيدين', 'Chlorhexidine rinse')
) AS "renamed"("list_key", "code", "old_name", "new_name")
WHERE "option"."is_system"
  AND "option"."list_key" = "renamed"."list_key"
  AND "option"."code" = "renamed"."code"
  AND "option"."name_ar" = "renamed"."old_name";
