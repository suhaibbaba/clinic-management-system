import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import { DATABASE, type Database } from "@api/database/database.module";
import { clinics } from "@api/database/schema";
import { type ClinicAtHost } from "@api/modules/auth/lib/clinic-host";

@Injectable()
export class ClinicHostService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async clinicAt(host: string): Promise<ClinicAtHost | null> {
    const [clinic] = await this.db
      .select({ id: clinics.id, googleClientId: clinics.googleClientId })
      .from(clinics)
      .where(and(eq(clinics.appDomain, host), isNull(clinics.deletedAt)))
      .limit(1);

    return clinic ?? null;
  }
}
