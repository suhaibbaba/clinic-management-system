-- Inventory reads in English in both languages: the shipped units and categories, and the items the
-- seed wrote. A row is renamed only while it still carries its original name, so an admin's own
-- wording is kept.
UPDATE "lookup_options" AS "option"
SET "name_ar" = "renamed"."new_name", "updated_at" = now()
FROM (VALUES
  ('item_category', 'medication', 'أدوية', 'Medication'),
  ('item_category', 'consumable', 'مستهلكات', 'Consumable'),
  ('item_category', 'tool', 'أدوات', 'Tool'),
  ('item_category', 'sterilization', 'تعقيم', 'Sterilisation'),
  ('item_unit', 'piece', 'قطعة', 'piece'),
  ('item_unit', 'box', 'علبة', 'box'),
  ('item_unit', 'pack', 'رزمة', 'pack'),
  ('item_unit', 'ml', 'مل', 'ml'),
  ('item_unit', 'g', 'غ', 'g'),
  ('item_unit', 'ampoule', 'أمبولة', 'ampoule')
) AS "renamed"("list_key", "code", "old_name", "new_name")
WHERE "option"."is_system"
  AND "option"."list_key" = "renamed"."list_key"
  AND "option"."code" = "renamed"."code"
  AND "option"."name_ar" = "renamed"."old_name";
--> statement-breakpoint
UPDATE "inventory_items" AS "item"
SET "name_ar" = "renamed"."new_name", "updated_at" = now()
FROM (VALUES
  ('قفازات فحص لاتكس — قياس M', 'Latex exam gloves — size M'),
  ('كمامات جراحية ثلاثية', '3-ply surgical masks'),
  ('مخدر موضعي ليدوكائين 2%', 'Lidocaine 2% anaesthetic'),
  ('مخدر أرتيكائين 4%', 'Articaine 4% anaesthetic'),
  ('حشوة كومبوزيت A2', 'Composite A2'),
  ('حشوة كومبوزيت A3', 'Composite A3'),
  ('أسيد إتش 37%', 'Etching acid 37%'),
  ('بوندنغ', 'Bonding agent'),
  ('مبارد لبية K-File', 'K-File endodontic files'),
  ('كون غوتا بيركا', 'Gutta-percha points'),
  ('هيبوكلوريت الصوديوم 5%', 'Sodium hypochlorite 5%'),
  ('أكياس تعقيم ذاتية اللصق', 'Self-sealing sterilisation pouches'),
  ('شرائط اختبار الأوتوكلاف', 'Autoclave test strips'),
  ('إبر تخدير 27G', 'Anaesthetic needles 27G'),
  ('شفاطات لعاب', 'Saliva ejectors'),
  ('قوالب طبعة سيليكون', 'Silicone impression material'),
  ('جبس أسنان من النوع الرابع', 'Type IV dental stone'),
  ('فرايز ألماسية', 'Diamond burs'),
  ('خيط تراجع لثوي', 'Gingival retraction cord'),
  ('محلول كلورهيكسيدين للمضمضة', 'Chlorhexidine mouthwash')
) AS "renamed"("old_name", "new_name")
WHERE "item"."name_ar" = "renamed"."old_name";
