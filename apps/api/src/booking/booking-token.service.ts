import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

import type { Env } from '@api/config/env.schema';

/** `v1.<payload>.<signature>`, all base64url. */
const PREFIX = 'v1';

const encode = (value: string): string => Buffer.from(value, 'utf8').toString('base64url');
const decode = (value: string): string => Buffer.from(value, 'base64url').toString('utf8');

/**
 * The opaque handle a patient gets for their own booking.
 *
 * It is an HMAC over the appointment id, not the id itself. Two reasons, and
 * the first is the one that matters: a raw UUID in a URL that goes out over SMS
 * is a URL anyone can *try* — change a character, hit a different patient's
 * booking. A signature makes a guessed token indistinguishable from a typo, and
 * both are rejected before a database query happens.
 *
 * The second is that a token can carry a purpose. `cancel` and `manage` are
 * signed separately, so a link that only cancels cannot be replayed to read the
 * booking, and neither works after the appointment is soft-deleted because the
 * lookup that follows is still clinic-scoped.
 *
 * Signed with `BOOKING_TOKEN_SECRET`, which is deliberately not `JWT_SECRET`:
 * this one is handed to an anonymous stranger and lives for weeks, where an
 * access token is short-lived and belongs to signed-in staff. One key
 * compromised must not be the other.
 */
@Injectable()
export class BookingTokenService {
  private readonly secret: string;

  constructor(config: ConfigService<Env, true>) {
    // Falls back only so a development environment boots without a second
    // variable; every deployed environment sets its own.
    this.secret =
      config.get('BOOKING_TOKEN_SECRET', { infer: true }) ??
      config.get('JWT_SECRET', { infer: true });
  }

  sign(appointmentId: string): string {
    const payload = encode(appointmentId);

    return `${PREFIX}.${payload}.${this.signature(payload)}`;
  }

  /**
   * The appointment id inside a token, or 401.
   *
   * Every failure — wrong shape, wrong signature, wrong version — is the same
   * exception with the same message. A token that is *nearly* right must not be
   * distinguishable from one that is nonsense, or the error text becomes an
   * oracle for forging the next attempt.
   */
  verify(token: string): string {
    const parts = token.split('.');

    if (parts.length !== 3 || parts[0] !== PREFIX) {
      throw new UnauthorizedException('Invalid booking link');
    }

    const [, payload = '', signature = ''] = parts;
    const expected = this.signature(payload);

    // Constant time: a byte-by-byte comparison leaks how much of a forged
    // signature was correct, which is enough to build the rest of it.
    const given = Buffer.from(signature);
    const want = Buffer.from(expected);

    if (given.length !== want.length || !timingSafeEqual(given, want)) {
      throw new UnauthorizedException('Invalid booking link');
    }

    const id = decode(payload);

    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      throw new UnauthorizedException('Invalid booking link');
    }

    return id;
  }

  private signature(payload: string): string {
    return createHmac('sha256', this.secret).update(`${PREFIX}.${payload}`).digest('base64url');
  }
}
