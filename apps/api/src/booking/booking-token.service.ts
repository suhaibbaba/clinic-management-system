import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Env } from "@api/config/env.schema";

const PREFIX = "v1";

const encode = (value: string): string => Buffer.from(value, "utf8").toString("base64url");
const decode = (value: string): string => Buffer.from(value, "base64url").toString("utf8");

@Injectable()
export class BookingTokenService {
  private readonly secret: string;

  constructor(config: ConfigService<Env, true>) {
    this.secret =
      config.get("BOOKING_TOKEN_SECRET", { infer: true }) ??
      config.get("JWT_SECRET", { infer: true });
  }

  sign(appointmentId: string): string {
    const payload = encode(appointmentId);

    return `${PREFIX}.${payload}.${this.signature(payload)}`;
  }

  verify(token: string): string {
    const parts = token.split(".");

    if (parts.length !== 3 || parts[0] !== PREFIX) {
      throw new UnauthorizedException("Invalid booking link");
    }

    const [, payload = "", signature = ""] = parts;
    const expected = this.signature(payload);

    const given = Buffer.from(signature);
    const want = Buffer.from(expected);

    if (given.length !== want.length || !timingSafeEqual(given, want)) {
      throw new UnauthorizedException("Invalid booking link");
    }

    const id = decode(payload);

    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      throw new UnauthorizedException("Invalid booking link");
    }

    return id;
  }

  private signature(payload: string): string {
    return createHmac("sha256", this.secret).update(`${PREFIX}.${payload}`).digest("base64url");
  }
}
