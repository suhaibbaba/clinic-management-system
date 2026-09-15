import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordService {
  async hash(plainText: string): Promise<string> {
    return hash(plainText, ARGON2_OPTIONS);
  }

  /** Never throws on a malformed digest — a bad stored hash is a failed login. */
  async verify(digest: string, plainText: string): Promise<boolean> {
    try {
      return await verify(digest, plainText, ARGON2_OPTIONS);
    } catch {
      return false;
    }
  }
}
