import { eq, sql } from "drizzle-orm";
import { type Database } from "@api/database/database.module";
import { appointments } from "@api/database/schema";

export async function moveIntoPast(db: Database, id: string, days = 14): Promise<void> {
  await db
    .update(appointments)
    .set({ startsAt: sql`${appointments.startsAt} - make_interval(days => ${days})` })
    .where(eq(appointments.id, id));
}
