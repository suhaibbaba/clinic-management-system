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
import { PasswordService } from "@api/auth/password.service";
import { TokenService } from "@api/auth/token.service";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { PermissionsService } from "@api/permissions/permissions.service";
import { StorageService } from "@api/storage/storage.service";
import { clinics, specialties, users } from "@api/database/schema";

type UserRow = typeof users.$inferSelect;

/** One message for every credential failure — the API never reveals which part was wrong. */
const INVALID_CREDENTIALS = "Invalid credentials";

/** The shortest national number worth matching on; fewer digits would match strangers. */
const PHONE_MIN_DIGITS = 7;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /** Compared against when no user matches, so login timing does not reveal existence. */
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

    // No password yet means the account was created but never activated. Answered exactly as a
    // wrong password is — anything else tells a stranger which addresses have accounts here.
    if (user.passwordHash === null) {
      await this.burnTiming(input.password);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const passwordMatches = await this.passwordService.verify(user.passwordHash, input.password);

    if (!passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (!user.isActive) {
      // Deliberately after the password check: a wrong password on a disabled
      // account must not answer differently from a wrong password on a live one.
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    await this.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    const tokens = await this.issueTokens(user);

    return { ...tokens, user: await this.toProfile(user) };
  }

  // Rotating refresh: the presented token is revoked and replaced on every call, and presenting a
  // revoked one means a replay, so the whole family goes.
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

  /** Idempotent: an unknown or already-revoked token still reports success. */
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

  /** Changing a password ends every other session for that user. */
  async changePassword(actor: AuthenticatedUser, input: ChangePasswordInput): Promise<void> {
    const user = await this.findActiveById(actor.id);

    if (!user) {
      throw new UnauthorizedException("Account is no longer available");
    }

    // Somebody who never set one cannot change it; they activate instead.
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

  // A phone matches however it is typed: `+970 59…`, `0097059…` or a local `059…`. A local number
  // matches on its national digits, and two accounts matching is no match — a login never guesses.
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

  /** Spends roughly one verification's worth of time on an unknown identifier. */
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

  /** The keys only, so a screen can ask `can('patients.update')` without carrying the false ones. */
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
