import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  AUDIT_ACTION,
  PATIENT_REF_MESSAGE,
  type CreatePatientInput,
  type InlinePatientInput,
} from '@clinic/shared';
import { eq, sql } from 'drizzle-orm';

import { AuditService } from '@api/audit/audit.service';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database, type DatabaseExecutor } from '@api/database/database.module';
import { patients } from '@api/database/schema';
import type { PatientRow } from '@api/patients/patient-access.service';
import { PATIENTS_ENTITY, toPublicView } from '@api/patients/patient-view';

/** File numbers are zero-padded so they sort and read like a paper file. */
const FILE_NUMBER_WIDTH = 5;
/** Bounded retry when two receptionists register a patient at the same moment. */
const FILE_NUMBER_ATTEMPTS = 5;

/** What a form sends instead of a patient: an id, or the little it knows about a new one. */
export interface PatientRef {
  readonly patientId?: string | undefined;
  readonly newPatient?: InlinePatientInput | undefined;
}

@Injectable()
export class PatientRegistrationService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly audit: AuditService,
  ) {}

  // One transaction when the patient is new: a patient registered for an appointment that then
  // clashes is a record nobody asked for, left behind on a form that failed.
  async withPatient<TResult>(
    actor: AuthenticatedUser,
    ref: PatientRef,
    write: (executor: DatabaseExecutor, patientId: string) => Promise<TResult>,
  ): Promise<TResult> {
    const { newPatient, patientId } = ref;

    if (newPatient) {
      return this.db.transaction(async (tx) => {
        const patient = await this.register(tx, actor, newPatient);

        return write(tx, patient.id);
      });
    }

    /* istanbul ignore next -- the create schemas refuse a body with neither. */
    if (!patientId) {
      throw new BadRequestException(PATIENT_REF_MESSAGE);
    }

    return write(this.db, patientId);
  }

  /** The whole registration: the duplicate check, the file number and the audit entry. */
  async register(
    executor: DatabaseExecutor,
    actor: AuthenticatedUser,
    input: CreatePatientInput,
  ): Promise<PatientRow> {
    await this.assertPhoneIsFree(executor, actor, input.phone);

    const row = await this.insertPatient(executor, actor, input);

    await this.audit.record(
      {
        clinicId: actor.clinicId,
        userId: actor.id,
        action: AUDIT_ACTION.CREATE,
        entity: PATIENTS_ENTITY,
        entityId: row.id,
        oldValue: null,
        newValue: { ...toPublicView(row), registeredInline: true },
      },
      executor,
    );

    return row;
  }

  private async assertPhoneIsFree(
    executor: DatabaseExecutor,
    actor: AuthenticatedUser,
    phone: string,
  ): Promise<void> {
    const digits = phone.replaceAll(/\D/g, '');

    const [existing] = await executor
      .select()
      .from(patients)
      .where(
        this.scope.where(
          patients,
          actor.clinicId,
          sql`regexp_replace(${patients.phone}, '[^0-9]', '', 'g') = ${digits}`,
        ),
      )
      .limit(1);

    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: 'A patient is already registered with this phone number',
        existingPatient: toPublicView(existing),
      });
    }
  }

  // Two concurrent registrations can read the same maximum; the unique index is the real guard.
  // Each attempt is its own savepoint, or the first violation would poison the caller's transaction.
  async insertPatient(
    executor: DatabaseExecutor,
    actor: AuthenticatedUser,
    input: CreatePatientInput,
  ): Promise<PatientRow> {
    for (let attempt = 0; attempt < FILE_NUMBER_ATTEMPTS; attempt += 1) {
      const fileNumber = await this.nextFileNumber(executor, actor.clinicId, attempt);

      try {
        return await executor.transaction(async (savepoint) => {
          const [row] = await savepoint
            .insert(patients)
            .values({
              clinicId: actor.clinicId,
              fileNumber,
              fullName: input.fullName,
              phone: input.phone,
              dateOfBirth: input.dateOfBirth ?? null,
              gender: input.gender ?? null,
              address: input.address ?? null,
              nationalId: input.nationalId ?? null,
              emergencyContactName: input.emergencyContactName ?? null,
              emergencyContactPhone: input.emergencyContactPhone ?? null,
              notes: input.notes ?? null,
              createdBy: actor.id,
              updatedBy: actor.id,
            })
            .returning();

          if (!row) {
            throw new Error('Failed to register the patient');
          }

          return row;
        });
      } catch (error: unknown) {
        if (!isUniqueViolation(error)) {
          throw error;
        }
      }
    }

    throw new ConflictException('Could not allocate a file number, please retry');
  }

  private async nextFileNumber(
    executor: DatabaseExecutor,
    clinicId: string,
    offset: number,
  ): Promise<string> {
    const [result] = await executor
      .select({
        max: sql<number>`coalesce(max(nullif(regexp_replace(${patients.fileNumber}, '\\D', '', 'g'), '')::bigint), 0)::int`,
      })
      .from(patients)
      .where(eq(patients.clinicId, clinicId));

    return String((result?.max ?? 0) + 1 + offset).padStart(FILE_NUMBER_WIDTH, '0');
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505'
  );
}
