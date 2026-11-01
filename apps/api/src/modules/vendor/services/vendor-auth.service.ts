import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { type VendorLoginInput, type VendorProfile } from "@clinic/shared";
import { DATABASE, type Database } from "@api/database/database.module";
import { vendorSessions, vendorUsers } from "@api/database/schema";
import { LoginThrottleService } from "@api/modules/auth/services/login-throttle.service";
import { PasswordService } from "@api/modules/auth/services/password.service";
import { VENDOR_SESSION_HOURS, VENDOR_THROTTLE_PREFIX } from "@api/modules/vendor/constants";
import {
  generateVendorToken,
  hashVendorToken,
  type VendorSessionContext,
} from "@api/modules/vendor/lib/vendor-session";

@Injectable()
export class VendorAuthService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly passwords: PasswordService,
    private readonly throttle: LoginThrottleService,
  ) {}

  async login(
    input: VendorLoginInput,
  ): Promise<{ token: string; expiresAt: Date; profile: VendorProfile }> {
    const identifier = `${VENDOR_THROTTLE_PREFIX}${input.email.toLowerCase()}`;

    await this.throttle.assertOpen(identifier);

    const [user] = await this.db
      .select()
      .from(vendorUsers)
      .where(
        and(
          sql`lower(${vendorUsers.email}) = ${input.email.toLowerCase()}`,
          eq(vendorUsers.isActive, true),
        ),
      )
      .limit(1);

    if (!user || !(await this.passwords.verify(user.passwordHash, input.password))) {
      await this.throttle.recordFailure(identifier);
      throw new UnauthorizedException("Invalid credentials");
    }

    await this.throttle.clear(identifier);

    const token = generateVendorToken();
    const expiresAt = new Date(Date.now() + VENDOR_SESSION_HOURS * 60 * 60 * 1000);

    await this.db.insert(vendorSessions).values({
      vendorUserId: user.id,
      tokenHash: hashVendorToken(token),
      expiresAt,
    });
    await this.db
      .update(vendorUsers)
      .set({ lastLoginAt: new Date() })
      .where(eq(vendorUsers.id, user.id));

    return { token, expiresAt, profile: { id: user.id, email: user.email, name: user.name } };
  }

  async sessionFor(token: string): Promise<VendorSessionContext | undefined> {
    const [row] = await this.db
      .select({
        sessionId: vendorSessions.id,
        vendorUserId: vendorUsers.id,
        email: vendorUsers.email,
        name: vendorUsers.name,
      })
      .from(vendorSessions)
      .innerJoin(vendorUsers, eq(vendorUsers.id, vendorSessions.vendorUserId))
      .where(
        and(
          eq(vendorSessions.tokenHash, hashVendorToken(token)),
          isNull(vendorSessions.revokedAt),
          gt(vendorSessions.expiresAt, new Date()),
          eq(vendorUsers.isActive, true),
        ),
      )
      .limit(1);

    return row;
  }

  async endSession(token: string): Promise<void> {
    await this.db
      .update(vendorSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(vendorSessions.tokenHash, hashVendorToken(token)), isNull(vendorSessions.revokedAt)),
      );
  }
}
