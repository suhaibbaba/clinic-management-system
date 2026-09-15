import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { USER_ROLE, type UserRole } from '@clinic/shared';

import { DATABASE, type Database } from '@api/database/database.module';
import { roleCapabilities } from '@api/database/schema';
import { CapabilityRegistry } from '@api/permissions/capability-registry.service';

type Grants = ReadonlyMap<string, boolean>;

/**
 * Resolves what a role may do. Only the clinic's *differences* from the shipped defaults are
 * stored, so this answers from the code until somebody changes something.
 */
@Injectable()
export class PermissionsService {
  // Read on every authorised request, so it is not read from Postgres on every authorised request.
  // Invalidated on write; a single VPS runs one process, and a second would need this moving to a
  // shared cache rather than a longer TTL.
  private readonly cache = new Map<string, Grants>();

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly registry: CapabilityRegistry,
  ) {}

  /**
   * The admin is not consulted: they hold every permission, and the screen that edits the others
   * cannot reach them. A clinic that could take a permission from its own administrator could lock
   * itself out of the only account that can give it back.
   */
  async allows(clinicId: string, role: UserRole, capability: string): Promise<boolean> {
    if (role === USER_ROLE.ADMIN) {
      return true;
    }

    const grants = await this.grantsFor(clinicId, role);
    const stored = grants.get(capability);

    if (stored !== undefined) {
      return stored;
    }

    // Nothing stored: whatever the endpoint shipped with.
    return this.registry.get(capability)?.defaultRoles.includes(role) ?? false;
  }

  /** Every capability with the answer for this role, for the screen that edits them. */
  async matrix(clinicId: string, role: UserRole): Promise<Record<string, boolean>> {
    if (role === USER_ROLE.ADMIN) {
      return Object.fromEntries(this.registry.all().map((entry) => [entry.key, true]));
    }

    const grants = await this.grantsFor(clinicId, role);

    return Object.fromEntries(
      this.registry
        .all()
        .map((entry) => [entry.key, grants.get(entry.key) ?? entry.defaultRoles.includes(role)]),
    );
  }

  async set(
    clinicId: string,
    role: UserRole,
    capability: string,
    allowed: boolean,
    actorId: string,
  ): Promise<void> {
    // Refused rather than quietly ignored: the guard would let the admin through anyway, and a
    // stored row saying otherwise is a screen that shows something untrue about who can do what.
    if (role === USER_ROLE.ADMIN) {
      throw new BadRequestException(
        'The administrator holds every permission and cannot be edited',
      );
    }

    // An unknown key would sit in the table for ever, governing nothing.
    if (!this.registry.get(capability)) {
      throw new BadRequestException(`No such permission: ${capability}`);
    }

    await this.db
      .insert(roleCapabilities)
      .values({ clinicId, role, capability, allowed, createdBy: actorId, updatedBy: actorId })
      .onConflictDoUpdate({
        target: [roleCapabilities.clinicId, roleCapabilities.role, roleCapabilities.capability],
        set: { allowed, updatedBy: actorId, updatedAt: new Date() },
      });

    this.cache.delete(`${clinicId}:${role}`);
  }

  private async grantsFor(clinicId: string, role: UserRole): Promise<Grants> {
    const cacheKey = `${clinicId}:${role}`;
    const cached = this.cache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const rows = await this.db
      .select({ capability: roleCapabilities.capability, allowed: roleCapabilities.allowed })
      .from(roleCapabilities)
      .where(and(eq(roleCapabilities.clinicId, clinicId), eq(roleCapabilities.role, role)));

    const grants = new Map(rows.map((row) => [row.capability, row.allowed]));

    this.cache.set(cacheKey, grants);

    return grants;
  }
}
