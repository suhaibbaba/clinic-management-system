#!/usr/bin/env node

import { hash } from "@node-rs/argon2";
import postgres from "postgres";

const [action, email, ...nameParts] = process.argv.slice(2);
const usage = `Usage:
  pnpm -C apps/api vendor:list
  VENDOR_PASSWORD=… pnpm -C apps/api vendor:create <email> <name>
  VENDOR_PASSWORD=… pnpm -C apps/api vendor:password <email>
  pnpm -C apps/api vendor:disable <email>
The password comes from VENDOR_PASSWORD (at least 12 characters), never from the command line.`;

const databaseUrl = process.env.DATABASE_URL;
const password = process.env.VENDOR_PASSWORD ?? "";
const name = nameParts.join(" ").trim();

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const needsPassword = action === "create" || action === "password";

if (
  !["list", "create", "password", "disable"].includes(action ?? "") ||
  (action !== "list" && !email) ||
  (action === "create" && !name) ||
  (needsPassword && password.length < 12)
) {
  console.error(usage);
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
const digest = needsPassword
  ? await hash(password, { memoryCost: 19_456, timeCost: 2, parallelism: 1 })
  : null;

try {
  if (action === "list") {
    const rows = await sql`
      select email, name, is_active, last_login_at from vendor_users order by created_at`;

    for (const row of rows) {
      console.log(
        `${row.email}\t${row.name}\t${row.is_active ? "active" : "disabled"}\t${row.last_login_at?.toISOString() ?? "never"}`,
      );
    }
  } else if (action === "create") {
    await sql`
      insert into vendor_users (email, name, password_hash) values (${email}, ${name}, ${digest})`;
    console.log(`Created ${email}.`);
  } else {
    const rows =
      action === "password"
        ? await sql`
            update vendor_users set password_hash = ${digest}, is_active = true, updated_at = now()
            where lower(email) = lower(${email}) returning id`
        : await sql`
            update vendor_users set is_active = false, updated_at = now()
            where lower(email) = lower(${email}) returning id`;

    if (rows.length === 0) {
      console.error(`No vendor account is ${email}.`);
      process.exitCode = 1;
    } else {
      if (action === "disable") {
        await sql`
          update vendor_sessions set revoked_at = now()
          where vendor_user_id = ${rows[0].id} and revoked_at is null`;
      }
      console.log(action === "password" ? `Password changed for ${email}.` : `Disabled ${email}.`);
    }
  }
} finally {
  await sql.end();
}
