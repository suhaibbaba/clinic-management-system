import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { and, eq, isNull } from 'drizzle-orm';

import type { AccessTokenPayload } from '@api/common/types/authenticated-user';
import type { Env } from '@api/config/env.schema';
import { DATABASE, type Database } from '@api/database/database.module';
import { refreshTokens, type users } from '@api/database/schema';

type UserRow = typeof users.$inferSelect;

export interface IssuedRefreshToken {
  readonly id: string;
  /** The opaque value handed to the client; only its digest is stored. */
  readonly token: string;
}

/** Refresh tokens are 256 bits of CSPRNG output. */
const REFRESH_TOKEN_BYTES = 32;

@Injectable()
export class TokenService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  get accessTokenTtlSeconds(): number {
    return this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true });
  }

  async createAccessToken(user: Pick<UserRow, 'id' | 'clinicId' | 'role'>): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      clinicId: user.clinicId,
      role: user.role,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.config.get('JWT_SECRET', { infer: true }),
      expiresIn: this.accessTokenTtlSeconds,
    });
  }

  /**
   * A digest, not argon2: the token is high-entropy random output, so it needs
   * no brute-force hardening, and refresh must stay a cheap indexed lookup.
   */
  digest(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Constant-time comparison for digests, to keep lookups from leaking timing. */
  digestsMatch(left: string, right: string): boolean {
    const a = Buffer.from(left, 'utf8');
    const b = Buffer.from(right, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async issueRefreshToken(user: Pick<UserRow, 'id' | 'clinicId'>): Promise<IssuedRefreshToken> {
    const token = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(
      Date.now() + this.config.get('JWT_REFRESH_TTL_DAYS', { infer: true }) * 24 * 60 * 60 * 1000,
    );

    const [row] = await this.db
      .insert(refreshTokens)
      .values({
        clinicId: user.clinicId,
        userId: user.id,
        tokenHash: this.digest(token),
        expiresAt,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning({ id: refreshTokens.id });

    /* istanbul ignore next -- insert ... returning always yields a row. */
    if (!row) {
      throw new Error('Failed to persist refresh token');
    }

    return { id: row.id, token };
  }

  async findByToken(token: string): Promise<typeof refreshTokens.$inferSelect | undefined> {
    const [row] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, this.digest(token)))
      .limit(1);

    return row;
  }

  async revoke(id: string, replacedByTokenId?: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({
        revokedAt: new Date(),
        replacedByTokenId: replacedByTokenId ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(refreshTokens.id, id), isNull(refreshTokens.revokedAt)));
  }

  /**
   * Revokes every live token for a user. Used on password change and on refresh
   * token reuse, which means a token was captured.
   */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  }
}
