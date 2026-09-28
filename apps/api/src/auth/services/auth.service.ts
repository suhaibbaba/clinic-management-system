import { Inject, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { and, eq, isNull, like, sql } from "drizzle-orm";
import {
  DEFAULT_PHONE_COUNTRY,
  normalizePhone,
  type AuthenticatedUserProfile,
  type ChangePasswordInput,
  type IssuedSession,
  type LoginInput,
  type LoginResponse,
  type SessionClinic,
  type UserRole,
} from "@clinic/shared";
import { PasswordService } from "@api/auth/services/password.service";
import { TokenService } from "@api/auth/services/token.service";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { PermissionsService } from "@api/permissions/services/permissions.service";
import { StorageService } from "@api/storage/services/storage.service";
import { clinics, specialties, users } from "@api/database/schema";
import { INVALID_CREDENTIALS, PHONE_MIN_DIGITS } from "@api/auth/constants";
import { UserRow } from "@api/auth/lib/auth";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private decoyHash: string | null = null;

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly storage: StorageService,
    private readonly permissions: PermissionsService,
  ) {}

  async login(input: LoginInput): Promise<LoginResponse & IssuedSession> {
    const user = await this.findByIdentifier(input.identifier);

    if (!user) {
      await this.burnTiming(input.password);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (user.passwordHash === null) {
      await this.burnTiming(input.password);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const passwordMatches = await this.passwordService.verify(user.passwordHash, input.password);

    if (!passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (!user.isActive) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    await this.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    const tokens = await this.issueTokens(user);

    return { ...tokens, user: await this.toProfile(user) };
  }

  async refresh(presentedToken: string): Promise<IssuedSession> {
    const stored = await this.tokenService.findByToken(presentedToken);

    if (!stored) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (stored.revokedAt) {
      this.logger.warn(`Refresh token reuse detected for user ${stored.userId}; revoking session`);
      await this.tokenService.revokeAllForUser(stored.userId);
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const user = await this.findActiveById(stored.userId);

    if (!user) {
      await this.tokenService.revokeAllForUser(stored.userId);
      throw new UnauthorizedException("Invalid refresh token");
    }

    const issued = await this.tokenService.issueRefreshToken(user);
    await this.tokenService.revoke(stored.id, issued.id);

    return {
      accessToken: await this.tokenService.createAccessToken(user),
      refreshToken: issued.token,
      expiresIn: this.tokenService.accessTokenTtlSeconds,
    };
  }

  async logout(presentedToken: string): Promise<void> {
    const stored = await this.tokenService.findByToken(presentedToken);

    if (stored && !stored.revokedAt) {
      await this.tokenService.revoke(stored.id);
    }
  }

  async getProfile(actor: AuthenticatedUser): Promise<AuthenticatedUserProfile> {
    const user = await this.findActiveById(actor.id);

    if (!user) {
      throw new UnauthorizedException("Account is no longer available");
    }

    return this.toProfile(user);
  }

  async changePassword(actor: AuthenticatedUser, input: ChangePasswordInput): Promise<void> {
    const user = await this.findActiveById(actor.id);

    if (!user) {
      throw new UnauthorizedException("Account is no longer available");
    }

    const matches =
      user.passwordHash !== null &&
      (await this.passwordService.verify(user.passwordHash, input.currentPassword));

    if (!matches) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    const passwordHash = await this.passwordService.hash(input.newPassword);

    await this.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date(), updatedBy: actor.id })
      .where(eq(users.id, actor.id));

    await this.tokenService.revokeAllForUser(actor.id);
  }

  private async issueTokens(user: UserRow): Promise<IssuedSession> {
    const issued = await this.tokenService.issueRefreshToken(user);

    return {
      accessToken: await this.tokenService.createAccessToken(user),
      refreshToken: issued.token,
      expiresIn: this.tokenService.accessTokenTtlSeconds,
    };
  }

  private async findByIdentifier(identifier: string): Promise<UserRow | undefined> {
    const trimmed = identifier.trim();

    if (trimmed.includes("@")) {
      const [user] = await this.db
        .select()
        .from(users)
        .where(and(isNull(users.deletedAt), eq(sql`lower(${users.email})`, trimmed.toLowerCase())))
        .limit(1);

      return user;
    }

    const international = trimmed.startsWith("+") || trimmed.startsWith("00");
    const digits = international
      ? normalizePhone(trimmed).slice(1)
      : trimmed.replace(/\D/g, "").replace(/^0/, "");

    if (digits.length < PHONE_MIN_DIGITS) {
      return undefined;
    }

    const storedDigits = sql<string>`regexp_replace(${users.phone}, '[^0-9]', '', 'g')`;
    const matches = await this.db
      .select()
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          international ? eq(storedDigits, digits) : like(storedDigits, `%${digits}`),
        ),
      )
      .limit(2);

    return matches.length === 1 ? matches[0] : undefined;
  }

  private async findActiveById(id: string): Promise<UserRow | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt), eq(users.isActive, true)))
      .limit(1);

    return user;
  }

  private async burnTiming(password: string): Promise<void> {
    this.decoyHash ??= await this.passwordService.hash("decoy-password-for-timing");
    await this.passwordService.verify(this.decoyHash, password);
  }

  private async toProfile(user: UserRow): Promise<AuthenticatedUserProfile> {
    return {
      id: user.id,
      clinicId: user.clinicId,
      clinic: await this.sessionClinic(user.clinicId),
      name: { ar: user.nameAr, en: user.nameEn },
      firstName: { ar: user.firstNameAr, en: user.firstNameEn },
      lastName: { ar: user.lastNameAr, en: user.lastNameEn },
      phone: user.phone,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      photoUrl: user.photoKey ? (await this.storage.createDownloadUrl(user.photoKey)).url : null,
      capabilities: await this.allowedCapabilities(user.clinicId, user.role),
    };
  }

  private async allowedCapabilities(clinicId: string, role: UserRole): Promise<string[]> {
    const matrix = await this.permissions.matrix(clinicId, role);

    return Object.entries(matrix)
      .filter(([, allowed]) => allowed)
      .map(([capability]) => capability);
  }

  private async sessionClinic(clinicId: string): Promise<SessionClinic> {
    const [[row], chartTypes] = await Promise.all([
      this.db
        .select({
          nameAr: clinics.nameAr,
          nameEn: clinics.nameEn,
          logoKey: clinics.logoKey,
          country: clinics.country,
        })
        .from(clinics)
        .where(and(eq(clinics.id, clinicId), isNull(clinics.deletedAt)))
        .limit(1),
      this.db
        .selectDistinct({ chartType: specialties.chartType })
        .from(specialties)
        .where(
          and(
            eq(specialties.clinicId, clinicId),
            eq(specialties.isActive, true),
            isNull(specialties.deletedAt),
          ),
        ),
    ]);

    if (!row) {
      return {
        name: { ar: "", en: "" },
        logoUrl: null,
        chartTypes: [],
        country: DEFAULT_PHONE_COUNTRY,
      };
    }

    return {
      name: { ar: row.nameAr, en: row.nameEn },
      logoUrl: row.logoKey ? (await this.storage.createBrandingUrl(row.logoKey)).url : null,
      chartTypes: chartTypes.map((specialty) => specialty.chartType),
      country: row.country,
    };
  }
}
