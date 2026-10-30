import { NestFactory } from "@nestjs/core";
import { USER_ROLE } from "@clinic/shared";
import { and, asc, eq, isNull } from "drizzle-orm";
import { DATABASE, type Database } from "@api/database/database.module";
import { clinics, suppliers, users } from "@api/database/schema";
import { CLINIC_SLUG } from "@api/database/seed/clinic";
import { SCENARIO_SUPPLIERS } from "@api/database/seed/inventory-practice";
import { InventorySeedModule } from "@api/database/seed/inventory-seed.module";
import { seedInventoryScenarios } from "@api/database/seed/seed-inventory-scenarios";

async function main(): Promise<void> {
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("Refusing to seed a production database");
  }

  const app = await NestFactory.createApplicationContext(InventorySeedModule, {
    logger: ["error", "warn"],
  });

  try {
    const db = app.get<Database>(DATABASE);
    const slug = process.argv[2] ?? CLINIC_SLUG;
    const [clinic] = await db
      .select({ id: clinics.id })
      .from(clinics)
      .where(eq(clinics.slug, slug))
      .limit(1);

    if (!clinic) {
      throw new Error(`No clinic with the slug "${slug}"; run the seed first`);
    }

    const [marker] = await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(
        and(
          eq(suppliers.clinicId, clinic.id),
          eq(suppliers.name, SCENARIO_SUPPLIERS[0]?.name ?? ""),
        ),
      )
      .limit(1);

    if (marker) {
      report(["The inventory scenarios are already in this clinic; nothing to add."]);
      return;
    }

    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.clinicId, clinic.id),
          eq(users.role, USER_ROLE.ADMIN),
          isNull(users.deletedAt),
        ),
      )
      .orderBy(asc(users.createdAt))
      .limit(2);
    const [first, second] = admins;

    if (!first) {
      throw new Error("The clinic has no admin to post the scenarios as");
    }

    const startedAt = Date.now();
    const result = await seedInventoryScenarios(app, {
      manager: { id: first.id, clinicId: clinic.id, role: USER_ROLE.ADMIN },
      colleague: second ? { id: second.id, clinicId: clinic.id, role: USER_ROLE.ADMIN } : null,
    });

    const seconds = Math.round((Date.now() - startedAt) / 1000);

    report([
      `Inventory scenarios: ${result.done.length} steps in ${seconds}s.`,
      ...(result.failed.length > 0
        ? [
            `${result.failed.length} steps were refused:`,
            ...result.failed.map((line) => `  - ${line}`),
          ]
        : []),
    ]);

    if (result.failed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

function report(lines: readonly string[]): void {
  console.log(lines.join("\n"));
}

main().catch((error: unknown) => {
  console.error("Inventory seed failed:", error);
  process.exitCode = 1;
});
