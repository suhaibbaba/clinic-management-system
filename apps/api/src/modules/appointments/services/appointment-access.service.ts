import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { eq, sql, type SQL } from "drizzle-orm";
import { type PgColumn } from "drizzle-orm/pg-core";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { doctors } from "@api/database/schema";
import { HAS_OWN_CALENDAR, NO_DOCTOR_ID } from "@api/modules/appointments/constants";

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

  async calendarScope(actor: AuthenticatedUser): Promise<string | null> {
    if (!HAS_OWN_CALENDAR.includes(actor.role)) {
      return null;
    }

    return (await this.ownDoctorId(actor)) ?? NO_DOCTOR_ID;
  }

  async requireOwnCalendar(actor: AuthenticatedUser, doctorId: string): Promise<void> {
    if (!HAS_OWN_CALENDAR.includes(actor.role)) {
      return;
    }

    const own = await this.ownDoctorId(actor);

    if (own !== doctorId) {
      throw new ForbiddenException("You may only manage your own calendar");
    }
  }

  async readableFilter(actor: AuthenticatedUser, doctorColumn: PgColumn): Promise<SQL | undefined> {
    if (!HAS_OWN_CALENDAR.includes(actor.role)) {
      return undefined;
    }

    const own = await this.ownDoctorId(actor);

    return own === null ? sql`false` : eq(doctorColumn, own);
  }
}
