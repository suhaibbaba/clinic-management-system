import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { USER_ROLE, type UserRole } from "@clinic/shared";
import { and, eq, exists, isNull, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import {
  ClinicScopeService,
  type ClinicScopedTable,
} from "@api/common/database/clinic-scope.service";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import {
  appointments,
  doctors,
  patients,
  treatmentPlanItems,
  treatmentPlans,
} from "@api/database/schema";

export type PatientRow = typeof patients.$inferSelect;

// A patient id from another clinic is 404, never 403 — a 403 would confirm the record exists
// somewhere. A visiting doctor's unassigned patient is 404 for the same reason.
@Injectable()
export class PatientAccessService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
  ) {}

  async requirePatient(actor: AuthenticatedUser, patientId: string): Promise<PatientRow> {
    const [row] = await this.db
      .select()
      .from(patients)
      .where(
        this.scope.where(
          patients,
          actor.clinicId,
          eq(patients.id, patientId),
          await this.assignedFilter(actor, patients.id),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException("Resource not found");
    }

    return row;
  }

  async requirePatientId(actor: AuthenticatedUser, patientId: string): Promise<string> {
    const [row] = await this.db
      .select({ id: patients.id })
      .from(patients)
      .where(
        this.scope.where(
          patients,
          actor.clinicId,
          eq(patients.id, patientId),
          await this.assignedFilter(actor, patients.id),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException("Resource not found");
    }

    return patientId;
  }

  /** A row that belongs to a patient, by id: 404 when that patient is not the actor's to open. */
  async requireRow<TRow extends Record<string, unknown> & { patientId: string }>(
    actor: AuthenticatedUser,
    table: ClinicScopedTable & { patientId: PgColumn },
    id: string,
  ): Promise<TRow> {
    const row = await this.scope.findOneOrFail<TRow>(table, actor.clinicId, id);

    if (actor.role === USER_ROLE.VISITING_DOCTOR) {
      await this.requirePatientId(actor, row.patientId);
    }

    return row;
  }

  /**
   * The predicate every patient-scoped query adds for a visiting doctor: an appointment, a plan or
   * a plan item with them. Undefined for every other role, which sees the whole clinic.
   */
  async assignedFilter(
    actor: AuthenticatedUser,
    patientIdColumn: PgColumn,
  ): Promise<SQL | undefined> {
    if (actor.role !== USER_ROLE.VISITING_DOCTOR) {
      return undefined;
    }

    const [own] = await this.db
      .select({ id: doctors.id })
      .from(doctors)
      .where(this.scope.where(doctors, actor.clinicId, eq(doctors.userId, actor.id)))
      .limit(1);

    if (!own) {
      return sql`false`;
    }

    return or(
      exists(
        this.db
          .select({ present: sql`1` })
          .from(appointments)
          .where(
            this.scope.where(
              appointments,
              actor.clinicId,
              eq(appointments.patientId, patientIdColumn),
              eq(appointments.doctorId, own.id),
            ),
          ),
      ),
      exists(
        this.db
          .select({ present: sql`1` })
          .from(treatmentPlans)
          .leftJoin(
            treatmentPlanItems,
            and(
              eq(treatmentPlanItems.treatmentPlanId, treatmentPlans.id),
              isNull(treatmentPlanItems.deletedAt),
            ),
          )
          .where(
            this.scope.where(
              treatmentPlans,
              actor.clinicId,
              eq(treatmentPlans.patientId, patientIdColumn),
              or(
                eq(treatmentPlans.doctorId, own.id),
                eq(treatmentPlanItems.performerDoctorId, own.id),
              ),
            ),
          ),
      ),
    );
  }

  // ROLES.md: admin and both doctors receive `PatientClinicalView`; receptionist and technician
  // receive `PatientPublicView`.
  static seesClinicalData(role: UserRole): boolean {
    return (
      role === USER_ROLE.ADMIN || role === USER_ROLE.DOCTOR || role === USER_ROLE.VISITING_DOCTOR
    );
  }

  // The matrix lists `balance` on `PatientPublicView`, but the field rules bar a technician from
  // financial data — the narrower rule wins. A visiting doctor is not the clinic's to show accounts.
  static seesFinancialData(role: UserRole): boolean {
    return role !== USER_ROLE.TECHNICIAN && role !== USER_ROLE.VISITING_DOCTOR;
  }
}
