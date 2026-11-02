import { clinicLocale } from "@clinic/shared";
import { BadRequestException, Injectable, Logger, NotFoundException, Inject } from "@nestjs/common";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { PersonName } from "@clinic/shared";
import { DATABASE, type Database } from "@api/database/database.module";
import { clinics, users } from "@api/database/schema";
import { AccountEmailService } from "@api/modules/email/services/account-email.service";
import { hashToken, type AccountEmailPurpose } from "@api/modules/email/lib/account-email";
import { PasswordService } from "@api/modules/auth/services/password.service";
import { TokenService } from "@api/modules/auth/services/token.service";
import { typedPhoneMatches } from "@api/common/lib/phone";
import { inSignInClinic, onlyMatch } from "@api/common/lib/sign-in-scope";
import { type RequestSite } from "@api/common/types/request-site";
import { ClinicHostService } from "@api/modules/auth/services/clinic-host.service";
import { inLiveClinic } from "@api/common/lib/live-clinic";

@Injectable()
export class AccountInvitationsService {
  private readonly logger = new Logger("AccountInvitations");

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly email: AccountEmailService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly hosts: ClinicHostService,
  ) {}

  async invite(userId: string, clinicId: string, purpose: AccountEmailPurpose): Promise<void> {
    const [user] = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        isActive: users.isActive,
      })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.clinicId, clinicId), isNull(users.deletedAt)))
      .limit(1);

    if (!user) {
      throw new NotFoundException("Resource not found");
    }

    if (!user.email) {
      throw new BadRequestException("That account has no email address to send to");
    }

    if (!user.isActive) {
      throw new BadRequestException("That account is disabled");
    }

    await this.issueAndSend({ id: user.id, name: user.name, email: user.email }, clinicId, purpose);
  }

  async forgot(identifier: string, site: RequestSite): Promise<void> {
    const value = identifier.trim();
    const scope = await this.hosts.signInScope(site);

    if (!scope.open) {
      return;
    }

    const clinicId = scope.clinicId;

    const user = onlyMatch(
      await this.db
        .select({
          id: users.id,
          clinicId: users.clinicId,
          name: users.name,
          email: users.email,
          hasPassword: sql<boolean>`${users.passwordHash} is not null`,
        })
        .from(users)
        .where(
          and(
            isNull(users.deletedAt),
            inLiveClinic,
            eq(users.isActive, true),
            value.includes("@")
              ? eq(sql`lower(${users.email})`, value.toLowerCase())
              : typedPhoneMatches(users.phone, value),
            inSignInClinic(clinicId),
          ),
        )
        .limit(2),
    );

    if (!user?.email) {
      this.logger.log("Password reset asked for an identifier with no live account; nothing sent.");
      return;
    }

    await this.issueAndSend(
      { id: user.id, name: user.name, email: user.email },
      user.clinicId,
      user.hasPassword ? "reset" : "activate",
    );
  }

  async setPassword(token: string, password: string): Promise<void> {
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.passwordTokenHash, hashToken(token)),
          gt(users.passwordTokenExpiresAt, new Date()),
          eq(users.isActive, true),
          isNull(users.deletedAt),
          inLiveClinic,
        ),
      )
      .limit(1);

    if (!user) {
      throw new BadRequestException("That link has expired or has already been used");
    }

    await this.db
      .update(users)
      .set({
        passwordHash: await this.passwords.hash(password),
        passwordTokenHash: null,
        passwordTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    await this.tokens.revokeAllForUser(user.id);
  }

  private async issueAndSend(
    recipient: { id: string; name: PersonName; email: string },
    clinicId: string,
    purpose: AccountEmailPurpose,
  ): Promise<void> {
    const [clinic] = await this.db
      .select({
        appDomain: clinics.appDomain,
        emailFrom: clinics.emailFrom,
        name: clinics.name,
        logoKey: clinics.logoKey,
        email: clinics.email,
        country: clinics.country,
        settings: clinics.settings,
      })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    if (!clinic) {
      throw new NotFoundException("Resource not found");
    }

    const issued = this.email.issueToken();

    await this.db
      .update(users)
      .set({ passwordTokenHash: issued.tokenHash, passwordTokenExpiresAt: issued.expiresAt })
      .where(eq(users.id, recipient.id));

    await this.email.send(
      purpose,
      { email: recipient.email, name: recipient.name },
      {
        clinicId: clinicId,
        appDomain: clinic.appDomain,
        emailFrom: clinic.emailFrom,
        name: clinic.name,
        logoKey: clinic.logoKey,
        email: clinic.email,
        language: clinicLocale(clinic).primaryLanguage,
      },
      issued.token,
    );
  }
}
