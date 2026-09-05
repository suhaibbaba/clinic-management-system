import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import type {
  AuthenticatedUserProfile,
  ChangePasswordInput,
  LoginInput,
  LoginResponse,
  AuthTokens,
} from '@clinic/shared';

import { PasswordService } from '@api/auth/password.service';
import { TokenService } from '@api/auth/token.service';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { users } from '@api/database/schema';

type UserRow = typeof users.$inferSelect;

/** One message for every credential failure — the API never reveals which part was wrong. */
const INVALID_CREDENTIALS = 'Invalid credentials';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /** Compared against when no user matches, so login timing does not reveal existence. */
  private decoyHash: string | null = null;

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  async login(input: LoginInput): Promise<LoginResponse> {
    const user = await this.findByIdentifier(input.identifier);

    if (!user) {
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

    return { ...tokens, user: toProfile(user) };
  }

  /**
   * Rotating refresh: the presented token is revoked and replaced on every call.
   *
   * Presenting an already-revoked token means it was captured and replayed, so
   * the whole family is revoked and the session ends.
   */
  async refresh(presentedToken: string): Promise<AuthTokens> {
    const stored = await this.tokenService.findByToken(presentedToken);

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.revokedAt) {
      this.logger.warn(`Refresh token reuse detected for user ${stored.userId}; revoking session`);
      await this.tokenService.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.findActiveById(stored.userId);

    if (!user) {
      await this.tokenService.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Invalid refresh token');
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
      throw new UnauthorizedException('Account is no longer available');
    }

    return toProfile(user);
  }

  /** Changing a password ends every other session for that user. */
  async changePassword(actor: AuthenticatedUser, input: ChangePasswordInput): Promise<void> {
    const user = await this.findActiveById(actor.id);

    if (!user) {
      throw new UnauthorizedException('Account is no longer available');
    }

    const matches = await this.passwordService.verify(user.passwordHash, input.currentPassword);

    if (!matches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await this.passwordService.hash(input.newPassword);

    await this.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date(), updatedBy: actor.id })
      .where(eq(users.id, actor.id));

    await this.tokenService.revokeAllForUser(actor.id);
  }

  private async issueTokens(user: UserRow): Promise<AuthTokens> {
    const issued = await this.tokenService.issueRefreshToken(user);

    return {
      accessToken: await this.tokenService.createAccessToken(user),
      refreshToken: issued.token,
      expiresIn: this.tokenService.accessTokenTtlSeconds,
    };
  }

  /**
   * Login accepts the phone number or the email in one field. Both are unique
   * across the system, so no clinic hint is needed.
   */
  private async findByIdentifier(identifier: string): Promise<UserRow | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          or(eq(users.phone, identifier), eq(sql`lower(${users.email})`, identifier.toLowerCase())),
        ),
      )
      .limit(1);

    return user;
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
    this.decoyHash ??= await this.passwordService.hash('decoy-password-for-timing');
    await this.passwordService.verify(this.decoyHash, password);
  }
}

function toProfile(user: UserRow): AuthenticatedUserProfile {
  return {
    id: user.id,
    clinicId: user.clinicId,
    name: user.name,
    phone: user.phone,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  };
}
