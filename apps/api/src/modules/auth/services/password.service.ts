import { Injectable } from "@nestjs/common";
import { hash, verify } from "@node-rs/argon2";
import { ARGON2_OPTIONS } from "@api/modules/auth/constants";

@Injectable()
export class PasswordService {
  async hash(plainText: string): Promise<string> {
    return hash(plainText, ARGON2_OPTIONS);
  }

  async verify(digest: string, plainText: string): Promise<boolean> {
    try {
      return await verify(digest, plainText, ARGON2_OPTIONS);
    } catch {
      return false;
    }
  }
}
