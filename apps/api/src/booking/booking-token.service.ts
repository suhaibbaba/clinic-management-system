import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

import type { Env } from '@api/config/env.schema';

/** `v1.<payload>.<signature>`, all base64url. */
const PREFIX = 'v1';

const encode = (value: string): string => Buffer.from(value, 'utf8').toString('base64url');
const decode = (value: string): string => Buffer.from(value, 'base64url').toString('utf8');

// An HMAC over the appointment id, not the id itself, so a guessed token is a typo and is rejected
// before any query. `cancel` and `manage` sign separately, under their own secret.
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

  // Every failure is the same exception with the same message: a nearly-right token must not be
  // distinguishable from nonsense, or the error text is a forging oracle.
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
