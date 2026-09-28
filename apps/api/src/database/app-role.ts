import type { Sql } from "postgres";

const APPEND_ONLY_TABLES = ["audit_log", "ai_audit_log"] as const;

export async function ensureAppRole(client: Sql, role: string, password: string): Promise<void> {
  const [existing] = await client`select 1 from pg_roles where rolname = ${role}`;

  const statements = [
    existing
      ? await statement(
          client,
          "alter role %I with login nosuperuser nocreatedb nocreaterole password %L",
          role,
          password,
        )
      : await statement(
          client,
          "create role %I with login nosuperuser nocreatedb nocreaterole password %L",
          role,
          password,
        ),
    await statement(client, "grant connect on database %I to %I", await databaseName(client), role),
    await statement(client, "grant usage on schema public to %I", role),
    await statement(
      client,
      "grant select, insert, update, delete on all tables in schema public to %I",
      role,
    ),
    await statement(client, "grant usage, select on all sequences in schema public to %I", role),
    await statement(
      client,
      "alter default privileges in schema public grant select, insert, update, delete on tables to %I",
      role,
    ),
    await statement(
      client,
      "alter default privileges in schema public grant usage, select on sequences to %I",
      role,
    ),
    await statement(client, "grant ai_reader to %I", role),
    ...(await Promise.all(
      APPEND_ONLY_TABLES.map((table) =>
        statement(client, "revoke update, delete, truncate on %I from %I", table, role),
      ),
    )),
  ];

  for (const sql of statements) {
    await client.unsafe(sql);
  }
}

async function statement(client: Sql, template: string, ...values: string[]): Promise<string> {
  const placeholders = values.map((_, index) => `$${index + 2}::text`).join(", ");
  const [row] = await client.unsafe<{ sql: string }[]>(
    `select format($1::text, ${placeholders}) as sql`,
    [template, ...values],
  );

  if (!row) {
    throw new Error("Could not build a role statement");
  }

  return row.sql;
}

async function databaseName(client: Sql): Promise<string> {
  const [row] = await client<{ name: string }[]>`select current_database() as name`;

  if (!row) {
    throw new Error("Could not read the database name");
  }

  return row.name;
}
