#!/usr/bin/env node

import { createRequire } from "node:module";

import postgres from "postgres";

const { CLINIC_MODULES } = createRequire(import.meta.url)("@clinic/shared");

const [action, clinic, module] = process.argv.slice(2);
const usage = `Usage:
  pnpm -C apps/api module:list
  pnpm -C apps/api module:enable <clinic slug or id> <module>
  pnpm -C apps/api module:disable <clinic slug or id> <module>
Modules: ${CLINIC_MODULES.join(", ")}`;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

if (!["list", "enable", "disable"].includes(action ?? "")) {
  console.error(usage);
  process.exit(1);
}

if (action !== "list" && (!clinic || !CLINIC_MODULES.includes(module))) {
  console.error(usage);
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });

try {
  if (action === "list") {
    const rows = await sql`
      select slug, name_en, modules from clinics where deleted_at is null order by created_at`;

    for (const row of rows) {
      console.log(`${row.slug}\t${row.name_en}\t${row.modules.join(", ") || "-"}`);
    }
  } else {
    const isId = /^[0-9a-f-]{36}$/i.test(clinic);
    const rows = await sql`
      update clinics
      set modules = ${
        action === "enable"
          ? sql`array(select distinct unnest(modules || array[${module}]::text[]))`
          : sql`array_remove(modules, ${module})`
      },
      updated_at = now()
      where deleted_at is null and ${isId ? sql`id = ${clinic}` : sql`slug = ${clinic}`}
      returning slug, modules`;

    if (rows.length === 0) {
      console.error(`No clinic matches "${clinic}".`);
      process.exitCode = 1;
    } else {
      console.log(`${rows[0].slug}: ${rows[0].modules.join(", ") || "-"}`);
      console.log("Takes effect within a minute.");
    }
  }
} finally {
  await sql.end();
}
