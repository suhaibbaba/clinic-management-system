import { NestFactory } from "@nestjs/core";
import { USER_ROLE, localDate } from "@clinic/shared";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { DATABASE, type Database } from "@api/database/database.module";
import {
  clinics,
  documentCounters,
  inventoryItems,
  itemPackSizes,
  lotBlocks,
  performedProcedures,
  purchaseRequestLines,
  purchaseRequests,
  stockCountLines,
  stockCounts,
  stockMovements,
  stockReceiptLines,
  stockReceipts,
  supplierAllocations,
  supplierInvoiceLines,
  supplierInvoices,
  supplierOpeningBalances,
  supplierPayments,
  suppliers,
  users,
} from "@api/database/schema";
import { CLINIC_SLUG, CLINIC_TIME_ZONE } from "@api/database/seed/clinic";
import { Rng } from "@api/database/seed/random";
import { writeInventory } from "@api/database/seed/seed-database";
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
    const args = process.argv.slice(2);
    const fresh = args.includes("--fresh");
    const slug = args.find((arg) => !arg.startsWith("--")) ?? CLINIC_SLUG;
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

    if (fresh) {
      report([
        `Removed the clinic's inventory and wrote it again: ${await rewrite(db, clinic.id)}`,
      ]);
    } else if (marker) {
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

const INVENTORY_RANDOM_SEED = 20_260_914;

const INVENTORY_TABLES = [
  stockCountLines,
  stockCounts,
  supplierAllocations,
  supplierInvoiceLines,
  supplierInvoices,
  stockMovements,
  stockReceiptLines,
  stockReceipts,
  purchaseRequestLines,
  purchaseRequests,
  lotBlocks,
  itemPackSizes,
  supplierPayments,
  supplierOpeningBalances,
  inventoryItems,
  suppliers,
  documentCounters,
] as const;

async function rewrite(db: Database, clinicId: string): Promise<string> {
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(eq(users.clinicId, clinicId), eq(users.role, USER_ROLE.ADMIN), isNull(users.deletedAt)),
    )
    .orderBy(asc(users.createdAt))
    .limit(1);

  if (!admin) {
    throw new Error("The clinic has no admin to write the inventory as");
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`set local session_replication_role = replica`);

    for (const table of INVENTORY_TABLES) {
      await tx.delete(table).where(eq(table.clinicId, clinicId));
    }
  });

  const procedures = await db
    .select({
      id: performedProcedures.id,
      patientId: performedProcedures.patientId,
      performedAt: performedProcedures.performedAt,
    })
    .from(performedProcedures)
    .where(eq(performedProcedures.clinicId, clinicId))
    .orderBy(asc(performedProcedures.performedAt));
  const now = new Date();
  const counts = await writeInventory(
    db,
    {
      clinicId,
      actorId: admin.id,
      audit: { createdBy: admin.id, updatedBy: admin.id },
      rng: new Rng(INVENTORY_RANDOM_SEED),
      now,
      today: localDate(now, CLINIC_TIME_ZONE),
    },
    procedures,
  );

  return Object.entries(counts)
    .map(([name, value]) => `${name} ${value}`)
    .join(", ");
}

function report(lines: readonly string[]): void {
  console.log(lines.join("\n"));
}

main().catch((error: unknown) => {
  console.error("Inventory seed failed:", error);
  process.exitCode = 1;
});
