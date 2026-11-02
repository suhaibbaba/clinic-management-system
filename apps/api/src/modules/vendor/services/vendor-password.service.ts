import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, count, eq, gt, isNull, sql } from "drizzle-orm";
import {
  VENDOR_RESET_INVALID,
  type VendorForgotPasswordInput,
  type VendorResetPasswordInput,
} from "@clinic/shared";
import type { Env } from "@api/config/env.schema";
import { DATABASE, type Database } from "@api/database/database.module";
import { vendorPasswordResets, vendorSessions, vendorUsers } from "@api/database/schema";
import { LoginThrottleService } from "@api/modules/auth/services/login-throttle.service";
import { PasswordService } from "@api/modules/auth/services/password.service";
import { AccountEmailService } from "@api/modules/email/services/account-email.service";
import {
  VENDOR_RESET_HOURS,
  VENDOR_RESETS_PER_HOUR,
  VENDOR_THROTTLE_PREFIX,
} from "@api/modules/vendor/constants";
import { generateVendorToken, hashVendorToken } from "@api/modules/vendor/lib/vendor-session";

@Injectable()
export class VendorPasswordService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly config: ConfigService<Env, true>,
    private readonly passwords: PasswordService,
    private readonly throttle: LoginThrottleService,
    private readonly email: AccountEmailService,
  ) {}

  async forgot(input: VendorForgotPasswordInput): Promise<void> {
    const [user] = await this.db
      .select({ id: vendorUsers.id, email: vendorUsers.email, name: vendorUsers.name })
      .from(vendorUsers)
      .where(
        and(
          sql`lower(${vendorUsers.email}) = ${input.email.toLowerCase()}`,
          eq(vendorUsers.isActive, true),
        ),
      )
      .limit(1);

    if (!user) {
      return;
    }

    const [recent] = await this.db
      .select({ value: count() })
      .from(vendorPasswordResets)
      .where(
        and(
          eq(vendorPasswordResets.vendorUserId, user.id),
          gt(vendorPasswordResets.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
        ),
      );

    if ((recent?.value ?? 0) >= VENDOR_RESETS_PER_HOUR) {
      return;
    }

    const token = generateVendorToken();

    await this.db.insert(vendorPasswordResets).values({
      vendorUserId: user.id,
      tokenHash: hashVendorToken(token),
      expiresAt: new Date(Date.now() + VENDOR_RESET_HOURS * 60 * 60 * 1000),
    });

    const base = this.config.get("PUBLIC_BASE_URL", { infer: true }).replace(/\/$/, "");

    await this.email.sendVendorReset(
      user.email,
      user.name,
      input.language,
      `${base}/vendor/reset?token=${encodeURIComponent(token)}`,
      VENDOR_RESET_HOURS,
    );
  }

  async reset(input: VendorResetPasswordInput): Promise<void> {
    const digest = await this.passwords.hash(input.password);

    const email = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(vendorPasswordResets)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(vendorPasswordResets.tokenHash, hashVendorToken(input.token)),
            isNull(vendorPasswordResets.usedAt),
            gt(vendorPasswordResets.expiresAt, new Date()),
          ),
        )
        .returning({ vendorUserId: vendorPasswordResets.vendorUserId });

      if (!row) {
        throw new BadRequestException(VENDOR_RESET_INVALID);
      }

      const [user] = await tx
        .update(vendorUsers)
        .set({ passwordHash: digest, updatedAt: new Date() })
        .where(and(eq(vendorUsers.id, row.vendorUserId), eq(vendorUsers.isActive, true)))
        .returning({ email: vendorUsers.email });

      if (!user) {
        throw new BadRequestException(VENDOR_RESET_INVALID);
      }

      await tx
        .update(vendorPasswordResets)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(vendorPasswordResets.vendorUserId, row.vendorUserId),
            isNull(vendorPasswordResets.usedAt),
          ),
        );
      await tx
        .update(vendorSessions)
        .set({ revokedAt: new Date() })
        .where(
          and(eq(vendorSessions.vendorUserId, row.vendorUserId), isNull(vendorSessions.revokedAt)),
        );

      return user.email;
    });

    await this.throttle.clear(`${VENDOR_THROTTLE_PREFIX}${email.toLowerCase()}`, null);
  }
}
