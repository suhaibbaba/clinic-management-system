import { Inject, Injectable } from '@nestjs/common';
import { USER_ROLE, type UserRole } from '@clinic/shared';
import { eq } from 'drizzle-orm';

import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { patients } from '@api/database/schema';

export type PatientRow = typeof patients.$inferSelect;

/**
 * Checks every patient-scoped endpoint shares.
 *
 * A patient id that belongs to another clinic is reported as 404, never 403 —
 * a 403 would confirm the record exists somewhere (ROLES.md global rule 1).
 */
@Injectable()
export class PatientAccessService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
  ) {}

  /** Loads the patient within the caller's clinic, or throws 404. */
  async requirePatient(actor: AuthenticatedUser, patientId: string): Promise<PatientRow> {
    return this.scope.findOneOrFail<PatientRow>(patients, actor.clinicId, patientId);
  }

  /** Cheap existence check for endpoints that do not need the row itself. */
  async requirePatientId(actor: AuthenticatedUser, patientId: string): Promise<string> {
    const [row] = await this.db
      .select({ id: patients.id })
      .from(patients)
      .where(this.scope.where(patients, actor.clinicId, eq(patients.id, patientId)))
      .limit(1);

    if (!row) {
      await this.requirePatient(actor, patientId);
    }

    return patientId;
  }

  /**
   * Whether the caller may see clinical detail at all.
   *
   * ROLES.md: admin and doctor receive `PatientClinicalView`; receptionist and
   * technician receive `PatientPublicView` and no clinical records.
   */
  static seesClinicalData(role: UserRole): boolean {
    return role === USER_ROLE.ADMIN || role === USER_ROLE.DOCTOR;
  }

  /**
   * Whether the caller may see what a patient owes.
   *
   * ROLES.md lists `balance` on `PatientPublicView`, which goes to both the
   * receptionist and the technician — but the field rules say a technician
   * response must never carry financial patient data. The narrower rule wins,
   * so the technician is the one role that sees no money.
   */
  static seesFinancialData(role: UserRole): boolean {
    return role !== USER_ROLE.TECHNICIAN;
  }
}
