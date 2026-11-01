import { sql } from "drizzle-orm";
import { clinics, users } from "@api/database/schema";

export const inLiveClinic = sql`exists (select 1 from ${clinics} where ${clinics.id} = ${users.clinicId} and ${clinics.deletedAt} is null)`;
