import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import { DATABASE, type Database } from "@api/database/database.module";
import { clinics, loginCodes, users } from "@api/database/schema";
import { AccountEmailService } from "@api/modules/email/services/account-email.service";
import {
  LOGIN_CODE_MAX_ATTEMPTS,
  LOGIN_CODE_RESEND_SECONDS,
  LOGIN_CODE_SENDS_PER_HOUR,
  LOGIN_CODE_TTL_MINUTES,
} from "@api/modules/auth/constants";
import { type UserRow } from "@api/modules/auth/lib/auth";
import {
  generateLoginCode,
  hashLoginCode,
  loginCodeMatches,
} from "@api/modules/auth/lib/login-code";

@Injectable()
export class LoginCodeService {
  private readonly logger = new Logger(LoginCodeService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly email: AccountEmailService,
  ) {}

  async request(email: string): Promise<void> {
    const user = await this.findByEmail(email);

    if (!user?.email || !user.isActive) {
      this.logger.log("Sign-in code asked for an email with no live account; nothing sent.");
      return;
    }

    if (!(await this.maySend(user.id))) {
      this.logger.warn(`Sign-in code for user ${user.id} held back by the send limit.`);
      return;
    }

    const code = generateLoginCode();

    await this.db
      .update(loginCodes)
      .set({ consumedAt: new Date() })
      .where(and(eq(loginCodes.userId, user.id), isNull(loginCodes.consumedAt)));

    await this.db.insert(loginCodes).values({
      clinicId: user.clinicId,
      userId: user.id,
      codeHash: hashLoginCode(user.id, code),
      expiresAt: new Date(Date.now() + LOGIN_CODE_TTL_MINUTES * 60_000),
    });

    void this.send(user, user.email, code).catch((error: unknown) => {
      this.logger.error(`Could not send the sign-in code to user ${user.id}: ${String(error)}`);
    });
  }

  async consume(email: string, code: string): Promise<UserRow | undefined> {
    const user = await this.findByEmail(email);

    if (!user) {
      return undefined;
    }

    const [claimed] = await this.db
      .update(loginCodes)
      .set({ attempts: sql`${loginCodes.attempts} + 1` })
      .where(
        and(
          inArray(
            loginCodes.id,
            this.db
              .select({ id: loginCodes.id })
              .from(loginCodes)
              .where(eq(loginCodes.userId, user.id))
              .orderBy(desc(loginCodes.createdAt))
              .limit(1),
          ),
          isNull(loginCodes.consumedAt),
          gt(loginCodes.expiresAt, new Date()),
          lt(loginCodes.attempts, LOGIN_CODE_MAX_ATTEMPTS),
        ),
      )
      .returning({
        id: loginCodes.id,
        codeHash: loginCodes.codeHash,
        attempts: loginCodes.attempts,
      });

    if (!claimed) {
      return undefined;
    }

    const matches = loginCodeMatches(claimed.codeHash, user.id, code);

    if (!matches && claimed.attempts < LOGIN_CODE_MAX_ATTEMPTS) {
      return undefined;
    }

    const [consumed] = await this.db
      .update(loginCodes)
      .set({ consumedAt: new Date() })
      .where(and(eq(loginCodes.id, claimed.id), isNull(loginCodes.consumedAt)))
      .returning({ id: loginCodes.id });

    return matches && consumed ? user : undefined;
  }

  private async maySend(userId: string): Promise<boolean> {
    const [recent] = await this.db
      .select({
        lastHour: sql<number>`count(*)::int`,
        lastSentAt: sql<Date | null>`max(${loginCodes.createdAt})`,
      })
      .from(loginCodes)
      .where(
        and(
          eq(loginCodes.userId, userId),
          gt(loginCodes.createdAt, sql`now() - interval '1 hour'`),
        ),
      );

    if ((recent?.lastHour ?? 0) >= LOGIN_CODE_SENDS_PER_HOUR) {
      return false;
    }

    const lastSentAt = recent?.lastSentAt ? new Date(recent.lastSentAt).getTime() : 0;

    return Date.now() - lastSentAt >= LOGIN_CODE_RESEND_SECONDS * 1000;
  }

  private async send(user: UserRow, to: string, code: string): Promise<void> {
    const [clinic] = await this.db
      .select({
        nameAr: clinics.nameAr,
        nameEn: clinics.nameEn,
        logoKey: clinics.logoKey,
        email: clinics.email,
      })
      .from(clinics)
      .where(eq(clinics.id, user.clinicId))
      .limit(1);

    if (!clinic) {
      return;
    }

    await this.email.sendLoginCode(
      { email: to, name: { ar: user.nameAr, en: user.nameEn } },
      {
        name: { ar: clinic.nameAr, en: clinic.nameEn },
        logoKey: clinic.logoKey,
        email: clinic.email,
      },
      code,
      LOGIN_CODE_TTL_MINUTES,
    );
  }

  private async findByEmail(email: string): Promise<UserRow | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(
        and(isNull(users.deletedAt), eq(sql`lower(${users.email})`, email.trim().toLowerCase())),
      )
      .limit(1);

    return user;
  }
}
