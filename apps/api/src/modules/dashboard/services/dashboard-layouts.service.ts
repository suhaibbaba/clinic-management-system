import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import {
  DASHBOARD_CAPABILITIES,
  DASHBOARD_KEY_NUMBERS,
  DASHBOARD_QUICK_ACTIONS,
  DEFAULT_DASHBOARD_LAYOUT,
  USER_ROLES,
  keyNumberAvailable,
  quickActionAvailable,
  normalizeDashboardLayout,
  type DashboardLayout,
  type DashboardLayouts,
  type DashboardAllows,
  type SaveDashboardLayoutsInput,
  type UserRole,
} from "@clinic/shared";
import { DATABASE, type Database } from "@api/database/database.module";
import { dashboardLayouts } from "@api/database/schema";
import { PermissionsService } from "@api/modules/permissions/services/permissions.service";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";

@Injectable()
export class DashboardLayoutsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly permissions: PermissionsService,
  ) {}

  async forUser(actor: AuthenticatedUser): Promise<DashboardLayout> {
    const [row] = await this.db
      .select({ layout: dashboardLayouts.layout })
      .from(dashboardLayouts)
      .where(
        and(eq(dashboardLayouts.clinicId, actor.clinicId), eq(dashboardLayouts.role, actor.role)),
      )
      .limit(1);

    return normalizeDashboardLayout(
      row?.layout ?? DEFAULT_DASHBOARD_LAYOUT,
      await this.allowsFor(actor.clinicId, actor.role),
    );
  }

  async list(clinicId: string): Promise<DashboardLayouts> {
    const rows = await this.db
      .select({
        role: dashboardLayouts.role,
        layout: dashboardLayouts.layout,
        updatedAt: dashboardLayouts.updatedAt,
      })
      .from(dashboardLayouts)
      .where(eq(dashboardLayouts.clinicId, clinicId));
    const byRole = new Map(rows.map((row) => [row.role, row]));

    return {
      roles: await Promise.all(
        USER_ROLES.map(async (role) => {
          const row = byRole.get(role);
          const allows = await this.allowsFor(clinicId, role);

          return {
            role,
            layout: normalizeDashboardLayout(row?.layout ?? DEFAULT_DASHBOARD_LAYOUT, allows),
            keyNumberOptions: DASHBOARD_KEY_NUMBERS.filter((key) =>
              keyNumberAvailable(key, allows),
            ),
            quickActionOptions: DASHBOARD_QUICK_ACTIONS.filter((action) =>
              quickActionAvailable(action, allows),
            ),
            customized: row !== undefined,
            updatedAt: row?.updatedAt.toISOString() ?? null,
          };
        }),
      ),
    };
  }

  async save(
    actor: AuthenticatedUser,
    input: SaveDashboardLayoutsInput,
  ): Promise<DashboardLayouts> {
    const entries = await Promise.all(
      input.layouts.map(async ({ role, layout }) => ({
        role,
        layout: normalizeDashboardLayout(layout, await this.allowsFor(actor.clinicId, role)),
      })),
    );

    await this.db.transaction(async (tx) => {
      for (const { role, layout } of entries) {
        await tx
          .insert(dashboardLayouts)
          .values({
            clinicId: actor.clinicId,
            role,
            layout,
            createdBy: actor.id,
            updatedBy: actor.id,
          })
          .onConflictDoUpdate({
            target: [dashboardLayouts.clinicId, dashboardLayouts.role],
            set: { layout, updatedBy: actor.id, updatedAt: new Date() },
          });
      }
    });

    return this.list(actor.clinicId);
  }

  private async allowsFor(clinicId: string, role: UserRole): Promise<DashboardAllows> {
    const granted = new Set<string>();

    await Promise.all(
      DASHBOARD_CAPABILITIES.map(async (capability) => {
        if (await this.permissions.allows(clinicId, role, capability)) {
          granted.add(capability);
        }
      }),
    );

    return (capability) => granted.has(capability);
  }
}
