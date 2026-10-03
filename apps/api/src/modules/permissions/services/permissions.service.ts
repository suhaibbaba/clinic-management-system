import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { USER_ROLE, type UserRole } from "@clinic/shared";
import { DATABASE, type Database } from "@api/database/database.module";
import { clinics, roleCapabilities } from "@api/database/schema";
import { CapabilityRegistry } from "@api/modules/permissions/services/capability-registry.service";
import { Grants } from "@api/modules/permissions/lib/permissions";
import { type Capability } from "@api/modules/permissions/lib/capability-registry";
import { MODULES_CACHE_MS } from "@api/modules/permissions/constants";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";

@Injectable()
export class PermissionsService {
  private readonly cache = new Map<string, Grants>();
  private readonly modulesCache = new Map<
    string,
    { readonly modules: ReadonlySet<string>; readonly at: number }
  >();

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly registry: CapabilityRegistry,
  ) {}

  async available(clinicId: string, capability: string): Promise<boolean> {
    const module = this.registry.get(capability)?.module;

    return module === undefined || (await this.enabledModules(clinicId)).has(module);
  }

  async availableCapabilities(clinicId: string): Promise<Capability[]> {
    const modules = await this.enabledModules(clinicId);

    return this.registry
      .all()
      .filter((entry) => entry.module === undefined || modules.has(entry.module));
  }

  async allows(clinicId: string, role: UserRole, capability: string): Promise<boolean> {
    if (!(await this.available(clinicId, capability))) {
      return false;
    }

    if (role === USER_ROLE.ADMIN) {
      return true;
    }

    const grants = await this.grantsFor(clinicId, role);
    const stored = grants.get(capability);

    if (stored !== undefined) {
      return stored;
    }

    return this.registry.get(capability)?.defaultRoles.includes(role) ?? false;
  }

  can(actor: AuthenticatedUser, capability: string): Promise<boolean> {
    return this.allows(actor.clinicId, actor.role, capability);
  }

  async matrix(clinicId: string, role: UserRole): Promise<Record<string, boolean>> {
    const available = await this.availableCapabilities(clinicId);

    if (role === USER_ROLE.ADMIN) {
      return Object.fromEntries(available.map((entry) => [entry.key, true]));
    }

    const grants = await this.grantsFor(clinicId, role);

    return Object.fromEntries(
      available.map((entry) => [
        entry.key,
        grants.get(entry.key) ?? entry.defaultRoles.includes(role),
      ]),
    );
  }

  async set(
    clinicId: string,
    role: UserRole,
    capability: string,
    allowed: boolean,
    actorId: string,
  ): Promise<void> {
    if (role === USER_ROLE.ADMIN) {
      throw new BadRequestException(
        "The administrator holds every permission and cannot be edited",
      );
    }

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

  private async enabledModules(clinicId: string): Promise<ReadonlySet<string>> {
    const cached = this.modulesCache.get(clinicId);

    if (cached && Date.now() - cached.at < MODULES_CACHE_MS) {
      return cached.modules;
    }

    const [row] = await this.db
      .select({ modules: clinics.modules })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);
    const modules = new Set<string>(row?.modules ?? []);

    this.modulesCache.set(clinicId, { modules, at: Date.now() });

    return modules;
  }
}
