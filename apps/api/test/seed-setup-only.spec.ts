import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import type { Database } from "@api/database/database.module";
import * as schema from "@api/database/schema";
import {
  appointments,
  inventoryItems,
  labs,
  lookupOptions,
  patients,
  procedureCatalog,
  stockMovements,
  suppliers,
} from "@api/database/schema";
import { seedDatabase, type SeedOptions, type SeedSummary } from "@api/database/seed/seed-database";

describe("the seed without demo data", () => {
  jest.setTimeout(60_000);

  let client: ReturnType<typeof postgres>;
  let db: Database;
  let options: SeedOptions;
  let summary: SeedSummary;
  let clinicId: string;

  beforeAll(async () => {
    const databaseUrl = process.env["DATABASE_URL"];

    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required to run the API tests.");
    }

    client = postgres(databaseUrl, { max: 1, onnotice: () => {} });
    db = drizzle(client, { schema });

    const handle = randomUUID().slice(0, 8);

    options = {
      passwordHash: "x".repeat(32),
      slug: `setup-${handle}`,
      namePrefix: handle,
      identifierPrefix: handle,
      demo: false,
    };

    summary = await seedDatabase(db, options);
    clinicId = summary.clinicId;
  });

  afterAll(async () => {
    await client.end();
  });

  const countOf = async (
    table: typeof patients | typeof appointments | typeof stockMovements | typeof lookupOptions,
  ): Promise<number> =>
    (await db.select({ id: table.id }).from(table).where(eq(table.clinicId, clinicId))).length;

  it("writes the clinic's setup", async () => {
    expect(summary.created).toBe(true);
    expect(summary.accounts.length).toBe(5);
    expect(await countOf(lookupOptions)).toBeGreaterThan(0);

    for (const table of [procedureCatalog, labs, suppliers, inventoryItems]) {
      const rows = await db
        .select({ id: table.id })
        .from(table)
        .where(eq(table.clinicId, clinicId));
      expect(rows.length).toBeGreaterThan(0);
    }

    expect(summary.counts["labWorkTypes"]).toBeGreaterThan(0);
  });

  it("writes no patients and no activity", async () => {
    expect(await countOf(patients)).toBe(0);
    expect(await countOf(appointments)).toBe(0);
    expect(await countOf(stockMovements)).toBe(0);
  });

  it("writes nothing the second time it is run", async () => {
    const again = await seedDatabase(db, options);
    const labRows = await db.select({ id: labs.id }).from(labs).where(eq(labs.clinicId, clinicId));

    expect(again.created).toBe(false);
    expect(labRows.length).toBe(summary.counts["labs"]);
  });
});
