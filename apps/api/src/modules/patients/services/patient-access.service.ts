import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { RULE } from "@clinic/shared";
import { and, eq, exists, isNull, or, sql, type SQL } from "drizzle-orm";
import { alias, type PgColumn } from "drizzle-orm/pg-core";
import {
  ClinicScopeService,
  type ClinicScopedTable,
} from "@api/common/database/clinic-scope.service";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { appointments, doctors, patients, performedProcedures } from "@api/database/schema";
import { PatientRow } from "@api/modules/patients/lib/patient-access";
import { PermissionsService } from "@api/modules/permissions/services/permissions.service";

const assigned = alias(patients, "assigned_patient");

@Injectable()
export class PatientAccessService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly permissions: PermissionsService,
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

  async requireRow<TRow extends Record<string, unknown> & { patientId: string }>(
    actor: AuthenticatedUser,
    table: ClinicScopedTable & { patientId: PgColumn },
    id: string,
  ): Promise<TRow> {
    const row = await this.scope.findOneOrFail<TRow>(table, actor.clinicId, id);

    if (!(await this.seesAllPatients(actor))) {
      await this.requirePatientId(actor, row.patientId);
    }

    return row;
  }

  async assignedFilter(
    actor: AuthenticatedUser,
    patientIdColumn: PgColumn,
  ): Promise<SQL | undefined> {
    if (await this.seesAllPatients(actor)) {
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
          .from(assigned)
          .where(
            and(
              eq(assigned.clinicId, actor.clinicId),
              isNull(assigned.deletedAt),
              eq(assigned.id, patientIdColumn),
              eq(assigned.assignedDoctorId, own.id),
            ),
          ),
      ),
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
          .from(performedProcedures)
          .where(
            this.scope.where(
              performedProcedures,
              actor.clinicId,
              eq(performedProcedures.patientId, patientIdColumn),
              eq(performedProcedures.doctorId, own.id),
            ),
          ),
      ),
    );
  }

  async requireDoctor(
    actor: AuthenticatedUser,
    doctorId: string | null | undefined,
  ): Promise<void> {
    if (!doctorId) {
      return;
    }

    const [row] = await this.db
      .select({ id: doctors.id })
      .from(doctors)
      .where(this.scope.where(doctors, actor.clinicId, eq(doctors.id, doctorId)))
      .limit(1);

    if (!row) {
      throw new BadRequestException("Doctor not found in this clinic");
    }
  }

  seesAllPatients(actor: AuthenticatedUser): Promise<boolean> {
    return this.permissions.can(actor, RULE.PATIENTS_ALL);
  }

  seesClinicalData(actor: AuthenticatedUser): Promise<boolean> {
    return this.permissions.can(actor, RULE.PATIENTS_CLINICAL);
  }

  seesFinancialData(actor: AuthenticatedUser): Promise<boolean> {
    return this.permissions.can(actor, RULE.PATIENTS_FINANCIAL);
  }
}
