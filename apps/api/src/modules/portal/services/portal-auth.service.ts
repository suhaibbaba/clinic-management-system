import { Inject, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import {
  DEFAULT_TIME_ZONE,
  NOTIFICATION_TEMPLATE,
  clinicScheduleSettings,
  type PortalAccount,
  type PortalCodeReceipt,
  type PortalPatientSummary,
} from "@clinic/shared";
import { and, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import { notificationName } from "@api/common/person-name";
import { DATABASE, type Database } from "@api/database/database.module";
import { clinics, patients, portalCodes, portalSessions } from "@api/database/schema";
import { NotificationsService } from "@api/modules/notifications/services/notifications.service";
import { WebsiteService } from "@api/modules/website/services/website.service";
import {
  PORTAL_CODE_MAX_ATTEMPTS,
  PORTAL_CODE_RESEND_SECONDS,
  PORTAL_CODE_TTL_SECONDS,
  PORTAL_CODES_PER_HOUR,
  PORTAL_SESSION_HOURS,
} from "@api/modules/portal/constants";
import {
  generatePortalCode,
  generateSessionToken,
  hashPortalCode,
  hashSessionToken,
  phoneKey,
  portalCodeMatches,
} from "@api/modules/portal/lib/portal-code";
import { type PortalSessionContext } from "@api/modules/portal/lib/portal-session";
import { phoneMatches } from "@api/common/lib/phone";

@Injectable()
export class PortalAuthService {
  private readonly logger = new Logger(PortalAuthService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly website: WebsiteService,
    private readonly notifications: NotificationsService,
  ) {}

  async requestCode(slug: string, rawPhone: string): Promise<PortalCodeReceipt> {
    const clinic = await this.website.requirePortalClinic(slug);
    const phone = phoneKey(rawPhone);
    const receipt: PortalCodeReceipt = {
      sent: true,
      expiresInSeconds: PORTAL_CODE_TTL_SECONDS,
      resendAfterSeconds: PORTAL_CODE_RESEND_SECONDS,
    };

    if ((await this.patientsFor(clinic.id, phone)).length === 0) {
      this.logger.log("Portal code asked for a phone with no patient; nothing sent.");
      return receipt;
    }

    if (!(await this.maySend(clinic.id, phone))) {
      this.logger.warn(`Portal code for clinic ${clinic.id} held back by the send limit.`);
      return receipt;
    }

    const code = generatePortalCode();

    await this.db
      .update(portalCodes)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(portalCodes.clinicId, clinic.id),
          eq(portalCodes.phoneDigits, phone),
          isNull(portalCodes.consumedAt),
        ),
      );

    await this.db.insert(portalCodes).values({
      clinicId: clinic.id,
      phoneDigits: phone,
      codeHash: hashPortalCode(clinic.id, phone, code),
      expiresAt: new Date(Date.now() + PORTAL_CODE_TTL_SECONDS * 1000),
    });

    void this.notifications
      .send({
        clinicId: clinic.id,
        to: rawPhone,
        template: NOTIFICATION_TEMPLATE.PORTAL_CODE,
        vars: {
          clinic: notificationName(clinic.name),
          code,
          minutes: String(PORTAL_CODE_TTL_SECONDS / 60),
        },
      })
      .catch((error: unknown) => {
        this.logger.error(
          `Could not send the portal code for clinic ${clinic.id}: ${String(error)}`,
        );
      });

    return receipt;
  }

  async startSession(
    slug: string,
    rawPhone: string,
    code: string,
  ): Promise<{ token: string; account: PortalAccount }> {
    const clinic = await this.website.requirePortalClinic(slug);
    const phone = phoneKey(rawPhone);

    if (!(await this.consumeCode(clinic.id, phone, code))) {
      throw new UnauthorizedException("The code is wrong or has expired");
    }

    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + PORTAL_SESSION_HOURS * 60 * 60 * 1000);
    const [session] = await this.db
      .insert(portalSessions)
      .values({
        clinicId: clinic.id,
        phoneDigits: phone,
        tokenHash: hashSessionToken(token),
        expiresAt,
      })
      .returning({ id: portalSessions.id });

    if (!session) {
      throw new Error("Failed to open the portal session");
    }

    return {
      token,
      account: await this.account({ id: session.id, clinicId: clinic.id, phone, expiresAt }),
    };
  }

  async sessionFor(token: string): Promise<PortalSessionContext | undefined> {
    const [row] = await this.db
      .select({
        id: portalSessions.id,
        clinicId: portalSessions.clinicId,
        phone: portalSessions.phoneDigits,
        expiresAt: portalSessions.expiresAt,
      })
      .from(portalSessions)
      .where(
        and(
          eq(portalSessions.tokenHash, hashSessionToken(token)),
          isNull(portalSessions.revokedAt),
          gt(portalSessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!row || !(await this.website.portalOpen(row.clinicId))) {
      return undefined;
    }

    return row;
  }

  async account(session: PortalSessionContext): Promise<PortalAccount> {
    const [clinic] = await this.db
      .select({ slug: clinics.slug, currency: clinics.currency, settings: clinics.settings })
      .from(clinics)
      .where(eq(clinics.id, session.clinicId))
      .limit(1);

    return {
      clinicSlug: clinic?.slug ?? "",
      currency: clinic?.currency ?? "",
      timeZone: clinicScheduleSettings(clinic?.settings).timezone || DEFAULT_TIME_ZONE,
      expiresAt: session.expiresAt.toISOString(),
      patients: await this.patientsFor(session.clinicId, session.phone),
    };
  }

  async endSession(token: string): Promise<void> {
    await this.db
      .update(portalSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(portalSessions.tokenHash, hashSessionToken(token)),
          isNull(portalSessions.revokedAt),
        ),
      );
  }

  async patientsFor(clinicId: string, phone: string): Promise<PortalPatientSummary[]> {
    return this.db
      .select({
        id: patients.id,
        fullName: patients.fullName,
        firstName: patients.firstName,
        fileNumber: patients.fileNumber,
      })
      .from(patients)
      .where(
        and(
          eq(patients.clinicId, clinicId),
          isNull(patients.deletedAt),
          phoneMatches(patients.phone, phone),
        ),
      )
      .orderBy(desc(patients.createdAt));
  }

  private async consumeCode(clinicId: string, phone: string, code: string): Promise<boolean> {
    const [claimed] = await this.db
      .update(portalCodes)
      .set({ attempts: sql`${portalCodes.attempts} + 1` })
      .where(
        and(
          inArray(
            portalCodes.id,
            this.db
              .select({ id: portalCodes.id })
              .from(portalCodes)
              .where(and(eq(portalCodes.clinicId, clinicId), eq(portalCodes.phoneDigits, phone)))
              .orderBy(desc(portalCodes.createdAt))
              .limit(1),
          ),
          isNull(portalCodes.consumedAt),
          gt(portalCodes.expiresAt, new Date()),
          lt(portalCodes.attempts, PORTAL_CODE_MAX_ATTEMPTS),
        ),
      )
      .returning({ id: portalCodes.id, codeHash: portalCodes.codeHash });

    if (!claimed || !portalCodeMatches(claimed.codeHash, clinicId, phone, code)) {
      return false;
    }

    const [consumed] = await this.db
      .update(portalCodes)
      .set({ consumedAt: new Date() })
      .where(and(eq(portalCodes.id, claimed.id), isNull(portalCodes.consumedAt)))
      .returning({ id: portalCodes.id });

    return consumed !== undefined;
  }

  private async maySend(clinicId: string, phone: string): Promise<boolean> {
    const [recent] = await this.db
      .select({
        lastHour: sql<number>`count(*)::int`,
        lastSentAt: sql<Date | null>`max(${portalCodes.createdAt})`,
      })
      .from(portalCodes)
      .where(
        and(
          eq(portalCodes.clinicId, clinicId),
          eq(portalCodes.phoneDigits, phone),
          gt(portalCodes.createdAt, sql`now() - interval '1 hour'`),
        ),
      );

    if ((recent?.lastHour ?? 0) >= PORTAL_CODES_PER_HOUR) {
      return false;
    }

    const lastSentAt = recent?.lastSentAt ? new Date(recent.lastSentAt).getTime() : 0;

    return Date.now() - lastSentAt >= PORTAL_CODE_RESEND_SECONDS * 1000;
  }
}
