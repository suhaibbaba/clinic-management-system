import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { USER_ROLE } from '@clinic/shared';
import { eq } from 'drizzle-orm';

import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { doctors } from '@api/database/schema';

/**
 * The one rule the whole module shares: a doctor manages their own calendar.
 *
 * ROLES.md appointments matrix — appointments are `CRUD` for admin and
 * receptionist, and `CRU (own)` for a doctor. "Own" means the appointment is
 * theirs to treat, which is the `doctors` row backed by their user account.
 *
 * Kept here rather than repeated in three services so the rule is reviewable
 * against the spec in one place, and so a later `STRICT_DOCTOR_SCOPE` has one
 * thing to tighten.
 */
@Injectable()
export class AppointmentAccessService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
  ) {}

  /** The `doctors.id` backing this user, or null for a non-doctor account. */
  async ownDoctorId(actor: AuthenticatedUser): Promise<string | null> {
    if (actor.role !== USER_ROLE.DOCTOR) {
      return null;
    }

    const [row] = await this.db
      .select({ id: doctors.id })
      .from(doctors)
      .where(this.scope.where(doctors, actor.clinicId, eq(doctors.userId, actor.id)))
      .limit(1);

    return row?.id ?? null;
  }

  /**
   * Refuses a doctor writing to someone else's calendar.
   *
   * Admin and receptionist pass — booking for every doctor is the front desk's
   * job. A doctor account with no `doctors` row is refused rather than treated
   * as an admin: an account that cannot be matched to a calendar has no own
   * calendar to manage.
   */
  async requireOwnCalendar(actor: AuthenticatedUser, doctorId: string): Promise<void> {
    if (actor.role !== USER_ROLE.DOCTOR) {
      return;
    }

    const own = await this.ownDoctorId(actor);

    if (own !== doctorId) {
      throw new ForbiddenException('You may only manage your own calendar');
    }
  }
}
