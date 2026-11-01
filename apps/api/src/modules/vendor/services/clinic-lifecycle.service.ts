import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import {
  addDays,
  countryPreset,
  joinPersonName,
  SUBSCRIPTION_EVENT,
  SUBSCRIPTION_STATUS,
  USER_ROLE,
  type CreateClinicInput,
  type CreatedClinic,
} from "@clinic/shared";
import { DATABASE, type Database } from "@api/database/database.module";
import { clinics, plans, subscriptions, users } from "@api/database/schema";
import { grantSpecialty } from "@api/database/clinic-specialties";
import { forgetSessionState } from "@api/common/database/session-state";
import { TokenService } from "@api/modules/auth/services/token.service";
import { PermissionsService } from "@api/modules/permissions/services/permissions.service";
import { conflictFor } from "@api/modules/vendor/lib/vendor-conflicts";
import { SubscriptionsService } from "@api/modules/vendor/services/subscriptions.service";

@Injectable()
export class ClinicLifecycleService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly subscriptions: SubscriptionsService,
    private readonly tokens: TokenService,
    private readonly permissions: PermissionsService,
  ) {}

  async create(
    input: CreateClinicInput,
    actorId: string,
    today: string = new Date().toISOString().slice(0, 10),
  ): Promise<CreatedClinic> {
    try {
      return await this.db.transaction(async (tx) => {
        const [plan] = await tx
          .select({
            id: plans.id,
            code: plans.code,
            modules: plans.modules,
            isActive: plans.isActive,
          })
          .from(plans)
          .where(eq(plans.id, input.planId))
          .limit(1);

        if (!plan?.isActive) {
          throw new BadRequestException("No such plan");
        }

        const preset = countryPreset(input.country);
        const language = preset.languages[0];
        const [clinic] = await tx
          .insert(clinics)
          .values({
            slug: input.slug,
            name: input.name,
            country: input.country,
            currency: preset.currency,
            siteDomain: input.domain,
            modules: [...plan.modules],
            settings: { timezone: preset.timeZone },
          })
          .returning({ id: clinics.id });

        if (!clinic) {
          throw new Error("Failed to create the clinic");
        }

        for (const code of input.specialties) {
          await grantSpecialty(tx, clinic.id, code);
        }

        const firstName = { [language]: input.admin.firstName };
        const lastName = { [language]: input.admin.lastName };

        await tx.insert(users).values({
          clinicId: clinic.id,
          firstName,
          lastName,
          name: joinPersonName(firstName, lastName),
          phone: input.admin.phone,
          email: input.admin.email,
          passwordHash: null,
          role: USER_ROLE.ADMIN,
        });

        await tx.insert(subscriptions).values({
          clinicId: clinic.id,
          planId: plan.id,
          status: input.trialDays > 0 ? SUBSCRIPTION_STATUS.TRIAL : SUBSCRIPTION_STATUS.ACTIVE,
          startsOn: today,
          endsOn: input.trialDays > 0 ? addDays(today, input.trialDays) : null,
          createdBy: actorId,
          updatedBy: actorId,
        });

        await this.subscriptions.record(
          tx,
          clinic.id,
          actorId,
          SUBSCRIPTION_EVENT.CLINIC_CREATED,
          null,
          {
            slug: input.slug,
            plan: plan.code,
            trialDays: input.trialDays,
            specialties: input.specialties,
          },
        );

        return { id: clinic.id };
      });
    } catch (error) {
      throw conflictFor(error) ?? error;
    }
  }

  async remove(clinicId: string, actorId: string): Promise<void> {
    const staff = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(clinics)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(clinics.id, clinicId), isNull(clinics.deletedAt)))
        .returning({ slug: clinics.slug });

      if (!row) {
        throw new NotFoundException("Clinic not found");
      }

      await this.subscriptions.record(
        tx,
        clinicId,
        actorId,
        SUBSCRIPTION_EVENT.CLINIC_REMOVED,
        null,
        {
          slug: row.slug,
        },
      );

      return tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.clinicId, clinicId), isNull(users.deletedAt)));
    });

    for (const { id } of staff) {
      await this.tokens.revokeAllForUser(id);
      forgetSessionState(id);
    }

    this.permissions.forgetClinic(clinicId);
  }

  async restore(clinicId: string, actorId: string): Promise<void> {
    try {
      await this.db.transaction(async (tx) => {
        const [row] = await tx
          .update(clinics)
          .set({ deletedAt: null, updatedAt: new Date() })
          .where(and(eq(clinics.id, clinicId), isNotNull(clinics.deletedAt)))
          .returning({ slug: clinics.slug });

        if (!row) {
          throw new NotFoundException("Clinic not found");
        }

        await this.subscriptions.record(
          tx,
          clinicId,
          actorId,
          SUBSCRIPTION_EVENT.CLINIC_RESTORED,
          null,
          { slug: row.slug },
        );
      });
    } catch (error) {
      throw conflictFor(error) ?? error;
    }

    this.permissions.forgetClinic(clinicId);
  }
}
