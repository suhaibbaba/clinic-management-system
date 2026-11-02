import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import { DATABASE, type Database } from "@api/database/database.module";
import { clinics } from "@api/database/schema";
import { type RequestSite } from "@api/common/types/request-site";
import { STAFF_CLOSED_ENTRIES } from "@api/modules/auth/constants";
import { type ClinicAtHost, type SignInScope } from "@api/modules/auth/lib/clinic-host";

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

  async signInScope(site: RequestSite): Promise<SignInScope> {
    if (site.entry !== null && STAFF_CLOSED_ENTRIES.includes(site.entry)) {
      return { open: false, clinicId: null };
    }

    return { open: true, clinicId: (await this.clinicAt(site.host))?.id ?? null };
  }
}
