#!/usr/bin/env node
// Drops every table and re-runs the migrations and the seed, in one command. The seed only ever
// populates an *empty* clinic, so changing it cannot change what a database already holds — only
// a wipe can, and this is the wipe.

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

// A wipe of a deployed database is never what somebody meant by "reset".
if (process.env.NODE_ENV === "production") {
  console.error("Refusing to reset a production database.");
  process.exit(1);
}

const client = postgres(databaseUrl, { max: 1, onnotice: () => {} });

try {
  await client.unsafe("drop schema if exists drizzle cascade");
  await client.unsafe("drop schema public cascade");
  await client.unsafe("create schema public");
  console.log("Schema dropped and recreated.");
} finally {
  await client.end();
}

for (const step of [["dist/database/migrate.js"], ["dist/database/seed.js"]]) {
  const result = spawnSync(process.execPath, step, { cwd: apiRoot, stdio: "inherit" });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
