import { type SQL, sql } from "drizzle-orm";
import { type ClinicModule } from "@clinic/shared";
import { clinics } from "@api/database/schema";

export const clinicHasModule = (module: ClinicModule): SQL =>
  sql`${module} = any(${clinics.modules})`;
