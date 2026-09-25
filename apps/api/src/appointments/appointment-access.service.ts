import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { USER_ROLE } from "@clinic/shared";
import { eq, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { doctors } from "@api/database/schema";

// ROLES.md: appointments are CRUD for admin and receptionist, CRU (own) for a doctor — "own" being
// their `doctors` row. Defined once here. A visiting doctor's own is also all they may read.
const HAS_OWN_CALENDAR: readonly string[] = [USER_ROLE.DOCTOR, USER_ROLE.VISITING_DOCTOR];

@Injectable()
export class AppointmentAccessService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
  ) {}

  async ownDoctorId(actor: AuthenticatedUser): Promise<string | null> {
    if (!HAS_OWN_CALENDAR.includes(actor.role)) {
      return null;
    }

    const [row] = await this.db
      .select({ id: doctors.id })
      .from(doctors)
      .where(this.scope.where(doctors, actor.clinicId, eq(doctors.userId, actor.id)))
      .limit(1);

    return row?.id ?? null;
  }

  // A doctor account with no `doctors` row is refused rather than waved through: it has no own
  // calendar to manage.
  async requireOwnCalendar(actor: AuthenticatedUser, doctorId: string): Promise<void> {
    if (!HAS_OWN_CALENDAR.includes(actor.role)) {
      return;
    }

    const own = await this.ownDoctorId(actor);

    if (own !== doctorId) {
      throw new ForbiddenException("You may only manage your own calendar");
    }
  }

  /** Narrows a read to the visiting doctor's own column; undefined for every other role. */
  async readableFilter(actor: AuthenticatedUser, doctorColumn: PgColumn): Promise<SQL | undefined> {
    if (actor.role !== USER_ROLE.VISITING_DOCTOR) {
      return undefined;
    }

    const own = await this.ownDoctorId(actor);

    return own === null ? sql`false` : eq(doctorColumn, own);
  }
}
