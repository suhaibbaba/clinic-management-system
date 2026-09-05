import { Inject, Injectable, NotFoundException, type OnModuleInit } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { Clinic, UpdateClinicInput } from '@clinic/shared';

import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { clinics } from '@api/database/schema';

type ClinicRow = typeof clinics.$inferSelect;

export const CLINICS_ENTITY = 'clinics';

/**
 * The caller's own clinic.
 *
 * `clinics` is the one table without a `clinic_id` column — it *is* the tenant —
 * so scoping is `id = caller.clinicId` rather than `ClinicScopeService`. There
 * is no endpoint that takes a clinic id, so a caller can only ever reach theirs.
 */
@Injectable()
export class ClinicsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(CLINICS_ENTITY, async (id, clinicId) => {
      if (id !== clinicId) {
        return null;
      }

      const row = await this.findOwn(clinicId);
      return row ? { ...toClinic(row) } : null;
    });
  }

  async get(actor: AuthenticatedUser): Promise<Clinic> {
    return toClinic(await this.findOwnOrFail(actor.clinicId));
  }

  async update(actor: AuthenticatedUser, input: UpdateClinicInput): Promise<Clinic> {
    await this.findOwnOrFail(actor.clinicId);

    const [row] = await this.db
      .update(clinics)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.logoKey !== undefined && { logoKey: input.logoKey ?? null }),
        ...(input.phone !== undefined && { phone: input.phone ?? null }),
        ...(input.email !== undefined && { email: input.email ?? null }),
        ...(input.address !== undefined && { address: input.address ?? null }),
        ...(input.currency !== undefined && { currency: input.currency }),
        ...(input.workingHours !== undefined && { workingHours: input.workingHours }),
        ...(input.settings !== undefined && { settings: input.settings }),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(and(eq(clinics.id, actor.clinicId), isNull(clinics.deletedAt)))
      .returning();

    /* istanbul ignore next -- the row was just loaded. */
    if (!row) {
      throw new NotFoundException('Resource not found');
    }

    return toClinic(row);
  }

  private async findOwn(clinicId: string): Promise<ClinicRow | undefined> {
    const [row] = await this.db
      .select()
      .from(clinics)
      .where(and(eq(clinics.id, clinicId), isNull(clinics.deletedAt)))
      .limit(1);

    return row;
  }

  private async findOwnOrFail(clinicId: string): Promise<ClinicRow> {
    const row = await this.findOwn(clinicId);

    if (!row) {
      throw new NotFoundException('Resource not found');
    }

    return row;
  }
}

function toClinic(row: ClinicRow): Clinic {
  return {
    id: row.id,
    name: row.name,
    logoKey: row.logoKey,
    phone: row.phone,
    email: row.email,
    address: row.address,
    currency: row.currency,
    workingHours: row.workingHours,
    settings: row.settings,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
