import { bothNames } from "@clinic/shared";
import { hash } from "@node-rs/argon2";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { validateEnv } from "@api/config/env.schema";
import * as schema from "@api/database/schema";
import { bootstrapClinic } from "@api/database/bootstrap/bootstrap-clinic";
import { bootstrapEnvSchema, languageText } from "@api/database/bootstrap/bootstrap-env";

async function main(): Promise<void> {
  const env = validateEnv(process.env);
  const parsed = bootstrapEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid BOOTSTRAP_* variables:\n${details}`);
  }

  const bootstrap = parsed.data;
  const passwordHash = bootstrap.BOOTSTRAP_ADMIN_PASSWORD
    ? await hash(bootstrap.BOOTSTRAP_ADMIN_PASSWORD, {
        memoryCost: 19_456,
        timeCost: 2,
        parallelism: 1,
      })
    : null;

  const client = postgres(env.MIGRATION_DATABASE_URL ?? env.DATABASE_URL, { max: 1 });

  try {
    const result = await bootstrapClinic(drizzle(client, { schema }), bootstrap, passwordHash);

    console.log(
      [
        "",
        `Clinic: ${bothNames(languageText(bootstrap, "BOOTSTRAP_CLINIC_NAME"))} (${bootstrap.BOOTSTRAP_CLINIC_SLUG})`,
        result.createdClinic ? "  created" : "  already there",
        result.createdAdmin
          ? `  admin created — signs in as ${bootstrap.BOOTSTRAP_ADMIN_PHONE}${passwordHash ? " with BOOTSTRAP_ADMIN_PASSWORD" : " with a one-time code"}`
          : "  admin already there",
        ...result.notes.map((note) => `  ${note}`),
        "",
      ].join("\n"),
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error("Bootstrap failed:", error);
  process.exit(1);
});
