INSERT INTO "plans" ("code", "name", "modules") VALUES ('basic', 'Basic', '{}'::text[]) ON CONFLICT ("code") DO NOTHING;
