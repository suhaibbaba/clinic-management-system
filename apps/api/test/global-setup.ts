import { join } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
// eslint-disable-next-line no-restricted-imports -- jest runs global setup outside its module map, so the @test alias does not resolve here
import { databaseName, testDatabaseUrl } from "./helpers/test-database";

export default async function globalSetup(): Promise<void> {
  const appDatabaseUrl = process.env["DATABASE_URL"];

  if (!appDatabaseUrl) {
    throw new Error(
      "DATABASE_URL is required to run the API tests. Start the stack with `docker compose up` " +
        "and run them inside the api container, or point DATABASE_URL at a scratch Postgres.",
    );
  }

  const databaseUrl = testDatabaseUrl(appDatabaseUrl);
  const name = databaseName(databaseUrl);

  process.env["DATABASE_URL"] = databaseUrl;

  const admin = postgres(appDatabaseUrl, { max: 1, onnotice: () => {} });

  try {
    const [exists] = await admin`select 1 from pg_database where datname = ${name}`;

    if (!exists) {
      await admin.unsafe(`create database "${name.replaceAll('"', '""')}"`);
    }
  } finally {
    await admin.end();
  }

  const client = postgres(databaseUrl, { max: 1, onnotice: () => {} });

  try {
    await migrate(drizzle(client), {
      migrationsFolder: join(__dirname, "..", "drizzle"),
    });
  } finally {
    await client.end();
  }
}
