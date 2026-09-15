import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { Inject } from '@nestjs/common';

import { DATABASE, type Database } from '@api/database/database.module';
import { clinics, users } from '@api/database/schema';
import {
  AccountEmailService,
  hashToken,
  type AccountEmailPurpose,
} from '@api/email/account-email.service';
import { PasswordService } from '@api/auth/password.service';
import { TokenService } from '@api/auth/token.service';

@Injectable()
export class AccountInvitationsService {
  private readonly logger = new Logger('AccountInvitations');

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly email: AccountEmailService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Issues a fresh link and sends it. A resend is the same call — the new token replaces the old
   * one, so a link that was forwarded or left in an inbox stops working the moment another is sent.
   */
  async invite(userId: string, clinicId: string, purpose: AccountEmailPurpose): Promise<void> {
    const [user] = await this.db
      .select({
        id: users.id,
        nameAr: users.nameAr,
        nameEn: users.nameEn,
        email: users.email,
        isActive: users.isActive,
      })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.clinicId, clinicId), isNull(users.deletedAt)))
      .limit(1);

    if (!user) {
      throw new NotFoundException('Resource not found');
    }

    if (!user.email) {
      throw new BadRequestException('That account has no email address to send to');
    }

    if (!user.isActive) {
      throw new BadRequestException('That account is disabled');
    }

    await this.issueAndSend(
      { id: user.id, name: { ar: user.nameAr, en: user.nameEn }, email: user.email },
      clinicId,
      purpose,
    );
  }

  /**
   * The public half. Answers the same whatever the identifier is: whether an address has an account
   * here is not something a stranger may ask.
   */
  async forgot(identifier: string): Promise<void> {
    const value = identifier.trim();

    const [user] = await this.db
      .select({
        id: users.id,
        clinicId: users.clinicId,
        nameAr: users.nameAr,
        nameEn: users.nameEn,
        email: users.email,
        hasPassword: sql<boolean>`${users.passwordHash} is not null`,
      })
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          eq(users.isActive, true),
          or(eq(users.phone, value), eq(sql`lower(${users.email})`, value.toLowerCase())),
        ),
      )
      .limit(1);

    if (!user?.email) {
      this.logger.log('Password reset asked for an identifier with no live account; nothing sent.');
      return;
    }

    await this.issueAndSend(
      { id: user.id, name: { ar: user.nameAr, en: user.nameEn }, email: user.email },
      user.clinicId,
      // Somebody who never activated gets the letter that matches where they actually are.
      user.hasPassword ? 'reset' : 'activate',
    );
  }

  /** Spends the token: it works once, and only before it expires. */
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
        ),
      )
      .limit(1);

    if (!user) {
      throw new BadRequestException('That link has expired or has already been used');
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

    // The same thing changing a password does: every session opened before this one belonged to
    // whoever had the old credential.
    await this.tokens.revokeAllForUser(user.id);
  }

  private async issueAndSend(
    recipient: { id: string; name: { ar: string; en: string }; email: string },
    clinicId: string,
    purpose: AccountEmailPurpose,
  ): Promise<void> {
    const [clinic] = await this.db
      .select({ nameAr: clinics.nameAr, nameEn: clinics.nameEn, logoKey: clinics.logoKey })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    if (!clinic) {
      throw new NotFoundException('Resource not found');
    }

    const issued = this.email.issueToken();

    await this.db
      .update(users)
      .set({ passwordTokenHash: issued.tokenHash, passwordTokenExpiresAt: issued.expiresAt })
      .where(eq(users.id, recipient.id));

    // Written before sending: a letter that goes out against a token nobody stored is a link that
    // cannot work, which is worse than one that was never sent.
    await this.email.send(
      purpose,
      { email: recipient.email, name: recipient.name },
      { name: { ar: clinic.nameAr, en: clinic.nameEn }, logoKey: clinic.logoKey },
      issued.token,
    );
  }
}
