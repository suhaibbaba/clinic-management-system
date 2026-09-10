import { Inject, Injectable } from '@nestjs/common';
import { USER_ROLE, type UserRole } from '@clinic/shared';
import { eq } from 'drizzle-orm';

import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { patients } from '@api/database/schema';

export type PatientRow = typeof patients.$inferSelect;

// A patient id from another clinic is 404, never 403 — a 403 would confirm the record exists
// somewhere.
@Injectable()
export class PatientAccessService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
  ) {}

  async requirePatient(actor: AuthenticatedUser, patientId: string): Promise<PatientRow> {
    return this.scope.findOneOrFail<PatientRow>(patients, actor.clinicId, patientId);
  }

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

  // ROLES.md: admin and doctor receive `PatientClinicalView`; receptionist and technician receive
  // `PatientPublicView`.
  static seesClinicalData(role: UserRole): boolean {
    return role === USER_ROLE.ADMIN || role === USER_ROLE.DOCTOR;
  }

  // The matrix lists `balance` on `PatientPublicView`, but the field rules bar a technician from
  // financial data — the narrower rule wins.
  static seesFinancialData(role: UserRole): boolean {
    return role !== USER_ROLE.TECHNICIAN;
  }
}
