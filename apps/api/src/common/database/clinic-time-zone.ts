import { clinicLocale } from "@clinic/shared";
import { eq } from "drizzle-orm";
import { type Database } from "@api/database/database.module";
import { clinics } from "@api/database/schema";

export async function clinicTimeZone(db: Database, clinicId: string): Promise<string> {
  const [row] = await db
    .select({ country: clinics.country, settings: clinics.settings })
    .from(clinics)
    .where(eq(clinics.id, clinicId))
    .limit(1);

  return clinicLocale(row).timeZone;
}
